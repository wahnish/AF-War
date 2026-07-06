import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { invitePanelPrompt } from "@/lib/prompts";
import type { Character } from "@/lib/types";

export const runtime = "nodejs";

function resolveFalKey(): string | undefined {
    return process.env.FAL_KEY;
}

// Tone contract (never wink, never explain the joke): ridiculous surface,
// real stakes underneath. Pick one at random per invite.
const INVITE_LINES = (characterName: string, inviteeName: string) => [
    `${characterName} has named ${inviteeName} in her will.`,
    `${characterName} needs someone called ${inviteeName} — the prophecy was specific.`,
    `${characterName} keeps a list. ${inviteeName} just made it, for reasons ${characterName} won't explain.`,
    `${characterName} says the Glome whispered ${inviteeName}'s name last night, and now it's stuck.`,
    `${characterName} is saving a seat at the table for ${inviteeName}. Don't ask what's under the table.`,
];

function genCode(): string {
    // crypto.randomUUID() sliced down to 8-10 chars, base36-ish (strip
    // hyphens, take a chunk) — short, unique enough for a shareable link.
    return crypto.randomUUID().replace(/-/g, "").slice(0, 9);
}

async function nb2(prompt: string, refs: string[]): Promise<string> {
    const slug = refs.length ? "fal-ai/nano-banana-2/edit" : "fal-ai/nano-banana-2";
    const input: Record<string, unknown> = { prompt, aspect_ratio: "1:1" };
    if (refs.length) input.image_urls = refs;
    const result = (await fal.subscribe(slug, { input: input as never })) as {
        data?: { images?: { url: string }[] };
    };
    const url = result.data?.images?.[0]?.url;
    if (!url) throw new Error(`no image from ${slug}`);
    return url;
}

export async function POST(req: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { invitee_name?: string; crew_id?: string };

    const service = createServiceClient();
    if (!service) return NextResponse.json({ error: "service role key needed" }, { status: 501 });

    const code = genCode();

    // Find a character of the inviter's with a model_sheet_url, to voice the
    // invite comic (and record which likeness generated it).
    let character: Character | null = null;
    if (body.invitee_name?.trim()) {
        const { data: chars } = await service
            .from("afwar_characters")
            .select("*")
            .eq("owner_id", user.id)
            .not("model_sheet_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(1);
        character = ((chars as Character[]) ?? [])[0] ?? null;
    }

    let comicUrl: string | null = null;
    let line: string | null = null;

    if (character && body.invitee_name?.trim()) {
        const lines = INVITE_LINES(character.name, body.invitee_name.trim());
        line = lines[Math.floor(Math.random() * lines.length)];

        const key = resolveFalKey();
        if (key) {
            try {
                fal.config({ credentials: key });
                const prompt = invitePanelPrompt({
                    characterName: character.name,
                    bio: character.bio ?? "",
                    archetype: character.archetype,
                    line,
                });
                const refs = character.model_sheet_url ? [character.model_sheet_url] : [];
                comicUrl = await nb2(prompt, refs);
            } catch (e) {
                console.error("[invite] comic generation failed (invite still created without one):", e);
            }
        } else {
            console.log(`[invite] FAL_KEY not configured — no-op, would have generated: "${line}"`);
        }
    }

    const { data: invite, error: insertErr } = await service
        .from("afwar_invites")
        .insert({
            code,
            inviter_id: user.id,
            crew_id: body.crew_id ?? null,
            kind: body.crew_id ? "crew" : "general",
            invitee_name: body.invitee_name?.trim() || null,
            comic_url: comicUrl,
            character_id: character?.id ?? null,
        })
        .select("*")
        .single();
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    // Also post to the Feed (downtime-kind, in-fiction recruiting beat) when
    // we had enough to generate a real line — a bare code-only invite (no
    // invitee_name / no sheet) doesn't get a feed post, just the shareable link.
    if (character && line) {
        await service.from("afwar_posts").insert({
            season_id: null,
            author_character: character.id,
            kind: "downtime",
            title: `${character.name} is recruiting`,
            body: `${line}\n\nClaim: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/invite/${code}`,
            media: comicUrl ? [{ url: comicUrl, kind: "invite-panel" }] : [],
            round: null,
        });
    }

    return NextResponse.json({ ok: true, code, comic_url: comicUrl });
}
