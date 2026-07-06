import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { heuristicIntent, playRound } from "@/lib/engine/season";
import type { PCDef } from "@/lib/engine/season";
import { makeRng } from "@/lib/engine/rng";
import { serializeSeasonState, deserializeSeasonState } from "@/lib/serialize";
import { narrateMatch, judgeMatch, gazetteRecap } from "@/lib/agents/narrate";
import type { Telling, Verdict } from "@/lib/agents/narrate";
import type { Season, Character, Direction } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// The GM trigger seam. Resolves one round: engine (heuristicIntent + playRound),
// then the narration cascade (narrateMatch x2 + judgeMatch per match, gazetteRecap
// for the round), then clout awards. Every LLM step is individually tolerant of
// failure — a bad/slow model response degrades that one match to transcript-only,
// it never aborts the round. Requires the service-role key because RLS restricts
// writes to afwar_seasons/matches/posts/canon_events to service_role (see db/schema.sql).
export async function POST() {
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
    const intent = heuristicIntent(state, rng);
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

    function toPCDef(c: Character): PCDef {
        const direction = directions.get(c.id);
        const directorNote = direction
            ? `\n\nDIRECTOR'S NOTE (from your creator): ${direction.gambit ?? ""}${
                  direction.tone_note ? ` — tone: ${direction.tone_note}` : ""
              }`
            : "";
        return {
            id: c.id,
            name: c.name,
            crewId: c.crew_id ?? "",
            stats: c.stats,
            attackAbility: c.attack_ability,
            power: c.power?.name ? { name: c.power.name, level: c.power.level } : undefined,
            policy: c.policy,
            bio: (c.bio ?? "") + directorNote,
            modelSheetHint: "",
        };
    }

    // persist matches (with narration cascade)
    for (const m of report.matches) {
        const aChar = characters.get(m.a);
        const bChar = characters.get(m.b);

        let tellings: Telling[] = [];
        let verdict: Verdict | null = null;

        if (aChar && bChar) {
            const aDef = toPCDef(aChar);
            const bDef = toPCDef(bChar);

            const [aTelling, bTelling] = await Promise.all([
                narrateMatch(aDef, bDef, m, report.round).catch((e) => {
                    console.error(`[gm/resolve] narrateMatch failed for ${aChar.name}:`, e);
                    return null;
                }),
                narrateMatch(bDef, aDef, m, report.round).catch((e) => {
                    console.error(`[gm/resolve] narrateMatch failed for ${bChar.name}:`, e);
                    return null;
                }),
            ]);

            tellings = [aTelling, bTelling].filter((t): t is Telling => t !== null);

            if (aTelling && bTelling) {
                try {
                    verdict = await judgeMatch(aTelling, bTelling, m, aChar.name, bChar.name);
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

        await supabase.from("afwar_posts").insert({
            season_id: season.id,
            author_character: null,
            kind: "match",
            title,
            body: excerpt,
            media: insertedMatch ? [{ match_id: insertedMatch.id }] : [],
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
        const gazette = await gazetteRecap(report.round, report.events, namesMap);
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
