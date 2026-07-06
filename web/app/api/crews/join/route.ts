import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Crew, Character } from "@/lib/types";

export const runtime = "nodejs";

// Join a crew (growth-spec item 2): v1 rule is ONE crew per player — joining
// sets crew_id on ALL of the caller's afwar_characters rows to this crew.
// Member count is re-counted server-side at write time (service-role) to
// prevent a race overfilling a crew — never trust the client's cached count.
export async function POST(req: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { crew_id?: string };
    if (!body.crew_id) return NextResponse.json({ error: "crew_id required" }, { status: 400 });

    const service = createServiceClient();
    if (!service) return NextResponse.json({ error: "service role key needed" }, { status: 501 });

    const { data: crewRow, error: crewErr } = await service
        .from("afwar_crews")
        .select("*")
        .eq("id", body.crew_id)
        .maybeSingle();
    if (crewErr) return NextResponse.json({ error: crewErr.message }, { status: 500 });
    const crew = crewRow as Crew | null;
    if (!crew) return NextResponse.json({ error: "crew not found" }, { status: 404 });

    const { data: myChars, error: myCharsErr } = await service
        .from("afwar_characters")
        .select("id, crew_id")
        .eq("owner_id", user.id);
    if (myCharsErr) return NextResponse.json({ error: myCharsErr.message }, { status: 500 });
    const mine = (myChars as Pick<Character, "id" | "crew_id">[]) ?? [];
    if (mine.length === 0) {
        return NextResponse.json({ error: "you have no characters yet" }, { status: 400 });
    }
    const free = mine.filter((c) => !c.crew_id);
    if (free.length === 0) {
        return NextResponse.json({ error: "all your characters already belong to a crew" }, { status: 400 });
    }

    // Re-count members server-side at write time (race-safe).
    const { count, error: countErr } = await service
        .from("afwar_characters")
        .select("id", { count: "exact", head: true })
        .eq("crew_id", crew.id);
    if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
    const maxSize = crew.max_size ?? 6;
    if ((count ?? 0) >= maxSize) {
        return NextResponse.json({ error: "crew is full" }, { status: 409 });
    }

    const { error: updateErr } = await service
        .from("afwar_characters")
        .update({ crew_id: crew.id })
        .eq("owner_id", user.id)
        .is("crew_id", null);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, crew_id: crew.id });
}
