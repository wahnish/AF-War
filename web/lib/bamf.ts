// $BAMF beta economy — play-money loops, no Stripe (final polish round §1).
// EVERY $BAMF mutation goes through adjustBamf(): it updates the cached
// profiles.bamf balance AND appends an afwar_bamf_ledger row in the same
// call, and refuses to let a balance go negative. Callers use the
// service-role client (RLS on afwar_bamf_ledger only allows service_role
// writes + owner-read, matching the bets/matches pattern in schema.sql).
import type { SupabaseClient } from "@supabase/supabase-js";

export type BamfReason =
    | "faucet"
    | "tip_sent"
    | "tip_received"
    | "comic_render"
    | "sheet_gen"
    | "bet_stake"
    | "bet_payout"
    | "admin_adjust";

export interface AdjustBamfResult {
    ok: boolean;
    balance: number;
    error?: string;
}

/**
 * Adjust a user's $BAMF balance by `delta` (negative = spend, positive =
 * earn) and record the ledger row. Rejects (ok:false, no mutation) if the
 * resulting balance would go negative. Not a DB transaction (Supabase JS
 * has no multi-statement tx client-side) — we read-then-write, which is
 * fine for this beta's traffic; a real-money version would need a Postgres
 * function with row locking instead.
 */
export async function adjustBamf(
    supabase: SupabaseClient,
    userId: string,
    delta: number,
    reason: BamfReason,
    refId?: string
): Promise<AdjustBamfResult> {
    const { data: profile, error: fetchErr } = await supabase
        .from("afwar_profiles")
        .select("bamf")
        .eq("id", userId)
        .maybeSingle();

    if (fetchErr) return { ok: false, balance: 0, error: fetchErr.message };

    const current = (profile as { bamf: number } | null)?.bamf ?? 0;
    const next = current + delta;
    if (next < 0) return { ok: false, balance: current, error: "insufficient $BAMF balance" };

    const { error: updateErr } = await supabase.from("afwar_profiles").update({ bamf: next }).eq("id", userId);
    if (updateErr) return { ok: false, balance: current, error: updateErr.message };

    const { error: ledgerErr } = await supabase.from("afwar_bamf_ledger").insert({
        user_id: userId,
        delta,
        reason,
        ref_id: refId ?? null,
    });
    if (ledgerErr) {
        // best-effort rollback of the balance update so the ledger stays the
        // source of truth's mirror; if THIS also fails we log and move on —
        // a missing ledger row is recoverable from an admin_adjust later,
        // an un-rolled-back balance is the worse failure mode.
        await supabase.from("afwar_profiles").update({ bamf: current }).eq("id", userId);
        return { ok: false, balance: current, error: ledgerErr.message };
    }

    return { ok: true, balance: next };
}

/** Has this user already received a ledger row of `reason` (optionally
 * scoped to today UTC)? Used for the daily faucet + first-generation-free
 * sheet-gen pricing checks. */
export async function hasLedgerReason(
    supabase: SupabaseClient,
    userId: string,
    reason: BamfReason,
    opts?: { sinceUtcMidnight?: boolean }
): Promise<boolean> {
    let query = supabase
        .from("afwar_bamf_ledger")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("reason", reason);

    if (opts?.sinceUtcMidnight) {
        const now = new Date();
        const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
        query = query.gte("created_at", utcMidnight);
    }

    const { count, error } = await query;
    if (error) return false;
    return (count ?? 0) > 0;
}
