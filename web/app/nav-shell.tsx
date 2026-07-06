"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
    { href: "/", label: "FEED" },
    { href: "/map", label: "MAP" },
    { href: "/barracks", label: "BARRACKS" },
    { href: "/ledger", label: "LEDGER" },
    { href: "/guide", label: "GUIDE" },
    { href: "/arcade", label: "ARCADE" },
    { href: "/gm", label: "GM" },
    { href: "/admin", label: "ADMIN" },
];

export default function NavShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const hideChrome = pathname?.startsWith("/login");
    const [bamf, setBamf] = useState<number | null>(null);
    const [faucetToast, setFaucetToast] = useState<string | null>(null);

    useEffect(() => {
        if (hideChrome) return;
        let cancelled = false;
        const supabase = createClient();
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (!user || cancelled) return;
            const { data } = await supabase.from("afwar_profiles").select("bamf").eq("id", user.id).maybeSingle();
            if (!cancelled) setBamf((data as { bamf: number } | null)?.bamf ?? null);
        });
        return () => {
            cancelled = true;
        };
    }, [hideChrome, pathname]);

    // Daily $BAMF faucet (final polish round §1a): fired once per session
    // mount (not on every pathname change — the route itself is idempotent
    // per UTC day, but there's no reason to hit it on every nav). Shows a
    // toast + bumps the displayed balance when the faucet actually grants.
    useEffect(() => {
        if (hideChrome) return;
        let cancelled = false;
        fetch("/api/bamf/faucet", { method: "POST" })
            .then((r) => r.json())
            .then((json: { granted?: boolean; balance?: number; error?: string }) => {
                if (cancelled || json.error) return;
                if (typeof json.balance === "number") setBamf(json.balance);
                if (json.granted) {
                    setFaucetToast("+25 $BAMF — daily faucet");
                    setTimeout(() => !cancelled && setFaucetToast(null), 5000);
                }
            })
            .catch(() => {
                // not signed in yet, or offline — silently skip, the balance
                // fetch above is the source of truth for display
            });
        return () => {
            cancelled = true;
        };
    }, [hideChrome]);

    async function logout() {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    }

    if (hideChrome) {
        return <>{children}</>;
    }

    return (
        <div className="flex flex-col min-h-full">
            <header className="border-b" style={{ borderColor: "var(--line)" }}>
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-baseline gap-3">
                        <Link href="/" className="wordmark leading-none">
                            AF WAR
                        </Link>
                        <span className="tag-mono">Season 1: The Glome Weakens</span>
                    </div>
                    <nav className="flex items-center gap-1 flex-wrap">
                        {bamf !== null && (
                            <span className="tag-mono px-3 py-2" style={{ color: "var(--neon-gold)" }}>
                                💰 {bamf} $BAMF
                            </span>
                        )}
                        {LINKS.map((l) => {
                            const active =
                                l.href === "/" ? pathname === "/" : pathname?.startsWith(l.href);
                            return (
                                <Link
                                    key={l.href}
                                    href={l.href}
                                    className="tag-mono px-3 py-2 rounded-sm transition-colors"
                                    style={{
                                        color: active ? "var(--neon-lime)" : undefined,
                                        background: active ? "rgba(200,255,61,0.08)" : undefined,
                                    }}
                                >
                                    {l.label}
                                </Link>
                            );
                        })}
                        <button
                            onClick={logout}
                            className="tag-mono px-3 py-2 rounded-sm transition-colors hover:text-[var(--neon-magenta)]"
                        >
                            LOGOUT
                        </button>
                    </nav>
                </div>
            </header>
            <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
            <footer className="tag-mono text-center py-6 opacity-50">
                the Glome breathes · dice are ground truth · your body is other people&apos;s writing
            </footer>
            {faucetToast && (
                <div
                    className="panel px-4 py-3 tag-mono"
                    style={{
                        position: "fixed",
                        bottom: 24,
                        right: 24,
                        color: "var(--neon-gold)",
                        borderColor: "var(--neon-gold)",
                        boxShadow: "0 0 20px rgba(255,207,64,0.2)",
                    }}
                >
                    💰 {faucetToast}
                </div>
            )}
        </div>
    );
}
