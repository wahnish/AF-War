import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ensureProfile, applyReferral } from "@/lib/referral";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    if (code) {
        const supabase = await createClient();
        const { error, data } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.user) {
            // Referral completion (growth-spec item 3): detect first-ever
            // profile row for this user (= activation) and, if an af_invite
            // cookie is present, apply the both-sides $BAMF bonus + crew
            // auto-join, then clear the cookie. Best-effort — never blocks
            // login on failure.
            const service = createServiceClient();
            if (service) {
                try {
                    const { created } = await ensureProfile(service, data.user.id);
                    if (created) {
                        const cookieStore = await cookies();
                        const inviteCode = cookieStore.get("af_invite")?.value;
                        if (inviteCode) {
                            await applyReferral(service, data.user.id, inviteCode);
                        }
                    }
                } catch (e) {
                    console.error("[auth/callback] referral wiring failed:", e);
                }
            }

            const res = NextResponse.redirect(`${origin}${next}`);
            res.cookies.set("af_invite", "", { path: "/", maxAge: 0 });
            return res;
        }
    }

    return NextResponse.redirect(`${origin}/login`);
}
