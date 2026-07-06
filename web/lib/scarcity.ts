// Scarcity surface (growth-spec §2f / item 5): honest, no fake countdown.
// activeZones mirrors the R16 Glome-breathing heuristic (HANDOFF.md):
// max(8, 6 + ceil(players * 1.2)). currentCharacterCount is the count of
// afwar_characters where status='active' — season_id doesn't exist on
// afwar_characters (per the brief, we don't invent one), so this is an
// honest proxy across the whole game rather than scoped to "this season".
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ScarcityResult {
    line: string;
    remaining: number | null; // null when there's no active season
}

function activeZonesFor(playerCount: number): number {
    return Math.max(8, 6 + Math.ceil(playerCount * 1.2));
}

export async function computeScarcity(supabase: SupabaseClient): Promise<ScarcityResult> {
    const [{ data: season }, { count: activeCount }] = await Promise.all([
        supabase.from("afwar_seasons").select("status").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("afwar_characters").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);

    const seasonStatus = (season as { status: string } | null)?.status;
    const activeCharacterCount = activeCount ?? 0;

    if (seasonStatus !== "active") {
        return { line: "The Glome is quiet. Season 2 forms soon.", remaining: null };
    }

    const playerCount = activeCharacterCount || 1;
    const activeZones = activeZonesFor(playerCount);
    const remaining = Math.max(0, activeZones * 3 - activeCharacterCount);
    return { line: `${remaining} APE Passes remaining this season`, remaining };
}
