// Referral completion (growth-spec §2e / item 3). Runs once, at the moment
// a brand-new afwar_profiles row is created for a user — that's the signup-
// completion signal ("no existing profile row" = first time we've seen this
// auth.users id). Call from /auth/callback right after the session exchange.
//
// Pragmatic scope note: this ALSO fixes a latent gap in the pre-existing
// app — there was no code path anywhere that ever inserted an
// afwar_profiles row (schema.sql's "profiles: insert self" RLS policy
// existed but nothing called it), so profile rows for real users may not
// have existed at all before this round. ensureProfile() below is now the
// one seam that creates them, service-role, so it can run unconditionally
// on every login without fighting RLS.
import type { SupabaseClient } from "@supabase/supabase-js";
import { adjustBamf } from "./bamf";

const REFERRAL_BONUS = 25; // faucet-sized grant, per growth-spec §2e

export interface EnsureProfileResult {
    created: boolean;
}

/** Idempotent: creates the caller's afwar_profiles row if missing. Returns
 * whether this call is the one that created it (the activation signal). */
export async function ensureProfile(service: SupabaseClient, userId: string): Promise<EnsureProfileResult> {
    const { data: existing } = await service.from("afwar_profiles").select("id").eq("id", userId).maybeSingle();
    if (existing) return { created: false };

    const { error } = await service.from("afwar_profiles").insert({ id: userId });
    if (error) {
        // race: another request created it first, or a genuine failure —
        // either way, treat as "not newly created" rather than throwing,
        // since a missing referral bonus is much less bad than a broken login.
        console.error("[referral] ensureProfile insert failed:", error.message);
        return { created: false };
    }
    return { created: true };
}

interface InviteRow {
    id: string;
    code: string;
    inviter_id: string;
    crew_id: string | null;
    kind: string;
    uses: number;
    max_uses: number;
}

/** Applies the af_invite cookie's referral effects on first profile creation:
 * +25 $BAMF to both inviter and new user, crew auto-join if kind==='crew'
 * and the crew has room, and increments the invite's uses (capped at
 * max_uses, checked server-side). Never throws past the caller — a failed
 * referral bonus should never break login. */
export async function applyReferral(service: SupabaseClient, newUserId: string, inviteCode: string): Promise<void> {
    try {
        const { data: inviteRow } = await service.from("afwar_invites").select("*").eq("code", inviteCode).maybeSingle();
        const invite = inviteRow as InviteRow | null;
        if (!invite) return;
        if (invite.uses >= invite.max_uses) return;
        if (invite.inviter_id === newUserId) return; // can't refer yourself

        await adjustBamf(service, invite.inviter_id, REFERRAL_BONUS, "referral_bonus", invite.id);
        await adjustBamf(service, newUserId, REFERRAL_BONUS, "referral_reward", invite.id);

        if (invite.kind === "crew" && invite.crew_id) {
            const { data: crewRow } = await service.from("afwar_crews").select("max_size").eq("id", invite.crew_id).maybeSingle();
            const maxSize = (crewRow as { max_size: number } | null)?.max_size ?? 6;
            const { count } = await service
                .from("afwar_characters")
                .select("id", { count: "exact", head: true })
                .eq("crew_id", invite.crew_id);
            if ((count ?? 0) < maxSize) {
                await service.from("afwar_characters").update({ crew_id: invite.crew_id }).eq("owner_id", newUserId).is("crew_id", null);
            }
        }

        await service.from("afwar_invites").update({ uses: invite.uses + 1 }).eq("id", invite.id);
    } catch (e) {
        console.error("[referral] applyReferral failed:", e);
    }
}
