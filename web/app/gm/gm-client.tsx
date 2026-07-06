"use client";

import { useEffect, useState } from "react";
import type { Season } from "@/lib/types";

export default function GmClient() {
    const [season, setSeason] = useState<Season | null>(null);
    const [loadingSeason, setLoadingSeason] = useState(true);
    const [busy, setBusy] = useState<"resolve" | "downtime" | "start" | "anthology" | "tick" | "forge" | null>(null);
    const [result, setResult] = useState<string>("");
    const [error, setError] = useState("");
    const [agentIntents, setAgentIntents] = useState(false);

    async function refreshSeason() {
        setLoadingSeason(true);
        try {
            const res = await fetch("/api/season/current");
            const json = await res.json();
            setSeason(json.season ?? null);
        } catch {
            // best-effort status display; not fatal
        } finally {
            setLoadingSeason(false);
        }
    }

    useEffect(() => {
        refreshSeason();
    }, []);

    async function call(kind: "resolve" | "downtime" | "start" | "anthology" | "tick" | "forge") {
        setBusy(kind);
        setError("");
        setResult("");
        try {
            const path =
                kind === "resolve"
                    ? "/api/gm/resolve"
                    : kind === "downtime"
                    ? "/api/gm/downtime"
                    : kind === "anthology"
                    ? "/api/gm/anthology"
                    : kind === "tick"
                    ? "/api/gm/tick"
                    : kind === "forge"
                    ? "/api/gm/forge"
                    : "/api/gm/start";
            const method = kind === "tick" ? "GET" : "POST";
            const res = await fetch(path, {
                method,
                headers: { "Content-Type": "application/json" },
                body: kind === "resolve" ? JSON.stringify({ agentIntents }) : undefined,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? `${kind} failed`);
            setResult(JSON.stringify(json, null, 2));
            await refreshSeason();
        } catch (e) {
            setError(e instanceof Error ? e.message : `${kind} failed`);
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="max-w-2xl">
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-6">
                <h1 className="text-4xl">GM CONSOLE</h1>
                <span className="tag-mono">the trigger seam</span>
            </div>

            <div className="panel p-5 mb-6">
                <h2 className="text-xl mb-2">SEASON STATUS</h2>
                {loadingSeason ? (
                    <p className="tag-mono opacity-60">loading…</p>
                ) : season ? (
                    <p className="tag-mono">
                        {season.name} · status <strong>{season.status}</strong> · round{" "}
                        <strong>{season.state?.round ?? 0}</strong>
                    </p>
                ) : (
                    <p className="tag-mono opacity-60">No season yet. Start one below.</p>
                )}
            </div>

            <div className="panel p-4 mb-6" style={{ borderColor: "var(--neon-cyan)" }}>
                <p className="tag-mono mb-3" style={{ color: "var(--neon-cyan)" }}>
                    ⏰ Autonomous mode: cron daily at 15:00 UTC (set CRON_SECRET in Vercel)
                </p>
                <button className="btn" onClick={() => call("tick")} disabled={busy !== null || !season}>
                    {busy === "tick" ? "Ticking…" : "▶ Tick now"}
                </button>
            </div>

            <label className="flex items-center gap-2 mb-3">
                <input type="checkbox" checked={agentIntents} onChange={(e) => setAgentIntents(e.target.checked)} />
                <span className="text-sm">🧠 Agent strategy (per-crew LLM war councils decide attacks/alliances)</span>
            </label>

            <div className="flex flex-col gap-3 mb-6">
                <button className="btn btn-magenta" onClick={() => call("resolve")} disabled={busy !== null || !season}>
                    {busy === "resolve" ? "Resolving…" : "▶ Resolve round"}
                </button>
                <button className="btn" onClick={() => call("downtime")} disabled={busy !== null}>
                    {busy === "downtime" ? "Posting…" : "🌙 Downtime pass"}
                </button>
                <button className="btn" onClick={() => call("forge")} disabled={busy !== null || !season}>
                    {busy === "forge" ? "Forging…" : "⚔ Forge season loot item"}
                </button>
                <button className="btn" onClick={() => call("start")} disabled={busy !== null}>
                    {busy === "start" ? "Starting…" : "＋ Start season"}
                </button>
                <button className="btn" onClick={() => call("anthology")} disabled={busy !== null || !season}>
                    {busy === "anthology" ? "Compiling…" : "📖 Compile season anthology"}
                </button>
            </div>

            {error && (
                <p className="tag-mono mb-4" style={{ color: "var(--blood)" }}>
                    {error}
                </p>
            )}

            {result && (
                <div className="panel p-4">
                    <div className="tag-mono mb-2 opacity-70">last response</div>
                    <pre className="text-sm whitespace-pre-wrap overflow-x-auto">{result}</pre>
                </div>
            )}
        </div>
    );
}
