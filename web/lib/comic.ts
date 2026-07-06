// Comic auto-render in the cascade (schema-002 §3). Ports comic/render.ts's
// nb2() + pagePrompt() + self-check loop into the web app. Runs after
// judging, for the round's single highest-scored match (or any death-stakes
// match). Uploads PNGs to the 'sheets' bucket and returns URLs for the
// caller to store on the match row + feed post.
//
// NOT copied via sync-engine.mjs (that script only mirrors engine/+agents/
// per the brief) — this is a small, web-only module living directly in
// web/lib since it talks to Supabase storage, which the pure sim script
// (comic/render.ts) does not.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fal } from "@fal-ai/client";
import { zoneById } from "./engine/map";
import type { MatchResult } from "./engine/match";
import type { Telling, Verdict } from "./agents/narrate";
import { llmVision, extractJson } from "./agents/llm";

const STYLE =
    "Gritty 1990s American comic book art, bold confident inks, flat colors with neon accents, retro-futuristic Hyper-Brooklyn (Venture-Brothers-adjacent adult animation energy played straight). Halftone texture, dramatic lighting.";

const MAX_PAGES = 2; // budget guard: max 2 pages (8 panels)

interface ComicPanel {
    n: number;
    shot: string;
    description: string;
    dialogue: { speaker: string; text: string; kind: string }[];
    sfx?: string;
}

function resolveFalKey(): string | undefined {
    return process.env.FAL_KEY;
}

async function nb2(prompt: string, refs: string[] = [], aspect = "2:3"): Promise<string> {
    const slug = refs.length ? "fal-ai/nano-banana-2/edit" : "fal-ai/nano-banana-2";
    const input: Record<string, unknown> = { prompt, aspect_ratio: aspect };
    if (refs.length) input.image_urls = refs;
    const result = (await fal.subscribe(slug, { input: input as never })) as {
        data?: { images?: { url: string }[] };
    };
    const url = result.data?.images?.[0]?.url;
    if (!url) throw new Error(`no image from ${slug}`);
    return url;
}

function pagePrompt(panels: ComicPanel[], pageNo: number, totalPages: number, zoneBlurb: string): string {
    const rows = panels
        .map((p) => {
            const dialogue = p.dialogue
                .map((d) =>
                    d.kind === "caption"
                        ? `caption box: "${d.text}"`
                        : `${d.kind === "shout" ? "jagged shout balloon" : d.kind === "thought" ? "thought bubble" : "speech balloon"} from ${d.speaker}: "${d.text}"`
                )
                .join("; ");
            return `PANEL ${p.n} (${p.shot}): ${p.description}${p.sfx ? ` Large hand-lettered SFX: "${p.sfx}".` : ""} ${dialogue}`;
        })
        .join("\n");
    return `A single complete COMIC BOOK PAGE (page ${pageNo} of ${totalPages}), ${panels.length} panels in a clean grid with black gutters, lettered speech balloons with legible text exactly as written.
SETTING: ${zoneBlurb}
${rows}
STYLE: ${STYLE}
The two main characters MUST match the reference images exactly (costume, silhouette, colors).`;
}

