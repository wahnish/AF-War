import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireGm } from "@/lib/role";
import { resolveRound, runDowntimePass } from "@/lib/gm";
import type { Season } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// The autonomous GM (final polish round §3 — "the game runs itself").
// Two ways in:
//   1. Vercel Cron — Authorization: Bearer ${CRON_SECRET} (see web/vercel.json,
//      daily 15:00 UTC). This is how the season advances with nobody at the
//      keyboard.
//   2. A signed-in GM session — lets Todd hit "Tick now" from /gm for manual
//      testing without needing the cron secret locally.
//
// Logic: load the active season. No active season -> 200 no-op. Finished ->
// 200 no-op. Otherwise alternate phases using season.config.lastTick +
// config.cadenceHours (default 24): if the last tick was a resolve, this one
// is a downtime pass, and vice versa (first-ever tick resolves). Every tick
// updates config.lastTick + config.lastPhase so the next tick knows which
// phase comes next.
export async function GET(req: Request) {
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
    if (!season) return NextResponse.json({ ok: true, note: "no active season" });
    if (season.status === "finished") return NextResponse.json({ ok: true, note: "season finished" });

    const config = (season.config ?? {}) as { lastTick?: string; lastPhase?: "resolve" | "downtime"; cadenceHours?: number };
    const cadenceHours = config.cadenceHours ?? 24;

    if (config.lastTick) {
        const elapsedHours = (Date.now() - new Date(config.lastTick).getTime()) / (1000 * 60 * 60);
        if (elapsedHours < cadenceHours) {
            return NextResponse.json({
                ok: true,
                note: `too soon — last tick ${elapsedHours.toFixed(1)}h ago, cadence is ${cadenceHours}h`,
            });
        }
    }

    // alternate phases: resolve, then downtime, then resolve, ...
    const nextPhase: "resolve" | "downtime" = config.lastPhase === "resolve" ? "downtime" : "resolve";

    try {
        const result =
            nextPhase === "resolve"
                ? await resolveRound(supabase, season.id, { agentIntents: true })
                : await runDowntimePass(supabase);

        // re-fetch: resolveRound already wrote a fresh `state`/`status` onto
        // the season row, so merge config on top of the CURRENT row rather
        // than the one fetched before resolveRound ran.
        const { data: freshSeasonRow } = await supabase.from("afwar_seasons").select("config").eq("id", season.id).maybeSingle();
        const freshConfig = (freshSeasonRow as { config: Record<string, unknown> } | null)?.config ?? config;

        await supabase
            .from("afwar_seasons")
            .update({
                config: { ...freshConfig, lastTick: new Date().toISOString(), lastPhase: nextPhase, cadenceHours },
            })
            .eq("id", season.id);

        return NextResponse.json({ ok: true, phase: nextPhase, result });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : `${nextPhase} failed` }, { status: 400 });
    }
}
