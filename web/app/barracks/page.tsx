import { createClient } from "@/lib/supabase/server";
import type { Character } from "@/lib/types";
import BarracksClient from "./barracks-client";

export default async function BarracksPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: characters } = await supabase
        .from("afwar_characters")
        .select("*")
        .eq("owner_id", user?.id ?? "")
        .order("created_at", { ascending: false });

    return (
        <div>
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-6">
                <h1 className="text-4xl">YOUR CHARACTERS</h1>
                <span className="tag-mono">the Barracks</span>
            </div>
            <BarracksClient initialCharacters={(characters as Character[]) ?? []} />
        </div>
    );
}
