import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { adjustBamf, hasLedgerReason } from "@/lib/bamf";

export const runtime = "nodejs";

// Daily faucet: +25 $BAMF on first authenticated request per UTC day.
// Wired into nav-shell's balance fetch — it POSTs here once per mount, and
// this route is idempotent (checks the ledger for today's 'faucet' row
// before minting another one), so re-mounts / refreshes are harmless.
export async function POST() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const service = createServiceClient();
    if (!service) return NextResponse.json({ error: "service role key needed" }, { status: 501 });

    const already = await hasLedgerReason(service, user.id, "faucet", { sinceUtcMidnight: true });
    if (already) {
        const { data: profile } = await service.from("afwar_profiles").select("bamf").eq("id", user.id).maybeSingle();
        return NextResponse.json({ granted: false, balance: (profile as { bamf: number } | null)?.bamf ?? 0 });
    }

    const result = await adjustBamf(service, user.id, 25, "faucet");
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

    return NextResponse.json({ granted: true, balance: result.balance });
}
