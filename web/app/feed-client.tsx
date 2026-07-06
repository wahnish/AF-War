"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Post } from "@/lib/types";

const TIP_AMOUNTS = [5, 10, 25] as const;

const FILTERS = ["All", "Gazette", "Matches", "Downtime"] as const;
type Filter = (typeof FILTERS)[number];

const KIND_FOR_FILTER: Record<Filter, Post["kind"] | null> = {
    All: null,
    Gazette: "gazette",
    Matches: "match",
    Downtime: "downtime",
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export default function FeedClient({ posts }: { posts: Post[] }) {
    const [filter, setFilter] = useState<Filter>("All");

    const kind = KIND_FOR_FILTER[filter];
    const visible = kind ? posts.filter((p) => p.kind === kind) : posts;

    return (
        <div>
            <div className="flex gap-2 mb-8 flex-wrap">
                {FILTERS.map((f) => (
                    <button
                        key={f}
                        className="chip"
                        data-active={filter === f}
                        onClick={() => setFilter(f)}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {visible.length === 0 && (
                <p className="tag-mono opacity-60">No posts yet. The Gazette is between editions.</p>
            )}

            <div className="flex flex-col gap-6">
                {visible.map((post) => (
                    <PostCard key={post.id} post={post} />
                ))}
            </div>
        </div>
    );
}

function PostCard({ post }: { post: Post }) {
    if (post.kind === "gazette") {
        return (
            <article className="clipping max-w-2xl">
                <div className="tag-mono mb-1" style={{ color: "var(--corrupt)", opacity: 0.7 }}>
                    HYPER-BROOKLYN GAZETTE {post.round != null ? `· ROUND ${post.round}` : ""}
                </div>
                <h3>{post.title}</h3>
                <div className="whitespace-pre-wrap leading-relaxed mt-2">{post.body}</div>
                <div className="tag-mono mt-3 opacity-60" style={{ color: "var(--ink)" }}>
                    {formatDate(post.created_at)}
                </div>
            </article>
        );
    }

    if (post.kind === "match") {
        const media = (post.media ?? []) as Array<Record<string, unknown>>;
        const matchId = media.find((m) => typeof m?.match_id === "string")?.match_id as
            | string
            | undefined;
        if (matchId) {
            return (
                <Link
                    href={`/match/${matchId}`}
                    className="panel p-5 block hover:border-[var(--neon-cyan)] transition-colors"
                >
                    <MatchCardBody post={post} />
                </Link>
            );
        }
        return (
            <div className="panel p-5">
                <MatchCardBody post={post} />
            </div>
        );
    }

    return (
        <article className="panel p-5">
            <div className="flex items-center justify-between mb-2">
                <span className="tag-mono" style={{ color: post.kind === "system" ? "var(--neon-cyan)" : "var(--neon-lime)" }}>
                    {post.kind === "system" ? "SYSTEM" : "DOWNTIME"}
                </span>
                <span className="tag-mono opacity-50">{formatDate(post.created_at)}</span>
            </div>
            <h3 className="text-2xl mb-2">{post.title}</h3>
            <div className="whitespace-pre-wrap leading-relaxed opacity-90">{post.body}</div>
            {post.author_character && <TipBar post={post} />}
        </article>
    );
}

// $BAMF tips (final polish round §1b): 💸 on posts with an author_character.
// Tipper pays the full amount; the character's OWNER receives 80% (house
// keeps 20%, just burned — no house account). Shows the post's running tip
// count once at least one tip has landed.
function TipBar({ post }: { post: Post }) {
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState<number | null>(null);
    const [tipCount, setTipCount] = useState(post.tip_count ?? 0);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const [loggedIn, setLoggedIn] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        createClient()
            .auth.getUser()
            .then(({ data: { user } }) => {
                if (!cancelled) setLoggedIn(Boolean(user));
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function tip(amount: number) {
        setSending(amount);
        setError("");
        try {
            const res = await fetch("/api/bamf/tip", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ postId: post.id, amount }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "tip failed");
            setTipCount(json.tipCount ?? tipCount + 1);
            setDone(true);
            setTimeout(() => setDone(false), 2500);
        } catch (e) {
            setError(e instanceof Error ? e.message : "tip failed");
        } finally {
            setSending(null);
        }
    }

    if (loggedIn === false) {
        return (
            <div className="mt-3 pt-3 flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid var(--line)" }}>
                <Link className="tag-mono" style={{ color: "var(--neon-gold)" }} href="/login">
                    💸 log in to tip{tipCount > 0 ? ` (${tipCount})` : ""}
                </Link>
            </div>
        );
    }

    return (
        <div className="mt-3 pt-3 flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid var(--line)" }}>
            {!open ? (
                <button className="tag-mono" style={{ color: "var(--neon-gold)" }} onClick={() => setOpen(true)}>
                    💸 Tip{tipCount > 0 ? ` (${tipCount})` : ""}
                </button>
            ) : (
                <>
                    {TIP_AMOUNTS.map((amount) => (
                        <button
                            key={amount}
                            className="chip"
                            onClick={() => tip(amount)}
                            disabled={sending !== null}
                        >
                            {sending === amount ? "…" : `💸 ${amount}`}
                        </button>
                    ))}
                    <button className="tag-mono opacity-60" onClick={() => setOpen(false)}>
                        close
                    </button>
                </>
            )}
            {done && (
                <span className="tag-mono" style={{ color: "var(--neon-lime)" }}>
                    Sent.
                </span>
            )}
            {error && (
                <span className="tag-mono" style={{ color: "var(--blood)" }}>
                    {error}
                </span>
            )}
        </div>
    );
}

function MatchCardBody({ post }: { post: Post }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="tag-mono" style={{ color: "var(--blood)" }}>
                    MATCH {post.round != null ? `· ROUND ${post.round}` : ""}
                </span>
                <span className="tag-mono opacity-50">{formatDate(post.created_at)}</span>
            </div>
            <h3 className="text-2xl mb-2">{post.title}</h3>
            <div className="whitespace-pre-wrap leading-relaxed opacity-90 line-clamp-3">{post.body}</div>
            <div className="tag-mono mt-3" style={{ color: "var(--neon-cyan)" }}>
                view match room →
            </div>
        </div>
    );
}
