import { createClient } from "@/lib/supabase/server";
import FeedClient from "./feed-client";
import type { Post } from "@/lib/types";

export default async function FeedPage() {
    const supabase = await createClient();
    const { data: posts } = await supabase
        .from("afwar_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

    return (
        <div>
            <div className="flex items-baseline justify-between flex-wrap gap-3 mb-6">
                <h1 className="text-4xl">THE FEED</h1>
                <span className="tag-mono">every post is a being&apos;s update</span>
            </div>
            <FeedClient posts={(posts as Post[]) ?? []} />
        </div>
    );
}
