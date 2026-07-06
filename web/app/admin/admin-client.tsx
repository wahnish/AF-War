"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CanonCast, CanonNote } from "@/lib/types";

const FACTIONS = ["OG", "Horde", "Swarm", "Soup", "Primordial", "GUCKS", "unaffiliated"];

export default function AdminClient({ initialCast }: { initialCast: CanonCast[] }) {
    const [cast, setCast] = useState(initialCast);
    const [editingId, setEditingId] = useState<string | null>(null);

    async function refresh() {
        const supabase = createClient();
        const { data } = await supabase.from("afwar_canon_cast").select("*").order("created_at", { ascending: true });
        setCast((data as CanonCast[]) ?? []);
    }

    return (
        <div className="flex flex-col gap-4">
            {cast.length === 0 && <p className="tag-mono opacity-60">No canon cast rows yet — run schema-002.sql.</p>}
            {cast.map((c) => (
                <CastRow
                    key={c.id}
                    entry={c}
                    editing={editingId === c.id}
                    onEdit={() => setEditingId(c.id)}
                    onClose={() => setEditingId(null)}
                    onSaved={refresh}
                />
            ))}
        </div>
    );
}

function CastRow({
    entry,
    editing,
    onEdit,
    onClose,
    onSaved,
}: {
    entry: CanonCast;
    editing: boolean;
    onEdit: () => void;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState(entry.name);
    const [bio, setBio] = useState(entry.bio ?? "");
    const [sheetUrl, setSheetUrl] = useState(entry.model_sheet_url ?? "");
    const [faction, setFaction] = useState(entry.faction ?? "");
    const [active, setActive] = useState(entry.active);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [generating, setGenerating] = useState(false);
    const [noteText, setNoteText] = useState("");
    const [addingNote, setAddingNote] = useState(false);

    async function save() {
        setSaving(true);
        setError("");
        const supabase = createClient();
        const { error } = await supabase
            .from("afwar_canon_cast")
            .update({ name, bio, model_sheet_url: sheetUrl || null, faction: faction || null, active })
            .eq("id", entry.id);
        if (error) {
            setError(error.message);
        } else {
            onSaved();
            onClose();
        }
        setSaving(false);
    }

    async function generateSheet() {
        setGenerating(true);
        setError("");
        try {
            const res = await fetch("/api/generate-sheet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, bio, archetype: entry.kind }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "generation failed");
            setSheetUrl(json.url);
        } catch (e) {
            setError(e instanceof Error ? e.message : "generation failed");
        } finally {
            setGenerating(false);
        }
    }

    async function addNote() {
        if (!noteText.trim()) return;
        setAddingNote(true);
        setError("");
        const supabase = createClient();
        const note: CanonNote = { date: new Date().toISOString().slice(0, 10), note: noteText.trim() };
        const nextNotes = [...(entry.canon_notes ?? []), note];
        const { error } = await supabase.from("afwar_canon_cast").update({ canon_notes: nextNotes }).eq("id", entry.id);
        if (error) {
            setError(error.message);
        } else {
            setNoteText("");
            onSaved();
        }
        setAddingNote(false);
    }

    return (
        <div className="panel p-5">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="text-2xl">{entry.name}</h3>
                    <span className="tag-mono opacity-70">{entry.kind.toUpperCase()}</span>
                    {entry.faction && (
                        <span className="tag-mono ml-2" style={{ color: "var(--neon-cyan)" }}>
                            {entry.faction}
                        </span>
                    )}
                </div>
                <span className="tag-mono" style={{ color: entry.active ? "var(--neon-lime)" : "var(--blood)" }}>
                    {entry.active ? "active" : "inactive"}
                </span>
            </div>

            {!editing ? (
                <>
                    <p className="text-sm opacity-80 mb-3">{entry.bio}</p>
                    {entry.model_sheet_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={entry.model_sheet_url}
                            alt={`${entry.name} model sheet`}
                            className="max-w-[160px] mb-3 rounded-sm border"
                            style={{ borderColor: "var(--line-bright)" }}
                        />
                    )}
                    {entry.canon_notes?.length > 0 && (
                        <div className="mb-3">
                            <div className="tag-mono mb-1 opacity-70">CANON NOTES</div>
                            <ul className="flex flex-col gap-1">
                                {entry.canon_notes.map((n, i) => (
                                    <li key={i} className="text-sm opacity-80">
                                        <span className="tag-mono opacity-60">{n.date}</span> — {n.note}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <button className="btn" onClick={onEdit}>
                        Edit
                    </button>

                    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
                        <label className="field-label">ADD CANON NOTE (behavior correction)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder='e.g. "Raze never apologizes; he issues corrections."'
                            />
                            <button className="btn btn-magenta" onClick={addNote} disabled={addingNote || !noteText.trim()}>
                                {addingNote ? "Adding…" : "Add"}
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col gap-3">
                    <div>
                        <label className="field-label">Name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="field-label">Bio</label>
                        <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
                    </div>
                    <div>
                        <label className="field-label">Faction</label>
                        <select value={faction} onChange={(e) => setFaction(e.target.value)} style={{ width: 200 }}>
                            <option value="">(none)</option>
                            {FACTIONS.map((f) => (
                                <option key={f} value={f}>
                                    {f}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="field-label">Model Sheet URL</label>
                        {sheetUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={sheetUrl}
                                alt="model sheet"
                                className="max-w-[160px] mb-2 rounded-sm border"
                                style={{ borderColor: "var(--line-bright)" }}
                            />
                        )}
                        <div className="flex gap-2 items-center flex-wrap">
                            <input type="text" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://…" />
                            <button type="button" className="btn" onClick={generateSheet} disabled={generating || !bio}>
                                {generating ? "Rendering…" : "✦ NB2 generate"}
                            </button>
                        </div>
                    </div>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                        <span className="text-sm">Active (wired into narration context)</span>
                    </label>
                    {error && (
                        <p className="tag-mono" style={{ color: "var(--blood)" }}>
                            {error}
                        </p>
                    )}
                    <div className="flex gap-3">
                        <button className="btn btn-magenta" onClick={save} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                        </button>
                        <button className="btn" onClick={onClose} disabled={saving}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
