import { ZONES } from "@/lib/engine/map";
import { coordFor } from "@/lib/zoneLayout";
import type { SerializedSeasonState } from "@/lib/serialize";
import type { Season } from "@/lib/types";

const CREW_COLORS = [
    "#ff2fb0", // neon-magenta
    "#33f6e8", // neon-cyan
    "#c8ff3d", // neon-lime
    "#ffcf40", // neon-gold
    "#7a8cff", // periwinkle
    "#ff7a45", // ember
];

async function getSeason(): Promise<Season | null> {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    try {
        const { headers } = await import("next/headers");
        const h = await headers();
        const host = h.get("x-forwarded-host") ?? h.get("host");
        const proto = h.get("x-forwarded-proto") ?? "http";
        const url = base || (host ? `${proto}://${host}` : "");
        const res = await fetch(`${url}/api/season/current`, { cache: "no-store" });
        if (!res.ok) return null;
        const json = await res.json();
        return json.season ?? null;
    } catch {
        return null;
    }
}

export default async function MapPage() {
    const season = await getSeason();
    const state = season?.state as SerializedSeasonState | null | undefined;

    if (!season || !state) {
        return (
            <div className="text-center py-24">
                <h1 className="text-4xl mb-3">THE MAP</h1>
                <p className="tag-mono" style={{ color: "var(--corrupt)" }}>
                    The Glome is quiet.
                </p>
            </div>
        );
    }

    const crewIds = Object.keys(state.crews);
    const crewColor = new Map(crewIds.map((id, i) => [id, CREW_COLORS[i % CREW_COLORS.length]]));

    const finaleId = ZONES.find((z) => z.finale)?.id;

    return (
        <div>
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-2">
                <h1 className="text-4xl">THE MAP</h1>
                <span className="tag-mono">
                    round {state.round} · {season.name}
                </span>
            </div>
            <p className="tag-mono mb-6 opacity-70">
                Hyper-Brooklyn. The Primordial stirs beneath the Gowanus — corrupted zones go
                purple-black, uncontrollable, unattackable. Dodgers Stadium rings gold: sealed until
                the convergence.
            </p>

            <div className="panel p-4 mb-6 overflow-x-auto">
                <svg viewBox="0 0 720 800" className="w-full" style={{ minWidth: 600, maxHeight: 820 }}>
                    <defs>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* edges */}
                    {ZONES.map((z) =>
                        z.adjacent
                            .filter((adj) => adj > z.id) // draw each edge once
                            .map((adj) => {
                                const a = coordFor(z.id, 0, ZONES.length);
                                const b = coordFor(adj, 0, ZONES.length);
                                return (
                                    <line
                                        key={`${z.id}-${adj}`}
                                        x1={a.x}
                                        y1={a.y}
                                        x2={b.x}
                                        y2={b.y}
                                        stroke="var(--line-bright)"
                                        strokeWidth={1}
                                    />
                                );
                            })
                    )}

                    {/* nodes */}
                    {ZONES.map((z, i) => {
                        const { x, y } = coordFor(z.id, i, ZONES.length);
                        const zs = state.zones[z.id];
                        const corrupted = zs?.corrupted;
                        const controlledBy = zs?.controlledBy;
                        const color = controlledBy ? crewColor.get(controlledBy) : "#4a4560";
                        const isFinale = z.id === finaleId;

                        return (
                            <g key={z.id}>
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={isFinale ? 26 : 20}
                                    fill={corrupted ? "url(#corruptFill)" : "var(--void)"}
                                    stroke={corrupted ? "#3a1060" : isFinale ? "var(--neon-gold)" : color}
                                    strokeWidth={isFinale ? 3 : 2}
                                    style={{ filter: isFinale ? "url(#glow)" : undefined }}
                                />
                                {corrupted && (
                                    <text x={x} y={y + 6} textAnchor="middle" fontSize={16} fill="#c88bff">
                                        ☠
                                    </text>
                                )}
                                {!corrupted && controlledBy && (
                                    <circle cx={x} cy={y} r={7} fill={color} />
                                )}
                                <text
                                    x={x}
                                    y={y + (isFinale ? 42 : 34)}
                                    textAnchor="middle"
                                    fontSize={10}
                                    fontFamily="var(--font-mono)"
                                    fill="#cfc9e0"
                                >
                                    {z.name}
                                </text>
                            </g>
                        );
                    })}

                    <defs>
                        <radialGradient id="corruptFill">
                            <stop offset="0%" stopColor="#2a0a4a" />
                            <stop offset="100%" stopColor="#07060b" />
                        </radialGradient>
                    </defs>
                </svg>
            </div>

            <div className="flex flex-wrap gap-4">
                {crewIds.map((id) => {
                    const crew = state.crews[id];
                    return (
                        <div key={id} className="chip" data-active="true" style={{ borderColor: crewColor.get(id), color: crewColor.get(id) }}>
                            <span
                                className="inline-block w-2 h-2 rounded-full mr-2"
                                style={{ background: crewColor.get(id) }}
                            />
                            {crew.name} — {crew.zones.length} zones
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
