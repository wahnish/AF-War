"use client";

import { useState } from "react";

// Comic rung upgrade (final polish round §1c): shown on /match/[id] when
// there's no comic media yet and the current user owns either combatant
// (that ownership check happens server-side in page.tsx; this component
// only renders when the caller has already decided to show it).
export default function RenderComicButton({ matchId }: { matchId: string }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [pages, setPages] = useState<string[]>([]);

    async function render() {
        setBusy(true);
        setError("");
        try {
            const res = await fetch(`/api/match/${matchId}/render-comic`, { method: "POST" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "render failed");
            setPages(json.pages ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "render failed");
        } finally {
            setBusy(false);
        }
    }

    if (pages.length) {
        return (
            <div className="panel p-5 mb-8">
                <h2 className="text-2xl mb-3">COMIC PAGES</h2>
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                    {pages.map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={url} alt={`comic page ${i + 1}`} className="rounded-sm border w-full" style={{ borderColor: "var(--line-bright)" }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="panel p-5 mb-8">
            <button className="btn btn-magenta" onClick={render} disabled={busy}>
                {busy ? "Rendering… (this can take a minute)" : "🎬 Render this match as a comic — 50 $BAMF"}
            </button>
            {error && (
                <p className="tag-mono mt-2" style={{ color: "var(--blood)" }}>
                    {error}
                </p>
            )}
        </div>
    );
}
