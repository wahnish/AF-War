"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Character, Season, Bet } from "@/lib/types";

export default function ArcadeClient({
    season,
    characters,
    initialBets,
    initialBamf,
}: {
    season: Season | null;
    characters: Character[];
    initialBets: Bet[];
    initialBamf: number;
}) {
    const [bamf, setBamf] = useState(initialBamf);
    const [bets, setBets] = useState(initialBets);
    const [characterId, setCharacterId] = useState(characters[0]?.id ?? "");
    const [amount, setAmount] = useState(10);
    const [placing, setPlacing] = useState(false);
    const [error, setError] = useState("");

    const round = season?.state?.round ?? 0;
    const alreadyBetThisRound = bets.some((b) => b.round === round && b.status === "open");

    async function placeBet() {
        if (!season) {
            setError("No active season.");
            return;
        }
        if (amount <= 0 || amount > bamf) {
            setError("Bet must be between 1 and your current balance.");
            return;
        }
        setPlacing(true);
        setError("");
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            setError("Not signed in.");
            setPlacing(false);
            return;
        }

        const { data, error } = await supabase
            .from("afwar_bets")
            .insert({
                user_id: user.id,
                season_id: season.id,
                round,
                on_character: characterId,
                amount,
                status: "open",
            })
            .select("*")
            .single();

        if (error) {
            setError(error.message);
        } else {
            setBets([data as Bet, ...bets]);
            setBamf(bamf - amount);
        }
        setPlacing(false);
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="panel p-5 max-w-xl">
                <h2 className="text-xl mb-3">PLACE A BET — ROUND {round}</h2>
                <p className="text-sm opacity-70 mb-4">
                    Wager on a character to win ANY match this round. Win → 2x payout. Lose or no match → stake is gone.
                </p>
                {!season ? (
                    <p className="tag-mono opacity-60">No active season yet.</p>
                ) : alreadyBetThisRound ? (
                    <p className="tag-mono" style={{ color: "var(--neon-lime)" }}>
                        You already have an open bet this round. Wait for it to settle.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div>
                            <label className="field-label">Character</label>
                            <select value={characterId} onChange={(e) => setCharacterId(e.target.value)}>
                                {characters.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <span className="tag-mono block mb-1">Amount: {amount} $BAMF</span>
                            <input
                                type="range"
                                min={1}
                                max={Math.max(1, bamf)}
                                value={Math.min(amount, Math.max(1, bamf))}
                                onChange={(e) => setAmount(Number(e.target.value))}
                            />
                        </div>
                        {error && (
                            <p className="tag-mono" style={{ color: "var(--blood)" }}>
                                {error}
                            </p>
                        )}
                        <button className="btn btn-magenta" onClick={placeBet} disabled={placing || !characterId || bamf <= 0}>
                            {placing ? "Placing…" : `Bet ${amount} $BAMF`}
                        </button>
                    </div>
                )}
            </div>

            <div>
                <h2 className="text-xl mb-3">YOUR BETS</h2>
                {bets.length === 0 ? (
                    <p className="tag-mono opacity-60">No bets yet.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {bets.map((b) => (
                            <div key={b.id} className="panel p-3 flex justify-between items-center">
                                <span className="tag-mono">
                                    Round {b.round} · {characters.find((c) => c.id === b.on_character)?.name ?? b.on_character} ·{" "}
                                    {b.amount} $BAMF
                                </span>
                                <span
                                    className="tag-mono"
                                    style={{
                                        color:
                                            b.status === "won"
                                                ? "var(--neon-lime)"
                                                : b.status === "lost"
                                                ? "var(--blood)"
                                                : "var(--neon-cyan)",
                                    }}
                                >
                                    {b.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
