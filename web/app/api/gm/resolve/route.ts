import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { heuristicIntent, playRound } from "@/lib/engine/season";
import { makeRng } from "@/lib/engine/rng";
import { serializeSeasonState, deserializeSeasonState } from "@/lib/serialize";
import type { Season } from "@/lib/types";

export const runtime = "nodejs";

// The GM trigger seam. v1: engine-only round resolution with heuristicIntent
// (no LLM narration/judging cascade yet — that wires in next). Requires the
// service-role key because RLS restricts writes to afwar_seasons/matches/posts/
// canon_events to service_role (see db/schema.sql).
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

    // persist matches
    for (const m of report.matches) {
        await supabase.from("afwar_matches").insert({
            season_id: season.id,
            round: report.round,
            zone_id: m.zoneId,
            stakes: m.stakes,
            a_character: m.a,
            b_character: m.b,
            dice_transcript: m,
            tellings: [],
            verdict: null,
            winner: m.winner,
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

    // a system post recapping the round (Gazette narration cascade wires in later)
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
