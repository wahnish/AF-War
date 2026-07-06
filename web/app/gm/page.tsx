"use client";

import { useEffect, useState } from "react";
import type { Season } from "@/lib/types";

// KNOWN GAP: no role-gating — any authenticated user can hit these buttons.
// Fine for a single-GM season; revisit before opening this up further.
export default function GmPage() {
    const [season, setSeason] = useState<Season | null>(null);
    const [loadingSeason, setLoadingSeason] = useState(true);
    const [busy, setBusy] = useState<"resolve" | "downtime" | "start" | null>(null);
    const [result, setResult] = useState<string>("");
    const [error, setError] = useState("");

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

    async function call(kind: "resolve" | "downtime" | "start") {
        setBusy(kind);
        setError("");
        setResult("");
        try {
            const path = kind === "resolve" ? "/api/gm/resolve" : kind === "downtime" ? "/api/gm/downtime" : "/api/gm/start";
            const res = await fetch(path, { method: "POST" });
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

            <div className="flex flex-col gap-3 mb-6">
                <button className="btn btn-magenta" onClick={() => call("resolve")} disabled={busy !== null || !season}>
                    {busy === "resolve" ? "Resolving…" : "▶ Resolve round"}
                </button>
                <button className="btn" onClick={() => call("downtime")} disabled={busy !== null}>
                    {busy === "downtime" ? "Posting…" : "🌙 Downtime pass"}
                </button>
                <button className="btn" onClick={() => call("start")} disabled={busy !== null}>
                    {busy === "start" ? "Starting…" : "＋ Start season"}
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

            <p className="tag-mono mt-8 opacity-50">
                No role gating yet — any signed-in user can trigger these. Fine for now; revisit before wider access.
            </p>
        </div>
    );
}
