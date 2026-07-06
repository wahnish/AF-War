import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireGm } from "@/lib/role";
import { runDowntimePass } from "@/lib/gm";

export const runtime = "nodejs";
export const maxDuration = 300;

// Downtime pass: a handful of random active characters post slice-of-life
// beats, with a chance of a reply. Core logic lives in lib/gm.ts's
// runDowntimePass so /api/gm/tick (cron) can share the exact same path.
// Role-gated: caller must be profiles.role='gm' (schema-002 §5).
export async function POST() {
    const gate = await requireGm();
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const supabase = createServiceClient();
    if (!supabase) {
        return NextResponse.json({ error: "service role key needed" }, { status: 501 });
    }

    try {
        const result = await runDowntimePass(supabase);
        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "downtime pass failed" }, { status: 400 });
    }
}
