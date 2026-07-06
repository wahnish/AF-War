import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireGm } from "@/lib/role";
import { heuristicIntent, playRound, attackableZones } from "@/lib/engine/season";
import type { PCDef, RoundIntent } from "@/lib/engine/season";
import { makeRng } from "@/lib/engine/rng";
import { serializeSeasonState, deserializeSeasonState } from "@/lib/serialize";
import { narrateMatch, judgeMatch, gazetteRecap } from "@/lib/agents/narrate";
import type { Telling, Verdict } from "@/lib/agents/narrate";
import type { Season, Character, Direction } from "@/lib/types";
import { crewIntent } from "@/lib/agents/strategist";
import { settleBets } from "@/lib/bets";
import { maybeRenderComic } from "@/lib/comic";

export const runtime = "nodejs";
export const maxDuration = 300;

// The GM trigger seam. Resolves one round: engine (heuristicIntent + playRound),
// then the narration cascade (narrateMatch x2 + judgeMatch per match, gazetteRecap
// for the round), then clout awards. Every LLM step is individually tolerant of
// failure — a bad/slow model response degrades that one match to transcript-only,
// it never aborts the round. Requires the service-role key because RLS restricts
// writes to afwar_seasons/matches/posts/canon_events to service_role (see db/schema.sql).
// Role-gated: caller must be profiles.role='gm' (schema-002 §5).
export async function POST(req: Request) {
    const gate = await requireGm();
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await req.json().catch(() => ({} as { agentIntents?: boolean }));
    const useAgentIntents = Boolean((body as { agentIntents?: boolean }).agentIntents);

    const supabase = createServiceClient();
    if (!supabase) {
        return NextResponse.json({ error: "service role key needed" }, { status: 501 });
    }

    const { data: seasonRow, error: seasonErr } = await supabase
        .from("afwar_seasons")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (seasonErr) return NextResponse.json({ error: seasonErr.message }, { status: 500 });
    if (!seasonRow) return NextResponse.json({ error: "no season found" }, { status: 404 });

    const season = seasonRow as Season;
    if (!season.state) return NextResponse.json({ error: "season has no state" }, { status: 400 });

    const state = deserializeSeasonState(season.state as never);
    if (state.finished) {
        return NextResponse.json({ error: "season is already finished" }, { status: 400 });
    }

    const rng = makeRng(`${state.seed}:gm:${state.round + 1}`);

    let intent: RoundIntent;
    const warCouncilPosts: { crewId: string; crewName: string; reasoning: string }[] = [];
    if (useAgentIntents) {
        // one LLM call per live crew: build RoundIntent from per-crew agent
        // decisions, validating targets against attackableZones — invalid
        // targets (or any error) fall back to the heuristic for that crew.
        const fallback = heuristicIntent(state, rng);
        const attacks: RoundIntent["attacks"] = [];
        const allianceProposals: RoundIntent["allianceProposals"] = [];
        const recentCanon = state.canon
            .slice(-8)
            .map((e) => JSON.stringify(e))
            .join("\n");

        for (const crew of state.crews.values()) {
            if (crew.eliminated) continue;
            const fighters = [...state.pcs.values()].filter((p) => p.crewId === crew.id && p.status === "active");
            if (!fighters.length) continue;
            const zoneIds = attackableZones(state, crew.id);
            const otherCrews = [...state.crews.values()]
                .filter((c) => c.id !== crew.id && !c.eliminated)
                .map((c) => ({
                    id: c.id,
                    name: c.name,
                    motto: c.motto,
                    zones: c.zones,
                    fighters: [],
                    alliances: c.alliances,
                    gravesEndCredit: c.gravesEndCredit,
                }));

            try {
                const result = await crewIntent(
                    {
                        id: crew.id,
                        name: crew.name,
                        motto: crew.motto,
                        zones: crew.zones,
                        fighters: fighters.map((f) => ({ id: f.id, name: f.id, hp: f.hp, kills: f.kills })),
                        alliances: crew.alliances,
                        gravesEndCredit: crew.gravesEndCredit,
                    },
                    zoneIds,
                    otherCrews,
                    recentCanon
                );
                if (result.attacks.length) {
                    for (const a of result.attacks) attacks.push({ crewId: crew.id, pcId: a.pcId, targetZone: a.targetZone, stakes: a.stakes });
                } else {
                    // no valid attack from the agent — fall back to heuristic for this crew
                    attacks.push(...fallback.attacks.filter((a) => a.crewId === crew.id));
                }
                if (result.allianceProposal) allianceProposals.push([crew.id, result.allianceProposal]);
                if (result.reasoning) warCouncilPosts.push({ crewId: crew.id, crewName: crew.name, reasoning: result.reasoning });
            } catch (e) {
                console.error(`[gm/resolve] crewIntent failed for ${crew.name}, falling back to heuristic:`, e);
                attacks.push(...fallback.attacks.filter((a) => a.crewId === crew.id));
            }
        }
        intent = { attacks, allianceProposals, resurrections: fallback.resurrections };
    } else {
        intent = heuristicIntent(state, rng);
    }

    const report = playRound(state, intent);

    const nowIso = new Date().toISOString();

    // Gather every character id involved this round (both sides of every match)
    // so we can fetch DB rows once, adapt to PCDef for narration, and build the
    // names map the gazette needs.
    const charIds = Array.from(new Set(report.matches.flatMap((m) => [m.a, m.b])));
    const { data: charRows } = charIds.length
        ? await supabase.from("afwar_characters").select("*").in("id", charIds)
        : { data: [] as Character[] };
    const characters = new Map<string, Character>((charRows ?? []).map((c: Character) => [c.id, c]));

    // crew names for the gazette's names map (canon events reference crew ids too)
    const crewIds = Array.from(new Set((charRows ?? []).map((c: Character) => c.crew_id).filter(Boolean))) as string[];
    const { data: crewRows } = crewIds.length
        ? await supabase.from("afwar_crews").select("id,name").in("id", crewIds)
        : { data: [] as { id: string; name: string }[] };
    const crewNames = new Map<string, string>((crewRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

    // directions submitted for THIS round, keyed by character_id
    const { data: directionRows } = await supabase
        .from("afwar_directions")
        .select("*")
        .eq("season_id", season.id)
        .eq("round", report.round)
        .in("character_id", charIds.length ? charIds : ["00000000-0000-0000-0000-000000000000"]);
    const directions = new Map<string, Direction>((directionRows ?? []).map((d: Direction) => [d.character_id, d]));

    // BYO agent keys (schema-002 §2): owners' profiles, keyed by owner_id,
    // so narration can use each character's OWNER's key+model when
    // model_tier='byo'. Judge/gazette/downtime stay on the house key.
    const ownerIds = Array.from(new Set((charRows ?? []).map((c: Character) => c.owner_id).filter(Boolean))) as string[];
    const { data: ownerRows } = ownerIds.length
        ? await supabase.from("afwar_profiles").select("id, openrouter_key, model_tier, model_name").in("id", ownerIds)
        : { data: [] as { id: string; openrouter_key: string | null; model_tier: string; model_name: string | null }[] };
    const ownerProfiles = new Map<string, { openrouter_key: string | null; model_tier: string; model_name: string | null }>(
        (ownerRows ?? []).map((p: { id: string; openrouter_key: string | null; model_tier: string; model_name: string | null }) => [p.id, p])
    );

    function llmOverrideFor(c: Character): { key?: string; model?: string } | undefined {
        const profile = ownerProfiles.get(c.owner_id);
        if (!profile || profile.model_tier !== "byo" || !profile.openrouter_key) return undefined;
        return { key: profile.openrouter_key, model: profile.model_name || undefined };
    }

    // Canon Cast wiring (schema-002 §1): active canon_cast rows whose name
    // appears in a match's context get their canon notes appended to
    // narration's system-prompt-adjacent bio text so behavior corrections
    // are obeyed (e.g. "Raze never apologizes; he issues corrections.").
    const { data: canonCastRows } = await supabase
        .from("afwar_canon_cast")
        .select("name, canon_notes")
        .eq("active", true);
    const canonCast = (canonCastRows ?? []) as { name: string; canon_notes: { date: string; note: string }[] }[];

    function canonNotesFor(text: string): string {
        const hits = canonCast.filter((c) => c.name && text.includes(c.name) && c.canon_notes?.length);
        if (!hits.length) return "";
        const lines = hits.flatMap((c) => c.canon_notes.map((n) => `${c.name}: ${n.note}`));
        return `\n\nCANON NOTES (behavior corrections, obey strictly): ${lines.join(" | ")}`;
    }

    function toPCDef(c: Character): PCDef {
        const direction = directions.get(c.id);
        const directorNote = direction
            ? `\n\nDIRECTOR'S NOTE (from your creator): ${direction.gambit ?? ""}${
                  direction.tone_note ? ` — tone: ${direction.tone_note}` : ""
              }`
            : "";
        const factionNote = c.faction ? `\n\nFACTION: ${c.faction}` : "";
        const bioWithContext = (c.bio ?? "") + directorNote + factionNote;
        return {
            id: c.id,
            name: c.name,
            crewId: c.crew_id ?? "",
            stats: c.stats,
            attackAbility: c.attack_ability,
            power: c.power?.name ? { name: c.power.name, level: c.power.level } : undefined,
            policy: c.policy,
            bio: bioWithContext + canonNotesFor(bioWithContext + c.name),
            modelSheetHint: "",
        };
    }

    // persist matches (with narration cascade). Track each match's max
    // entertainment score so we can pick the round's single highest-scored
    // match for comic rendering after the loop (death-stakes matches always
    // qualify regardless of score — see lib/comic.ts isComicEligible).
    let bestMatchId: string | null = null;
    let bestScore = -1;
    const comicCandidates: { matchId: string; m: (typeof report.matches)[number]; tellings: Telling[]; verdict: Verdict | null; aChar?: Character; bChar?: Character }[] = [];

    for (const m of report.matches) {
        const aChar = characters.get(m.a);
        const bChar = characters.get(m.b);

        let tellings: Telling[] = [];
        let verdict: Verdict | null = null;

        if (aChar && bChar) {
            const aDef = toPCDef(aChar);
            const bDef = toPCDef(bChar);

            const [aTelling, bTelling] = await Promise.all([
                narrateMatch(aDef, bDef, m, report.round, llmOverrideFor(aChar)).catch((e) => {
                    console.error(`[gm/resolve] narrateMatch failed for ${aChar.name}:`, e);
                    return null;
                }),
                narrateMatch(bDef, aDef, m, report.round, llmOverrideFor(bChar)).catch((e) => {
                    console.error(`[gm/resolve] narrateMatch failed for ${bChar.name}:`, e);
                    return null;
                }),
            ]);

            tellings = [aTelling, bTelling].filter((t): t is Telling => t !== null);

            if (aTelling && bTelling) {
                try {
                    verdict = await judgeMatch(aTelling, bTelling, m, aChar.name, bChar.name, canonNotesFor(`${aChar.name} ${bChar.name}`));
                } catch (e) {
                    console.error(`[gm/resolve] judgeMatch failed for match ${m.a} vs ${m.b}:`, e);
                }
            }
        } else {
            console.error(`[gm/resolve] missing character row(s) for match ${m.a} vs ${m.b} — transcript-only`);
        }

        const { data: insertedMatch } = await supabase
            .from("afwar_matches")
            .insert({
                season_id: season.id,
                round: report.round,
                zone_id: m.zoneId,
                stakes: m.stakes,
                a_character: m.a,
                b_character: m.b,
                dice_transcript: m,
                tellings,
                verdict,
                winner: m.winner,
            })
            .select("id")
            .single();

        // clout awards from the verdict's entertainment scores
        if (verdict) {
            for (const [pcId, score] of Object.entries(verdict.scores)) {
                const c = characters.get(pcId);
                if (!c) continue;
                const { data: current } = await supabase
                    .from("afwar_characters")
                    .select("clout")
                    .eq("id", pcId)
                    .maybeSingle();
                const existingClout = (current as { clout: number } | null)?.clout ?? c.clout ?? 0;
                await supabase
                    .from("afwar_characters")
                    .update({ clout: existingClout + score })
                    .eq("id", pcId);
            }
            const maxScore = Math.max(...Object.values(verdict.scores));
            if (insertedMatch && maxScore > bestScore) {
                bestScore = maxScore;
                bestMatchId = insertedMatch.id;
            }
        }

        if (insertedMatch) {
            comicCandidates.push({ matchId: insertedMatch.id, m, tellings, verdict, aChar, bChar });
        }

        // a 'match' feed post, canon telling first (or A as fallback)
        const canonTelling =
            (verdict && tellings.find((t) => t.pcId === verdict!.canonPcId)) ?? tellings[0] ?? null;
        const title = canonTelling?.title ?? `${aChar?.name ?? m.a} vs ${bChar?.name ?? m.b}`;
        const excerpt = canonTelling
            ? canonTelling.prose.length > 380
                ? canonTelling.prose.slice(0, 380) + "…"
                : canonTelling.prose
            : `${aChar?.name ?? m.a} and ${bChar?.name ?? m.b} threw down — dice-only record, narration unavailable this round.`;

        const { data: insertedPost } = await supabase
            .from("afwar_posts")
            .insert({
                season_id: season.id,
                author_character: null,
                kind: "match",
                title,
                body: excerpt,
                media: insertedMatch ? [{ match_id: insertedMatch.id }] : [],
                round: report.round,
            })
            .select("id")
            .single();

        // stash the post id alongside the comic candidate so we can patch
        // its media array with comic page URLs once rendering finishes below
        if (insertedPost && insertedMatch) {
            const cand = comicCandidates.find((c) => c.matchId === insertedMatch.id);
            if (cand) (cand as typeof cand & { postId?: string }).postId = insertedPost.id;
        }
    }

    // Comic auto-render (schema-002 §3): the round's single highest-scored
    // match, plus any death-stakes match. Tolerant of failure per match —
    // a bad render never blocks the round from finishing.
    for (const cand of comicCandidates) {
        const isRoundBest = cand.matchId === bestMatchId;
        if (cand.m.stakes !== "death" && !isRoundBest) continue;
        const canonTelling =
            (cand.verdict && cand.tellings.find((t) => t.pcId === cand.verdict!.canonPcId)) ?? cand.tellings[0];
        if (!canonTelling || !cand.aChar || !cand.bChar) continue;

        const pages = await maybeRenderComic(
            supabase,
            {
                matchId: cand.matchId,
                round: report.round,
                result: cand.m,
                canonTelling,
                aName: cand.aChar.name,
                aBio: cand.aChar.bio ?? "",
                aSheetUrl: cand.aChar.model_sheet_url,
                bName: cand.bChar.name,
                bBio: cand.bChar.bio ?? "",
                bSheetUrl: cand.bChar.model_sheet_url,
            },
            cand.verdict,
            isRoundBest
        );

        if (pages.length) {
            const media = pages.map((url) => ({ url, kind: "comic-page" }));
            await supabase.from("afwar_matches").update({ media }).eq("id", cand.matchId);
            const postId = (cand as typeof cand & { postId?: string }).postId;
            if (postId) {
                await supabase
                    .from("afwar_posts")
                    .update({ media: [{ match_id: cand.matchId }, ...media] })
                    .eq("id", postId);
            }
        }
    }

    // Betting settlement (schema-002 §4): character won any match this round -> 2x payout
    try {
        await settleBets(supabase, season.id, report.round, report.matches);
    } catch (e) {
        console.error(`[gm/resolve] settleBets failed for round ${report.round}:`, e);
    }

    // War Council posts (schema-002 §6) — one per crew that used agent intents
    for (const wc of warCouncilPosts) {
        await supabase.from("afwar_posts").insert({
            season_id: season.id,
            author_character: null,
            kind: "downtime",
            title: `War Council — ${wc.crewName}`,
            body: wc.reasoning,
            media: [],
            round: report.round,
        });
    }

    // persist canon events
    if (report.events.length) {
        await supabase.from("afwar_canon_events").insert(
            report.events.map((event) => ({
                season_id: season.id,
                round: report.round,
                event,
            }))
        );
    }

    // Gazette recap — names map covers every character + crew touched this round
    const namesMap = new Map<string, string>();
    for (const c of characters.values()) namesMap.set(c.id, c.name);
    for (const [id, name] of crewNames) namesMap.set(id, name);
    for (const crew of state.crews.values()) namesMap.set(crew.id, crew.name);
    for (const pc of state.pcs.values()) namesMap.set(pc.id, pc.name);

    try {
        const gazetteNotes = canonNotesFor(Array.from(namesMap.values()).join(" "));
        const gazette = await gazetteRecap(report.round, report.events, namesMap, gazetteNotes);
        await supabase.from("afwar_posts").insert({
            season_id: season.id,
            author_character: null,
            kind: "gazette",
            title: `Round ${report.round} — Hyper-Brooklyn Gazette`,
            body: gazette,
            media: [],
            round: report.round,
        });
    } catch (e) {
        console.error(`[gm/resolve] gazetteRecap failed for round ${report.round}:`, e);
    }

    // a system post recapping the round (kept for the raw-numbers audit trail)
    await supabase.from("afwar_posts").insert({
        season_id: season.id,
        author_character: null,
        kind: "system",
        title: `Round ${report.round} resolved`,
        body: `${report.matches.length} match(es), ${report.corrupted.length} zone(s) corrupted, ${report.events.length} canon event(s). Scores: ${JSON.stringify(report.scores)}`,
        media: [],
        round: report.round,
    });

    const { error: updateErr } = await supabase
        .from("afwar_seasons")
        .update({
            state: serializeSeasonState(state),
            status: state.finished ? "finished" : "active",
        })
        .eq("id", season.id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ round: report.round, matches: report.matches.length, events: report.events.length, nowIso });
}
