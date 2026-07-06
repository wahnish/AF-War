import { createClient } from "@/lib/supabase/server";
import type { SerializedSeasonState } from "@/lib/serialize";
import type { CanonEvent } from "@/lib/engine/season";
import type { Season } from "@/lib/types";

async function getSeason(): Promise<Season | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("afwar_seasons")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    return (data as Season) ?? null;
}

export default async function LedgerPage() {
    const season = await getSeason();
    const state = season?.state as SerializedSeasonState | null | undefined;

    if (!season || !state) {
        return (
            <div className="text-center py-24">
                <h1 className="text-4xl mb-3">THE LEDGER</h1>
                <p className="tag-mono" style={{ color: "var(--corrupt)" }}>
                    The Glome is quiet. No season's blood has been spilled yet.
                </p>
            </div>
        );
    }

    const crews = Object.values(state.crews).sort(
        (a, b) =>
            b.zones.length +
            Object.values(state.pcs).filter((p) => p.crewId === b.id).reduce((k, p) => k + p.kills, 0) -
            (a.zones.length +
                Object.values(state.pcs).filter((p) => p.crewId === a.id).reduce((k, p) => k + p.kills, 0))
    );

    const pcs = Object.values(state.pcs).sort((a, b) => b.kills - a.kills);
    const killLeaders = pcs.filter((p) => p.kills > 0);

    const canon = (state.canon ?? []) as CanonEvent[];
    const fallen = canon.filter((e) => e.kind === "death");
    const marked = canon.filter((e) => e.kind === "scar");
    const raised = canon.filter((e) => e.kind === "resurrection");
    const betrayals = canon.filter((e) => e.kind === "betrayal");

    const crewName = (id?: string) => (id ? state.crews[id]?.name ?? id : "the void");
    const pcName = (id?: string) => (id ? state.pcs[id]?.name ?? id : "someone");

    return (
        <div>
            <h1 className="text-4xl mb-1">⚖ THE LEDGER</h1>
            <p className="tag-mono mb-8 opacity-70">{season.name} · round {state.round}</p>

            <section className="mb-10">
                <h2 className="text-2xl mb-3">STANDINGS</h2>
                <div className="panel divide-y" style={{ borderColor: "var(--line)" }}>
                    {crews.map((c, i) => {
                        const kills = Object.values(state.pcs)
                            .filter((p) => p.crewId === c.id)
                            .reduce((k, p) => k + p.kills, 0);
                        const score = c.zones.length + kills;
                        return (
                            <div
                                key={c.id}
                                className="flex items-center justify-between p-4"
                                style={{ borderColor: "var(--line)" }}
                            >
                                <div>
                                    <span className="tag-mono mr-3" style={{ color: "var(--neon-gold)" }}>
                                        #{i + 1}
                                    </span>
                                    <strong>{c.name}</strong>
                                    {state.finaleWinner === c.id && (
                                        <span className="ml-2" style={{ color: "var(--neon-gold)" }}>
                                            👑 CHAMPION
                                        </span>
                                    )}
                                    <div className="tag-mono opacity-60">{c.motto}</div>
                                </div>
                                <div className="tag-mono">
                                    {score} pts · {c.zones.length} zones · {kills} kills
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="mb-10">
                <h2 className="text-2xl mb-3">KILL LEADERBOARD</h2>
                {killLeaders.length === 0 ? (
                    <p className="tag-mono opacity-60">Not a scratch worth writing down.</p>
                ) : (
                    <div className="panel divide-y" style={{ borderColor: "var(--line)" }}>
                        {killLeaders.map((p) => (
                            <div key={p.id} className="flex justify-between p-3" style={{ borderColor: "var(--line)" }}>
                                <span>
                                    <strong>{p.name}</strong>{" "}
                                    <span className="tag-mono opacity-60">({crewName(p.crewId)})</span>
                                </span>
                                <span style={{ color: "var(--blood)" }}>{p.kills}</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <div className="grid md:grid-cols-2 gap-8">
                <section>
                    <h2 className="text-2xl mb-3" style={{ color: "var(--blood)" }}>
                        THE FALLEN ☠
                    </h2>
                    {fallen.length === 0 ? (
                        <p className="tag-mono opacity-60">Everyone's still standing. For now.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {fallen.map((e, i) => (
                                <li key={i} className="panel p-3 text-sm">
                                    R{e.round}: <strong>{pcName(e.pcId)}</strong> — killed by{" "}
                                    {pcName(e.killedBy)} at {e.zoneId}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section>
                    <h2 className="text-2xl mb-3" style={{ color: "var(--neon-gold)" }}>
                        THE MARKED ⚔
                    </h2>
                    {marked.length === 0 ? (
                        <p className="tag-mono opacity-60">Not a scratch worth writing down.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {marked.map((e, i) => (
                                <li key={i} className="panel p-3 text-sm">
                                    R{e.round}: <strong>{pcName(e.pcId)}</strong> scarred by{" "}
                                    {pcName(e.authoredBy)} at {e.zoneId}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section>
                    <h2 className="text-2xl mb-3" style={{ color: "var(--neon-lime)" }}>
                        THE RAISED ↩
                    </h2>
                    {raised.length === 0 ? (
                        <p className="tag-mono opacity-60">Graves End reports no customers. Business is bad.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {raised.map((e, i) => (
                                <li key={i} className="panel p-3 text-sm">
                                    R{e.round}: <strong>{pcName(e.pcId)}</strong> refurbished by{" "}
                                    {crewName(e.byCrew)} (cost {e.cost})
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section>
                    <h2 className="text-2xl mb-3" style={{ color: "var(--neon-magenta)" }}>
                        BETRAYALS 🗡
                    </h2>
                    {betrayals.length === 0 ? (
                        <p className="tag-mono opacity-60">Alliances holding. Suspiciously.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {betrayals.map((e, i) => (
                                <li key={i} className="panel p-3 text-sm">
                                    R{e.round}: <strong>{crewName(e.traitor)}</strong> turned on{" "}
                                    {crewName(e.victim)} at {e.zoneId}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
