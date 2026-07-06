import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeScarcity } from "@/lib/scarcity";

export const runtime = "nodejs";

// Scarcity surface (growth-spec §2f / item 5), fetched client-side by the
// login page (a client component). Public-read tables only — no auth
// required, matches the honest-waitlist framing ("Season 2: 40 APE Passes
// remaining" should be visible to someone deciding whether to sign up).
export async function GET() {
    const supabase = await createClient();
    const scarcity = await computeScarcity(supabase);
    return NextResponse.json(scarcity);
}
