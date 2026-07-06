import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { adjustBamf } from "@/lib/bamf";
import type { Post, Character } from "@/lib/types";

export const runtime = "nodejs";

const ALLOWED_AMOUNTS = [5, 10, 25];

// Tip a post's author_character's OWNER. Split: owner gets 80%, house keeps
// 20% (just burned — no house account needed). Ledger reasons: 'tip_sent'
// (tipper, -amount) / 'tip_received' (owner, +80%). Bumps posts.tip_count/
// tip_total for the feed badge.
export async function POST(req: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { postId?: string; amount?: number };
    const { postId, amount } = body;
    if (!postId || !amount || !ALLOWED_AMOUNTS.includes(amount)) {
        return NextResponse.json({ error: "postId and amount (5|10|25) required" }, { status: 400 });
    }

    const service = createServiceClient();
    if (!service) return NextResponse.json({ error: "service role key needed" }, { status: 501 });

    const { data: postRow, error: postErr } = await service
        .from("afwar_posts")
        .select("*")
        .eq("id", postId)
        .maybeSingle();
    if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
    const post = postRow as Post | null;
    if (!post) return NextResponse.json({ error: "post not found" }, { status: 404 });
    if (!post.author_character) {
        return NextResponse.json({ error: "this post has no author_character to tip" }, { status: 400 });
    }

    const { data: charRow, error: charErr } = await service
        .from("afwar_characters")
        .select("*")
        .eq("id", post.author_character)
        .maybeSingle();
    if (charErr) return NextResponse.json({ error: charErr.message }, { status: 500 });
    const character = charRow as Character | null;
    if (!character) return NextResponse.json({ error: "author character not found" }, { status: 404 });

    if (character.owner_id === user.id) {
        return NextResponse.json({ error: "you can't tip your own character" }, { status: 400 });
    }

    // tipper pays the full amount
    const spend = await adjustBamf(service, user.id, -amount, "tip_sent", postId);
    if (!spend.ok) return NextResponse.json({ error: spend.error ?? "insufficient balance" }, { status: 400 });

    // owner receives 80%; house (20%) is just burned, no account
    const ownerShare = Math.floor(amount * 0.8);
    const earn = await adjustBamf(service, character.owner_id, ownerShare, "tip_received", postId);
    if (!earn.ok) {
        // refund the tipper if crediting the owner failed, so a partial
        // failure never leaves $BAMF vanishing into nowhere
        await adjustBamf(service, user.id, amount, "tip_sent", postId);
        return NextResponse.json({ error: earn.error ?? "failed to credit owner" }, { status: 500 });
    }

    const { data: updatedPost, error: bumpErr } = await service
        .from("afwar_posts")
        .update({ tip_count: (post.tip_count ?? 0) + 1, tip_total: (post.tip_total ?? 0) + amount })
        .eq("id", postId)
        .select("tip_count, tip_total")
        .single();
    if (bumpErr) console.error("[bamf/tip] failed to bump post tip counters:", bumpErr);

    return NextResponse.json({
        balance: spend.balance,
        ownerCredited: ownerShare,
        tipCount: updatedPost?.tip_count ?? (post.tip_count ?? 0) + 1,
        tipTotal: updatedPost?.tip_total ?? (post.tip_total ?? 0) + amount,
    });
}
