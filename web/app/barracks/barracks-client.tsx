"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Character, CharacterPolicy, CharacterStats, Season, Direction } from "@/lib/types";
import type { Ability } from "@/lib/engine/dice";

const ABILITIES: Ability[] = ["STR", "END", "DEX", "CHA", "INT"];
const RANK_TO_DIE = [10, 8, 6, 6, 4] as const; // rank 1 (best) -> d10 ... rank 5 -> d4, per R1
const ARCHETYPE_SUGGESTIONS = ["Telekinetic", "Tech Ninja", "Sharpshooter"];

function emptyRanking(): Record<Ability, number> {
    return { STR: 1, END: 2, DEX: 3, CHA: 4, INT: 5 };
}

function rankingToStats(ranking: Record<Ability, number>): CharacterStats {
    const stats = {} as CharacterStats;
    for (const ab of ABILITIES) {
        const rank = ranking[ab]; // 1..5
        stats[ab] = RANK_TO_DIE[rank - 1] as CharacterStats[Ability];
    }
    return stats;
}

function defaultPolicy(): CharacterPolicy {
    return { resistVs: [], counterWhenHpAbove: 5, spendVpAtMatchPoint: true, blazeOfGloryIfDying: false };
}

interface FormState {
    id?: string;
    name: string;
    archetype: string;
    ranking: Record<Ability, number>;
    attack_ability: Ability;
    powerName: string;
    powerLevel: number;
    policy: CharacterPolicy;
    bio: string;
    voice_notes: string;
    model_sheet_url: string;
}

function emptyForm(): FormState {
    return {
        name: "",
        archetype: "",
        ranking: emptyRanking(),
        attack_ability: "STR",
        powerName: "",
        powerLevel: 3,
        policy: defaultPolicy(),
        bio: "",
        voice_notes: "",
        model_sheet_url: "",
    };
}

function toForm(c: Character): FormState {
    // reverse stats -> a plausible ranking (dice sizes are not perfectly invertible
    // if two abilities share a die, but this is fine for re-editing)
    const dieOrder = [10, 8, 6, 6, 4];
    const sorted = ABILITIES.slice().sort((a, b) => c.stats[b] - c.stats[a]);
    const ranking = emptyRanking();
    sorted.forEach((ab, i) => {
        ranking[ab] = i + 1;
    });
    void dieOrder;
    return {
        id: c.id,
        name: c.name,
        archetype: c.archetype,
        ranking,
        attack_ability: c.attack_ability,
        powerName: c.power?.name ?? "",
        powerLevel: c.power?.level ?? 3,
        policy: c.policy ?? defaultPolicy(),
        bio: c.bio ?? "",
        voice_notes: c.voice_notes ?? "",
        model_sheet_url: c.model_sheet_url ?? "",
    };
}

