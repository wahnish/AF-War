"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CrewWithRoster } from "./page";

export default function CrewsClient({ crews: initialCrews }: { crews: CrewWithRoster[] }) {
    const [crews, setCrews] = useState(initialCrews);
    const [loggedIn, setLoggedIn] = useState<boolean | undefined>(undefined);
    const [hasFreeCharacter, setHasFreeCharacter] = useState(false);
    const [busyCrewId, setBusyCrewId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const supabase = createClient();
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (cancelled) return;
            setLoggedIn(Boolean(user));
            if (!user) return;
            const { data } = await supabase
                .from("afwar_characters")
                .select("id,crew_id")
                .eq("owner_id", user.id);
            const rows = (data as { id: string; crew_id: string | null }[]) ?? [];
            if (!cancelled) setHasFreeCharacter(rows.some((r) => !r.crew_id));
        });
        return () => {
            cancelled = true;
        };
    }, []);

    async function refresh() {
        const res = await fetch("/api/crews/list").catch(() => null);
        if (res?.ok) {
            const json = await res.json();
            setCrews(json.crews ?? crews);
        }
    }

    async function join(crewId: string) {
        setBusyCrewId(crewId);
        setError("");
        try {
            const res = await fetch("/api/crews/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ crew_id: crewId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "join failed");
            await refresh();
            setHasFreeCharacter(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : "join failed");
        } finally {
            setBusyCrewId(null);
        }
    }

    return (
        <div>
            {loggedIn && (
                <div className="mb-6">
                    {!showCreate ? (
                        <button className="btn btn-magenta" onClick={() => setShowCreate(true)}>
                            ⚑ FOUND A NEW CREW
                        </button>
                    ) : (
                        <CreateCrewForm
                            onDone={async () => {
                                setShowCreate(false);
                                await refresh();
                            }}
                            onCancel={() => setShowCreate(false)}
                        />
                    )}
                </div>
            )}

            {error && (
                <p className="tag-mono mb-4" style={{ color: "var(--blood)" }}>
                    {error}
                </p>
            )}

            {crews.length === 0 ? (
                <p className="tag-mono opacity-60">No crews yet. Be the first to raise a flag.</p>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {crews.map((c) => {
                        const memberCount = c.members.length;
                        const full = memberCount >= c.max_size;
                        const clout = c.members.reduce((sum, m) => sum + (m.clout ?? 0), 0);
                        return (
                            <div key={c.id} className="panel p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="text-2xl">{c.name}</h3>
                                        {c.motto && <p className="tag-mono opacity-70">{c.motto}</p>}
                                    </div>
                                    <span
                                        className="tag-mono"
                                        style={{ color: full ? "var(--blood)" : "var(--neon-lime)" }}
                                    >
                                        {memberCount}/{c.max_size} {full ? "· FULL" : ""}
                                    </span>
                                </div>
                                <div className="tag-mono mb-3" style={{ color: "var(--neon-gold)" }}>
                                    Crew Clout: {clout}
                                </div>
                                {c.members.length > 0 && (
                                    <p className="text-sm opacity-70 mb-3">
                                        {c.members.map((m) => m.name).join(", ")}
                                    </p>
                                )}
                                {loggedIn === false && (
                                    <a className="tag-mono" href="/login" style={{ color: "var(--neon-gold)" }}>
                                        log in to join
                                    </a>
                                )}
                                {loggedIn && !full && hasFreeCharacter && (
                                    <button
                                        className="btn"
                                        onClick={() => join(c.id)}
                                        disabled={busyCrewId === c.id}
                                    >
                                        {busyCrewId === c.id ? "Joining…" : "JOIN"}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function CreateCrewForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
    const [name, setName] = useState("");
    const [motto, setMotto] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/crews/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, motto }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "create failed");
            onDone();
        } catch (e) {
            setError(e instanceof Error ? e.message : "create failed");
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} className="panel p-4 max-w-md flex flex-col gap-3">
            <div>
                <label className="field-label">Crew name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. The Gowanus Regulars" />
            </div>
            <div>
                <label className="field-label">Motto</label>
                <input type="text" value={motto} onChange={(e) => setMotto(e.target.value)} placeholder="optional" />
            </div>
            {error && (
                <p className="tag-mono" style={{ color: "var(--blood)" }}>
                    {error}
                </p>
            )}
            <div className="flex gap-3">
                <button className="btn btn-magenta" type="submit" disabled={saving || !name}>
                    {saving ? "Founding…" : "Found crew"}
                </button>
                <button className="btn" type="button" onClick={onCancel} disabled={saving}>
                    Cancel
                </button>
            </div>
        </form>
    );
}
