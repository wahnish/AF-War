import { createClient } from "@/lib/supabase/server";
import type { CanonCast } from "@/lib/types";
import AdminClient from "./admin-client";

export default async function AdminPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    let role: string | null = null;
    if (user) {
        const { data: profile } = await supabase
            .from("afwar_profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
        role = (profile as { role: string } | null)?.role ?? null;
    }

    if (role !== "gm") {
        return (
            <div className="text-center py-24">
                <h1 className="text-4xl mb-3">ADMIN</h1>
                <p className="tag-mono opacity-60">GM role required. Ask the GM to promote your profile.</p>
            </div>
        );
    }

    const { data: cast } = await supabase
        .from("afwar_canon_cast")
        .select("*")
        .order("created_at", { ascending: true });

    return (
        <div>
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-6">
                <h1 className="text-4xl">CANON CAST ADMIN</h1>
                <span className="tag-mono">GM console</span>
            </div>
            <AdminClient initialCast={(cast as CanonCast[]) ?? []} />
        </div>
    );
}