export default function BarracksClient({ initialCharacters }: { initialCharacters: Character[] }) {
    const [characters, setCharacters] = useState(initialCharacters);
    const [editing, setEditing] = useState<FormState | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function refresh() {
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        const { data } = await supabase
            .from("afwar_characters")
            .select("*")
            .eq("owner_id", user?.id ?? "")
            .order("created_at", { ascending: false });
        setCharacters((data as Character[]) ?? []);
    }

    async function save(form: FormState) {
        setSaving(true);
        setError("");
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setError("Not signed in.");
            setSaving(false);
            return;
        }

        const payload = {
            owner_id: user.id,
            name: form.name,
            archetype: form.archetype,
            stats: rankingToStats(form.ranking),
            attack_ability: form.attack_ability,
            power: { name: form.powerName || "Unnamed Power", level: form.powerLevel },
            policy: form.policy,
            bio: form.bio,
            voice_notes: form.voice_notes,
            model_sheet_url: form.model_sheet_url || null,
        };

        const { error } = form.id
            ? await supabase.from("afwar_characters").update(payload).eq("id", form.id)
            : await supabase.from("afwar_characters").insert(payload);

        if (error) {
            setError(error.message);
        } else {
            setEditing(null);
            await refresh();
        }
        setSaving(false);
    }

    if (editing) {
        return (
            <CharacterForm
                form={editing}
                setForm={setEditing}
                onCancel={() => setEditing(null)}
                onSave={() => save(editing)}
                saving={saving}
                error={error}
            />
        );
    }

    return (
        <div>
            <button className="btn btn-magenta mb-6" onClick={() => setEditing(emptyForm())}>
                + Draft a new Original Character
            </button>

            {characters.length === 0 ? (
                <p className="tag-mono opacity-60">No characters yet. The Glome awaits a challenger.</p>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {characters.map((c) => (
                        <div key={c.id} className="panel p-5">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="text-2xl">{c.name}</h3>
                                    <span className="tag-mono opacity-70">{c.archetype}</span>
                                </div>
                                <span
                                    className="tag-mono"
                                    style={{ color: c.status === "active" ? "var(--neon-lime)" : "var(--blood)" }}
                                >
                                    {c.status}
                                </span>
                            </div>
                            <div className="flex gap-3 tag-mono mb-3 flex-wrap">
                                {ABILITIES.map((ab) => (
                                    <span key={ab}>
                                        {ab} d{c.stats[ab]}
                                    </span>
                                ))}
                            </div>
                            <p className="text-sm opacity-80 mb-3 line-clamp-3">{c.bio}</p>
                            <div className="tag-mono mb-3">
                                {c.power?.name} · Lv {c.power?.level} · kills {c.kills} · clout {c.clout}
                            </div>
                            <button className="btn" onClick={() => setEditing(toForm(c))}>
                                Edit
                            </button>
                            <DirectionForm character={c} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function defaultDirection(): { gambit: string; tone_note: string; vp_budget: number; ability_lane: Ability } {
    return { gambit: "", tone_note: "", vp_budget: 5, ability_lane: "STR" };
}

function DirectionForm({ character }: { character: Character }) {
    const [season, setSeason] = useState<Season | null>(null);
    const [existing, setExisting] = useState<Direction | null>(null);
    const [form, setForm] = useState(defaultDirection());
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!open || season) return;
        let cancelled = false;
        setLoading(true);
        fetch("/api/season/current")
            .then((r) => r.json())
            .then((json: { season: Season | null }) => {
                if (cancelled) return;
                setSeason(json.season);
            })
            .catch(() => {})
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [open, season]);

    useEffect(() => {
        if (!season?.state) return;
        const round = season.state.round;
        let cancelled = false;
        const supabase = createClient();
        supabase
            .from("afwar_directions")
            .select("*")
            .eq("season_id", season.id)
            .eq("round", round)
            .eq("character_id", character.id)
            .maybeSingle()
            .then(({ data }: { data: Direction | null }) => {
                if (cancelled) return;
                if (data) {
                    setExisting(data);
                    setForm({
                        gambit: data.gambit ?? "",
                        tone_note: data.tone_note ?? "",
                        vp_budget: data.vp_budget ?? 5,
                        ability_lane: (data.ability_lane as Ability) ?? "STR",
                    });
                }
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [season?.id, season?.state?.round, character.id]);

    async function save() {
        if (!season) {
            setError("No active season.");
            return;
        }
        setSaving(true);
        setError("");
        setSaved(false);
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setError("Not signed in.");
            setSaving(false);
            return;
        }

        const round = season.state?.round ?? 0;
        const payload = {
            season_id: season.id,
            round,
            character_id: character.id,
            director_id: user.id,
            gambit: form.gambit,
            tone_note: form.tone_note,
            vp_budget: form.vp_budget,
            ability_lane: form.ability_lane,
        };

        const { error } = existing
            ? await supabase.from("afwar_directions").update(payload).eq("id", existing.id)
            : await supabase.from("afwar_directions").insert(payload);

        if (error) {
            setError(error.message);
        } else {
            setSaved(true);
        }
        setSaving(false);
    }

    if (!open) {
        return (
            <button className="btn mt-2" onClick={() => setOpen(true)}>
                🎬 Direction
            </button>
        );
    }

    return (
        <div className="panel p-4 mt-3" style={{ borderColor: "var(--line-bright)" }}>
            <div className="flex items-center justify-between mb-3">
                <span className="tag-mono">
                    🎬 DIRECTION {season?.state ? `· round ${season.state.round}` : ""}
                </span>
                <button className="tag-mono opacity-60" onClick={() => setOpen(false)}>
                    close
                </button>
            </div>
            {loading ? (
                <p className="tag-mono opacity-60">loading…</p>
            ) : !season ? (
                <p className="tag-mono opacity-60">No active season yet.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    <div>
                        <label className="field-label">Gambit</label>
                        <input
                            type="text"
                            value={form.gambit}
                            onChange={(e) => setForm({ ...form, gambit: e.target.value })}
                            placeholder="e.g. bait them into the Gowanus, then run"
                        />
                    </div>
                    <div>
                        <label className="field-label">Tone note</label>
                        <input
                            type="text"
                            value={form.tone_note}
                            onChange={(e) => setForm({ ...form, tone_note: e.target.value })}
                            placeholder="e.g. play it for pathos this time"
                        />
                    </div>
                    <div>
                        <label className="field-label">Ability lane</label>
                        <select
                            value={form.ability_lane}
                            onChange={(e) => setForm({ ...form, ability_lane: e.target.value as Ability })}
                            style={{ width: 160 }}
                        >
                            {ABILITIES.map((ab) => (
                                <option key={ab} value={ab}>
                                    {ab}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <span className="tag-mono block mb-1">VP budget: {form.vp_budget}</span>
                        <input
                            type="range"
                            min={0}
                            max={10}
                            value={form.vp_budget}
                            onChange={(e) => setForm({ ...form, vp_budget: Number(e.target.value) })}
                        />
                    </div>
                    {error && (
                        <p className="tag-mono" style={{ color: "var(--blood)" }}>
                            {error}
                        </p>
                    )}
                    {saved && (
                        <p className="tag-mono" style={{ color: "var(--neon-lime)" }}>
                            Direction saved for round {season.state?.round}.
                        </p>
                    )}
                    <button className="btn btn-magenta" onClick={save} disabled={saving}>
                        {saving ? "Saving…" : existing ? "Update Direction" : "Save Direction"}
                    </button>
                </div>
            )}
        </div>
    );
}

function CharacterForm({
    form,
    setForm,
    onCancel,
    onSave,
    saving,
    error,
}: {
    form: FormState;
    setForm: (f: FormState) => void;
    onCancel: () => void;
    onSave: () => void;
    saving: boolean;
    error: string;
}) {
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState("");
    const [uploading, setUploading] = useState(false);

    function setRank(ability: Ability, rank: number) {
        // swap with whoever currently holds that rank
        const holder = ABILITIES.find((a) => form.ranking[a] === rank);
        const next = { ...form.ranking, [ability]: rank };
        if (holder && holder !== ability) next[holder] = form.ranking[ability];
        setForm({ ...form, ranking: next });
    }

    function toggleResist(ability: Ability) {
        const has = form.policy.resistVs.includes(ability);
        setForm({
            ...form,
            policy: {
                ...form.policy,
                resistVs: has ? form.policy.resistVs.filter((a) => a !== ability) : [...form.policy.resistVs, ability],
            },
        });
    }

    async function generateSheet() {
        setGenerating(true);
        setGenError("");
        try {
            const res = await fetch("/api/generate-sheet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: form.name, bio: form.bio, archetype: form.archetype }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "generation failed");
            setForm({ ...form, model_sheet_url: json.url });
        } catch (e) {
            setGenError(e instanceof Error ? e.message : "generation failed");
        } finally {
            setGenerating(false);
        }
    }

    async function uploadFile(file: File) {
        setUploading(true);
        setGenError("");
        try {
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            const path = `${user?.id ?? "anon"}/${Date.now()}-${file.name}`;
            const { error } = await supabase.storage.from("sheets").upload(path, file, { upsert: true });
            if (error) throw error;
            const { data } = supabase.storage.from("sheets").getPublicUrl(path);
            setForm({ ...form, model_sheet_url: data.publicUrl });
        } catch (e) {
            setGenError(e instanceof Error ? e.message : "upload failed");
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="max-w-3xl">
            <h2 className="text-3xl mb-1">{form.id ? "EDIT CHARACTER" : "CHARACTER BUILDER"}</h2>
            <p className="tag-mono mb-6 opacity-70">draft your Original Character for Hyper-Brooklyn</p>

            <div className="flex flex-col gap-6">
                <div>
                    <label className="field-label">Name</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Grumble Bee"
                    />
                </div>

                <div>
                    <label className="field-label">Archetype</label>
                    <input
                        type="text"
                        value={form.archetype}
                        onChange={(e) => setForm({ ...form, archetype: e.target.value })}
                        placeholder="free text — or pick a suggestion below"
                    />
                    <div className="flex gap-2 mt-2 flex-wrap">
                        {ARCHETYPE_SUGGESTIONS.map((a) => (
                            <button
                                key={a}
                                type="button"
                                className="chip"
                                data-active={form.archetype === a}
                                onClick={() => setForm({ ...form, archetype: a })}
                            >
                                {a}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="field-label">
                        Stat Ranking (R1: array d10 / d8 / d6 / d6 / d4 assigned by rank)
                    </label>
                    <div className="panel p-4 flex flex-col gap-2">
                        {ABILITIES.map((ab) => (
                            <div key={ab} className="flex items-center gap-3">
                                <span className="w-10 tag-mono">{ab}</span>
                                <select
                                    value={form.ranking[ab]}
                                    onChange={(e) => setRank(ab, Number(e.target.value))}
                                    style={{ width: 140 }}
                                >
                                    {[1, 2, 3, 4, 5].map((r) => (
                                        <option key={r} value={r}>
                                            rank {r} — d{RANK_TO_DIE[r - 1]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="field-label">Attack Ability</label>
                    <select
                        value={form.attack_ability}
                        onChange={(e) => setForm({ ...form, attack_ability: e.target.value as Ability })}
                        style={{ width: 200 }}
                    >
                        {ABILITIES.map((ab) => (
                            <option key={ab} value={ab}>
                                {ab}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="field-label">Signature Power — name</label>
                        <input
                            type="text"
                            value={form.powerName}
                            onChange={(e) => setForm({ ...form, powerName: e.target.value })}
                            placeholder="e.g. Weaponized Bowling Ball"
                        />
                    </div>
                    <div>
                        <label className="field-label">Power Level (1-12)</label>
                        <input
                            type="number"
                            min={1}
                            max={12}
                            value={form.powerLevel}
                            onChange={(e) =>
                                setForm({ ...form, powerLevel: Math.max(1, Math.min(12, Number(e.target.value))) })
                            }
                        />
                    </div>
                </div>

                <div>
                    <label className="field-label">Defense Policy (R2 — async play, the one rules change)</label>
                    <div className="panel p-4 flex flex-col gap-4">
                        <div>
                            <span className="tag-mono block mb-1">Resist with END vs (default: dodge with DEX)</span>
                            <div className="flex gap-2 flex-wrap">
                                {ABILITIES.map((ab) => (
                                    <button
                                        key={ab}
                                        type="button"
                                        className="chip"
                                        data-active={form.policy.resistVs.includes(ab)}
                                        onClick={() => toggleResist(ab)}
                                    >
                                        {ab}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <span className="tag-mono block mb-1">
                                Counterattack when HP above: {form.policy.counterWhenHpAbove}
                            </span>
                            <input
                                type="range"
                                min={0}
                                max={10}
                                value={form.policy.counterWhenHpAbove}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        policy: { ...form.policy, counterWhenHpAbove: Number(e.target.value) },
                                    })
                                }
                            />
                        </div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.policy.spendVpAtMatchPoint}
                                onChange={(e) =>
                                    setForm({ ...form, policy: { ...form.policy, spendVpAtMatchPoint: e.target.checked } })
                                }
                            />
                            <span className="text-sm">Spend VP on signature power at match point</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.policy.blazeOfGloryIfDying}
                                onChange={(e) =>
                                    setForm({ ...form, policy: { ...form.policy, blazeOfGloryIfDying: e.target.checked } })
                                }
                            />
                            <span className="text-sm">Approve Blaze of Glory when facing death-stakes defeat</span>
                        </label>
                    </div>
                </div>

                <div>
                    <label className="field-label">Bio</label>
                    <textarea
                        rows={6}
                        value={form.bio}
                        onChange={(e) => setForm({ ...form, bio: e.target.value })}
                        placeholder="Who are they? What do they want? What's ridiculous about them? What's the wound underneath?"
                    />
                </div>

                <div>
                    <label className="field-label">Voice Notes</label>
                    <textarea
                        rows={3}
                        value={form.voice_notes}
                        onChange={(e) => setForm({ ...form, voice_notes: e.target.value })}
                        placeholder="How do they talk? Speech tics, catchphrases, register."
                    />
                </div>

                <div>
                    <label className="field-label">Model Sheet</label>
                    {form.model_sheet_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={form.model_sheet_url}
                            alt="model sheet"
                            className="max-w-xs mb-3 rounded-sm border"
                            style={{ borderColor: "var(--line-bright)" }}
                        />
                    )}
                    <div className="flex gap-3 flex-wrap items-center">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                        />
                        <button type="button" className="btn" onClick={generateSheet} disabled={generating || !form.bio}>
                            {generating ? "Rendering…" : "✦ Generate from description"}
                        </button>
                        {uploading && <span className="tag-mono">uploading…</span>}
                    </div>
                    {genError && (
                        <p className="tag-mono mt-2" style={{ color: "var(--blood)" }}>
                            {genError}
                        </p>
                    )}
                </div>

                {error && (
                    <p className="tag-mono" style={{ color: "var(--blood)" }}>
                        {error}
                    </p>
                )}

                <div className="flex gap-3">
                    <button className="btn btn-magenta" onClick={onSave} disabled={saving || !form.name}>
                        {saving ? "Saving…" : "Save Character"}
                    </button>
                    <button className="btn" onClick={onCancel} disabled={saving}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
