// Role-gating helper (schema-002 §5). Server-only. Checks the caller's
// afwar_profiles.role via the request's own auth cookie (createClient, NOT
// the service client) so RLS still applies to the read itself.
import { createClient } from "@/lib/supabase/server";

export async function requireGm(): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { ok: false, status: 401, error: "not signed in" };

    const { data: profile, error } = await supabase
        .from("afwar_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (error) return { ok: false, status: 500, error: error.message };
    if (!profile || profile.role !== "gm") return { ok: false, status: 401, error: "gm role required" };

    return { ok: true, userId: user.id };
}
