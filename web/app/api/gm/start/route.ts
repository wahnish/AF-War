import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { setupSeason } from "@/lib/engine/season";
import type { PCDef, SeasonConfig } from "@/lib/engine/season";
import { serializeSeasonState } from "@/lib/serialize";
import type { Character } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Starts a new season from every currently 'active' afwar_characters row.
// Characters with a crew_id join their crew; characters without one become
// a solo 1-PC crew named after themselves (crew id = character id).
export async function POST() {
    const supabase = createServiceClient();
    if (!supabase) {
        return NextResponse.json({ error: "service role key needed" }, { status: 501 });
    }

    const { data: charRows, error: charsErr } = await supabase
        .from("afwar_characters")
        .select("*")
        .eq("status", "active");
    if (charsErr) return NextResponse.json({ error: charsErr.message }, { status: 500 });

    const characters = (charRows ?? []) as Character[];
    if (characters.length === 0) {
        return NextResponse.json({ error: "no active characters — draft some in the Barracks first" }, { status: 400 });
    }

    const crewIds = Array.from(new Set(characters.map((c) => c.crew_id).filter(Boolean))) as string[];
    const { data: crewRows, error: crewsErr } = crewIds.length
        ? await supabase.from("afwar_crews").select("*").in("id", crewIds)
        : { data: [] as { id: string; name: string; motto: string | null }[], error: null };
    if (crewsErr) return NextResponse.json({ error: crewsErr.message }, { status: 500 });

    const knownCrews = new Map<string, { id: string; name: string; motto: string | null }>(
        (crewRows ?? []).map((c: { id: string; name: string; motto: string | null }) => [c.id, c])
    );

    const crews: { id: string; name: string; motto: string }[] = [];
    const seenCrewIds = new Set<string>();
    const pcs: PCDef[] = [];

    for (const c of characters) {
        const crewId = c.crew_id ?? c.id;
        if (!seenCrewIds.has(crewId)) {
            seenCrewIds.add(crewId);
            const known = c.crew_id ? knownCrews.get(c.crew_id) : undefined;
            crews.push({
                id: crewId,
                name: known?.name ?? c.name,
                motto: known?.motto ?? "",
            });
        }
        pcs.push({
            id: c.id,
            name: c.name,
            crewId,
            stats: c.stats,
            attackAbility: c.attack_ability,
            power: c.power?.name ? { name: c.power.name, level: c.power.level } : undefined,
            policy: c.policy,
            bio: c.bio ?? "",
            modelSheetHint: c.model_sheet_url ?? "",
        });
    }

    const seed = `season-${Date.now()}`;
    const rounds = 6;
    // matches sim/run.ts's shape: escalating corruption per round, starting round 2
    const corruptionPerRound: Record<number, number> = {};
    for (let r = 2; r <= rounds; r++) corruptionPerRound[r] = r - 1;

    const cfg: SeasonConfig = {
        seed,
        playerCount: pcs.length,
        crews,
        pcs,
        rounds,
        corruptionPerRound,
    };

    const state = setupSeason(cfg);

    const { count: existingCount } = await supabase
        .from("afwar_seasons")
        .select("id", { count: "exact", head: true });

    const { data: seasonRow, error: insertErr } = await supabase
        .from("afwar_seasons")
        .insert({
            name: `Season ${(existingCount ?? 0) + 1}`,
            config: {},
            state: serializeSeasonState(state),
            status: "active",
        })
        .select("*")
        .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ season: seasonRow });
}
