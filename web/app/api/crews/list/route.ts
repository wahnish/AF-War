import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Crew, Character } from "@/lib/types";

export const runtime = "nodejs";

// Public-read refresh endpoint for /crews (client-side re-fetch after
// join/create without a full page reload). Same anon-readable tables the
// server component already queries — no service-role needed.
export async function GET() {
    const supabase = await createClient();
    const [{ data: crews, error: crewsErr }, { data: characters, error: charsErr }] = await Promise.all([
        supabase.from("afwar_crews").select("*").order("created_at", { ascending: true }),
        supabase.from("afwar_characters").select("id,name,clout,owner_id,crew_id"),
    ]);
    if (crewsErr) return NextResponse.json({ error: crewsErr.message }, { status: 500 });
    if (charsErr) return NextResponse.json({ error: charsErr.message }, { status: 500 });

    const allChars = (characters as Character[]) ?? [];
    const result = ((crews as Crew[]) ?? []).map((c) => ({
        ...c,
        members: allChars.filter((ch) => ch.crew_id === c.id),
    }));

    return NextResponse.json({ crews: result });
}
