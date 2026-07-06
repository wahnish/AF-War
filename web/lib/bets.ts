// Betting at the Arcades — settlement (schema-002 §4). Bets are placed on a
// CHARACTER per round ("who wins any match this round"). After a round
// resolves: character won any match this round -> bettors on them get paid
// 2x; otherwise (lost or didn't fight) bettors lose the stake.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchResult } from "./engine/match";

export async function settleBets(
    supabase: SupabaseClient,
    seasonId: string,
    round: number,
    matches: MatchResult[]
): Promise<{ settled: number; paid: number }> {
    const { data: openBets } = await supabase
        .from("afwar_bets")
        .select("*")
        .eq("season_id", seasonId)
        .eq("round", round)
        .eq("status", "open");

    const bets = (openBets ?? []) as { id: string; user_id: string; on_character: string; amount: number }[];
    if (!bets.length) return { settled: 0, paid: 0 };

    const winners = new Set(matches.map((m) => m.winner));

    let paid = 0;
    for (const bet of bets) {
        const won = winners.has(bet.on_character);
        await supabase.from("afwar_bets").update({ status: won ? "won" : "lost" }).eq("id", bet.id);
        if (won) {
            const payout = bet.amount * 2;
            const { data: profile } = await supabase
                .from("afwar_profiles")
                .select("bamf")
                .eq("id", bet.user_id)
                .maybeSingle();
            const current = (profile as { bamf: number } | null)?.bamf ?? 0;
            await supabase.from("afwar_profiles").update({ bamf: current + payout }).eq("id", bet.user_id);
            paid += payout;
        }
    }

    return { settled: bets.length, paid };
}
