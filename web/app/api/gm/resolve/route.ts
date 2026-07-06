import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireGm } from "@/lib/role";
import { resolveRound } from "@/lib/gm";
import type { Season } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// The GM trigger seam. Resolves one round via lib/gm.ts's resolveRound —
// the actual engine + narration cascade + comic/bet/loot side effects live
// there so /api/gm/tick (cron) can share the exact same code path.
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

    try {
        const result = await resolveRound(supabase, season.id, { agentIntents: useAgentIntents });
        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "resolve failed" }, { status: 400 });
    }
}
