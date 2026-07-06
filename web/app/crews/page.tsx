import { createClient } from "@/lib/supabase/server";
import type { Crew, Character } from "@/lib/types";
import { computeScarcity } from "@/lib/scarcity";
import CrewsClient from "./crews-client";

export interface CrewWithRoster extends Crew {
    max_size: number;
    founder_id: string | null;
    members: Pick<Character, "id" | "name" | "clout" | "owner_id">[];
}

export default async function CrewsPage() {
    const supabase = await createClient();

    const [{ data: crews }, { data: characters }, scarcity] = await Promise.all([
        supabase.from("afwar_crews").select("*").order("created_at", { ascending: true }),
        supabase.from("afwar_characters").select("id,name,clout,owner_id,crew_id,status"),
        computeScarcity(supabase),
    ]);

    const allChars = (characters as (Pick<Character, "id" | "name" | "clout" | "owner_id" | "crew_id" | "status">)[]) ?? [];

    const crewsWithRoster: CrewWithRoster[] = ((crews as Crew[]) ?? []).map((c) => ({
        ...c,
        max_size: (c as unknown as { max_size: number }).max_size ?? 6,
        founder_id: (c as unknown as { founder_id: string | null }).founder_id ?? null,
        members: allChars.filter((ch) => ch.crew_id === c.id),
    }));

    const scarcityLine = scarcity.line;

    return (
        <div>
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-2">
                <h1 className="text-4xl">🏴 CREWS</h1>
                <span className="tag-mono">2–6 beings, held together by vibes and debts</span>
            </div>
            {scarcityLine && (
                <p className="tag-mono mb-6" style={{ color: "var(--neon-gold)" }}>
                    {scarcityLine}
                </p>
            )}
            <CrewsClient crews={crewsWithRoster} />
        </div>
    );
}
