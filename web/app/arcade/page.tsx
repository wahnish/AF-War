import { createClient } from "@/lib/supabase/server";
import type { Character, Season, Bet } from "@/lib/types";
import ArcadeClient from "./arcade-client";

interface LedgerRow {
    id: string;
    delta: number;
    reason: string;
    ref_id: string | null;
    created_at: string;
}

export default async function ArcadePage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    let bamf = 0;
    if (user) {
        const { data: profile } = await supabase.from("afwar_profiles").select("bamf").eq("id", user.id).maybeSingle();
        bamf = (profile as { bamf: number } | null)?.bamf ?? 0;
    }

    const { data: seasonRow } = await supabase
        .from("afwar_seasons")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    const season = seasonRow as Season | null;

    const { data: characters } = await supabase
        .from("afwar_characters")
        .select("*")
        .eq("status", "active")
        .order("name", { ascending: true });

    let myBets: Bet[] = [];
    let ledger: LedgerRow[] = [];
    if (user && season) {
        const { data } = await supabase
            .from("afwar_bets")
            .select("*")
            .eq("user_id", user.id)
            .eq("season_id", season.id)
            .order("created_at", { ascending: false })
            .limit(20);
        myBets = (data as Bet[]) ?? [];
    }
    if (user) {
        const { data } = await supabase
            .from("afwar_bamf_ledger")
            .select("id, delta, reason, ref_id, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10);
        ledger = (data as LedgerRow[]) ?? [];
    }

    return (
        <div>
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-6">
                <h1 className="text-4xl">THE ARCADES</h1>
                <span className="tag-mono">Chrono Bowl pools · $BAMF balance: {bamf}</span>
            </div>
            <ArcadeClient
                season={season}
                characters={(characters as Character[]) ?? []}
                initialBets={myBets}
                initialBamf={bamf}
            />

            <div className="mt-10">
                <h2 className="text-xl mb-3">$BAMF LEDGER — last 10</h2>
                {ledger.length === 0 ? (
                    <p className="tag-mono opacity-60">No $BAMF activity yet.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {ledger.map((row) => (
                            <div key={row.id} className="panel p-3 flex justify-between items-center">
                                <span className="tag-mono opacity-80">
                                    {row.reason} · {new Date(row.created_at).toLocaleString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </span>
                                <span
                                    className="tag-mono"
                                    style={{ color: row.delta >= 0 ? "var(--neon-lime)" : "var(--blood)" }}
                                >
                                    {row.delta >= 0 ? "+" : ""}
                                    {row.delta} $BAMF
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
