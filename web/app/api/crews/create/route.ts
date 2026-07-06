import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Found a new crew (growth-spec item 2): available to any authenticated
// user. Creates the crew (founder_id = caller, max_size default 6) and sets
// crew_id on the founder's characters that don't already belong to a crew.
export async function POST(req: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { name?: string; motto?: string };
    if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

    const service = createServiceClient();
    if (!service) return NextResponse.json({ error: "service role key needed" }, { status: 501 });

    const { data: crew, error: insertErr } = await service
        .from("afwar_crews")
        .insert({ name: body.name.trim(), motto: body.motto?.trim() || null, founder_id: user.id })
        .select("*")
        .single();
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    const { error: updateErr } = await service
        .from("afwar_characters")
        .update({ crew_id: crew.id })
        .eq("owner_id", user.id)
        .is("crew_id", null);
    if (updateErr) {
        // crew already exists; report but don't fail the whole request — the
        // founder can still join their own crew manually via /crews.
        console.error("[crews/create] failed to auto-assign founder's characters:", updateErr);
    }

    return NextResponse.json({ ok: true, crew });
}
