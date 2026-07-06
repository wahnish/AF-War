"use client";

import { useState } from "react";
import Link from "next/link";
import type { Post } from "@/lib/types";

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
        </article>
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
