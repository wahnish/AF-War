"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
    { href: "/", label: "FEED" },
    { href: "/map", label: "MAP" },
    { href: "/barracks", label: "BARRACKS" },
    { href: "/ledger", label: "LEDGER" },
    { href: "/guide", label: "GUIDE" },
    { href: "/gm", label: "GM" },
];

export default function NavShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const hideChrome = pathname?.startsWith("/login");

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
        </div>
    );
}
