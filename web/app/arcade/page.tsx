import { createClient } from "@/lib/supabase/server";
import type { Character, Season, Bet } from "@/lib/types";
import ArcadeClient from "./arcade-client";

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
        </div>
    );
}
