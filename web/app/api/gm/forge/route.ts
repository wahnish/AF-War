import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireGm } from "@/lib/role";
import { forgeItem } from "@/lib/loot";
import { deserializeSeasonState } from "@/lib/serialize";
import type { Season } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Manual season-loot forge (final polish round §4) — same forgeItem() core
// the cron tick rolls at 30% chance per round; this route lets the GM force
// one on demand (console "Forge season loot item" button). Also allows the
// cron bearer token so it can be scripted independently of the tick if
// needed later.
export async function POST(req: Request) {
    const auth = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;

    if (!isCron) {
        const gate = await requireGm();
        if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

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
    const season = seasonRow as Season | null;
    if (!season) return NextResponse.json({ error: "no season found" }, { status: 404 });
    if (!season.state) return NextResponse.json({ error: "season has no state" }, { status: 400 });

    const state = deserializeSeasonState(season.state as never);

    try {
        await forgeItem(supabase, season.id, state);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "forge failed" }, { status: 500 });
    }
}