async function uploadPng(
    supabase: SupabaseClient,
    url: string,
    path: string
): Promise<string> {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const { error } = await supabase.storage.from("sheets").upload(path, buf, {
        contentType: "image/png",
        upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("sheets").getPublicUrl(path);
    return data.publicUrl;
}

export interface ComicRenderInput {
    matchId: string;
    round: number;
    result: MatchResult;
    canonTelling: Telling;
    aName: string;
    aBio: string;
    aSheetUrl: string | null;
    bName: string;
    bBio: string;
    bSheetUrl: string | null;
}

/**
 * Decide whether this match should get an auto-rendered comic: the round's
 * single highest-scored match, OR any death-stakes match. Callers should
 * compute the "highest-scored" comparison across the round's matches before
 * calling render (see gm/resolve wiring) — this function just renders.
 */
export function isComicEligible(result: MatchResult, verdict: Verdict | null, isRoundBest: boolean): boolean {
    if (result.stakes === "death") return true;
    return isRoundBest && verdict !== null;
}

/** Render up to MAX_PAGES pages for one match's canon telling. Never throws
 * past the caller — every failure mode should degrade to "no comic", not
 * abort the round (mirrors the tolerant-failure pattern in gm/resolve). */
export async function renderMatchComic(
    supabase: SupabaseClient,
    input: ComicRenderInput
): Promise<string[]> {
    const key = resolveFalKey();
    if (!key) throw new Error("FAL_KEY not configured");
    fal.config({ credentials: key });

    const zone = (() => {
        try {
            return zoneById(input.result.zoneId);
        } catch {
            return { id: input.result.zoneId, name: input.result.zoneId, blurb: "a contested corner of Hyper-Brooklyn" };
        }
    })();

    // model sheets: use existing model_sheet_url if present, else generate
    // from bio text (characters without sheets still get a comic — just
    // without a locked-in visual reference).
    const [sheetA, sheetB] = await Promise.all(
        [
            { url: input.aSheetUrl, name: input.aName, bio: input.aBio },
            { url: input.bSheetUrl, name: input.bName, bio: input.bBio },
        ].map(async (pc) => {
            if (pc.url) return pc.url;
            return nb2(
                `Character model sheet, single character, full body, neutral pose plus head close-up: ${pc.name} — ${pc.bio}. ${STYLE} Plain background.`,
                [],
                "1:1"
            );
        })
    );

    const panels = input.canonTelling.panels as unknown as ComicPanel[];
    const chunks: ComicPanel[][] = [];
    for (let i = 0; i < panels.length && chunks.length < MAX_PAGES; i += 4) chunks.push(panels.slice(i, i + 4));

    const refs = [sheetA, sheetB].filter((u): u is string => Boolean(u));
    const pageUrls: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
        const prompt = pagePrompt(chunks[i], i + 1, chunks.length, zone.blurb);
        let url = await nb2(prompt, refs);
        try {
            const check = await llmVision(
                'You QA auto-generated comic pages. Return JSON only: {"ok": bool, "issues": ["specific fixable problems"]}. Check: panel count matches, dialogue text legible and correct, BOTH characters match their established designs across ALL panels (costume COLOR consistency is critical), SFX present where specified.',
                `Expected ${chunks[i].length} panels:\n${chunks[i].map((p) => `P${p.n}: ${p.description} | dialogue: ${p.dialogue.map((d) => d.text).join(" / ")}${p.sfx ? " | SFX: " + p.sfx : ""}`).join("\n")}`,
                url
            );
            const verdict = extractJson<{ ok: boolean; issues: string[] }>(check);
            if (!verdict.ok && verdict.issues?.length) {
                url = await nb2(prompt + `\nCRITICAL FIXES (previous attempt failed QA): ${verdict.issues.join("; ")}`, refs);
            }
        } catch {
            // self-check is best-effort; keep the first render on failure
        }
        const path = `comics/${input.matchId}/page-${i + 1}.png`;
        const publicUrl = await uploadPng(supabase, url, path);
        pageUrls.push(publicUrl);
    }

    return pageUrls;
}

/** Convenience wrapper used by gm/resolve: renders iff eligible, tolerant of
 * any failure (returns [] rather than throwing). */
export async function maybeRenderComic(
    supabase: SupabaseClient,
    input: ComicRenderInput,
    verdict: Verdict | null,
    isRoundBest: boolean
): Promise<string[]> {
    if (!isComicEligible(input.result, verdict, isRoundBest)) return [];
    try {
        return await renderMatchComic(supabase, input);
    } catch (e) {
        console.error(`[comic] render failed for match ${input.matchId}:`, e);
        return [];
    }
}
