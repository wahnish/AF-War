import { createClient } from "@/lib/supabase/server";
import type { MatchRow } from "@/lib/types";
import type { ExchangeBeat } from "@/lib/engine/dice";
import type { MatchResult } from "@/lib/engine/match";
import { zoneById } from "@/lib/engine/map";

interface ComicPanel {
    n: number;
    shot: string;
    description: string;
    dialogue: { speaker: string; text: string; kind: string }[];
    sfx?: string;
}
interface Telling {
    pcId: string;
    title: string;
    prose: string;
    panels: ComicPanel[];
}
interface Verdict {
    canonPcId: string;
    scores: Record<string, number>;
    critique: string;
}

function fmtRoll(e: ExchangeBeat) {
    const atk = e.attackRoll;
    const powerNote = e.powerUsed ? ` +${e.powerUsed.name}(${e.powerUsed.bonus.total})` : "";
    return `${e.attacker} ${e.attackAbility} → ${atk.rolls.join("+")}${powerNote} = **${atk.total + (e.powerUsed?.bonus.total ?? 0)}**`;
}

export default async function MatchRoomPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();
    const { data } = await supabase.from("afwar_matches").select("*").eq("id", id).maybeSingle();
    const match = data as MatchRow | null;

    if (!match) {
        return (
            <div className="text-center py-24">
                <h1 className="text-4xl mb-3">MATCH ROOM</h1>
                <p className="tag-mono opacity-60">No record of this match. It may not exist yet.</p>
            </div>
        );
    }

    const result = match.dice_transcript as MatchResult | null;
    const tellings = (match.tellings as Telling[] | null) ?? [];
    const verdict = match.verdict as Verdict | null;
    const zone = (() => {
        try {
            return zoneById(match.zone_id);
        } catch {
            return { id: match.zone_id, name: match.zone_id, blurb: "" };
        }
    })();

    const stakesColor =
        match.stakes === "death"
            ? "var(--blood)"
            : match.stakes === "scar"
            ? "var(--neon-gold)"
            : match.stakes === "corruption"
            ? "var(--corrupt)"
            : "var(--neon-cyan)";

    return (
        <div>
            <div
                className="panel p-6 mb-6"
                style={{ borderColor: stakesColor, boxShadow: `0 0 30px ${stakesColor}22` }}
            >
                <div className="tag-mono mb-1" style={{ color: stakesColor }}>
                    {match.stakes?.toUpperCase()} STAKES · ROUND {match.round} · {zone.name}
                </div>
                <h1 className="text-4xl mb-1">
                    {tellings[0]?.title ?? `Match ${match.a_character ?? "?"} vs ${match.b_character ?? "?"}`}
                </h1>
                <p className="tag-mono opacity-70">{zone.blurb}</p>
                {match.winner && (
                    <p className="mt-2">
                        Winner (dice): <strong>{match.winner}</strong>
                    </p>
                )}
            </div>

            {result && (
                <section className="mb-8">
                    <h2 className="text-2xl mb-3">DICE TRANSCRIPT (GROUND TRUTH)</h2>
                    <div className="panel overflow-x-auto">
                        <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                            <thead>
                                <tr className="tag-mono" style={{ borderBottom: "1px solid var(--line-bright)" }}>
                                    <th className="p-3">#</th>
                                    <th className="p-3">Attack</th>
                                    <th className="p-3">Defense</th>
                                    <th className="p-3">Winner</th>
                                    <th className="p-3">Dmg / Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.exchanges.map((e) => (
                                    <tr key={e.n} style={{ borderBottom: "1px solid var(--line)" }}>
                                        <td className="p-3 align-top">{e.n}</td>
                                        <td className="p-3 align-top">{fmtRoll(e)}</td>
                                        <td className="p-3 align-top">
                                            {e.defenseMode} {e.defenseRoll.total}
                                            {e.counterRoll ? ` (counter ${e.counterRoll.total})` : ""}
                                        </td>
                                        <td className="p-3 align-top" style={{ color: "var(--neon-lime)" }}>
                                            {e.winner}
                                        </td>
                                        <td className="p-3 align-top opacity-80">
                                            {e.damage}
                                            {e.note ? ` — ${e.note}` : ""}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {result.blaze && (
                        <p className="tag-mono mt-3" style={{ color: "var(--blood)" }}>
                            BLAZE OF GLORY: {result.blaze.who} took {result.blaze.selfDamage} self-damage
                            {result.blaze.died ? " — did not survive it." : " — and it paid off."}
                        </p>
                    )}
                </section>
            )}

            {tellings.length > 0 && (
                <section className="mb-8">
                    <h2 className="text-2xl mb-3">DUELING TELLINGS</h2>
                    <div className="grid gap-6" style={{ gridTemplateColumns: tellings.length > 1 ? "1fr 1fr" : "1fr" }}>
                        {tellings.map((t) => (
                            <div key={t.pcId} className="panel p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="tag-mono">{t.pcId}</span>
                                    {verdict?.canonPcId === t.pcId ? (
                                        <span className="canon-badge">✅ CANON</span>
                                    ) : (
                                        <span className="apocrypha-badge">📜 APOCRYPHA</span>
                                    )}
                                </div>
                                <h3 className="text-xl mb-2">{t.title}</h3>
                                <div className="whitespace-pre-wrap leading-relaxed opacity-90 mb-4">
                                    {t.prose}
                                </div>
                                {t.panels?.length > 0 && (
                                    <details>
                                        <summary className="tag-mono cursor-pointer" style={{ color: "var(--neon-cyan)" }}>
                                            comic script ({t.panels.length} panels)
                                        </summary>
                                        <div className="mt-3 flex flex-col gap-3">
                                            {t.panels.map((p) => (
                                                <div key={p.n} className="border-l-2 pl-3" style={{ borderColor: "var(--line-bright)" }}>
                                                    <div className="tag-mono opacity-70">
                                                        PANEL {p.n} [{p.shot}]
                                                    </div>
                                                    <div className="text-sm opacity-90">{p.description}</div>
                                                    {p.sfx && (
                                                        <div className="text-sm" style={{ color: "var(--neon-gold)" }}>
                                                            SFX: {p.sfx}
                                                        </div>
                                                    )}
                                                    {p.dialogue?.map((d, i) => (
                                                        <div key={i} className="text-sm opacity-80">
                                                            <strong>{d.speaker}</strong> ({d.kind}): &ldquo;{d.text}&rdquo;
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {verdict && (
                <section>
                    <h2 className="text-2xl mb-3">THE ARBITER&apos;S VERDICT</h2>
                    <div className="panel p-5">
                        <div className="flex gap-4 mb-3 flex-wrap">
                            {Object.entries(verdict.scores).map(([pcId, score]) => (
                                <span key={pcId} className="tag-mono">
                                    {pcId}: <strong style={{ color: "var(--neon-gold)" }}>{score}/10</strong>
                                </span>
                            ))}
                        </div>
                        <blockquote
                            className="leading-relaxed italic pl-4"
                            style={{ borderLeft: "3px solid var(--neon-gold)" }}
                        >
                            {verdict.critique}
                        </blockquote>
                    </div>
                </section>
            )}
        </div>
    );
}
