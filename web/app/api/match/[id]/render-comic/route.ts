import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { adjustBamf } from "@/lib/bamf";
import { renderMatchComic } from "@/lib/comic";
import type { MatchRow, Character } from "@/lib/types";
import type { MatchResult } from "@/lib/engine/match";
import type { Telling } from "@/lib/agents/narrate";

export const runtime = "nodejs";
export const maxDuration = 300;

const RENDER_COST = 50;

// Comic rung upgrade (final polish round §1c): the owner of EITHER combatant
// on a match with no comic media yet can pay 50 $BAMF to render it via the
// same comic.ts cascade used automatically for round-best/death matches.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: matchId } = await params;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const service = createServiceClient();
    if (!service) return NextResponse.json({ error: "service role key needed" }, { status: 501 });

    const { data: matchRow, error: matchErr } = await service
        .from("afwar_matches")
        .select("*")
        .eq("id", matchId)
        .maybeSingle();
    if (matchErr) return NextResponse.json({ error: matchErr.message }, { status: 500 });
    const match = matchRow as MatchRow | null;
    if (!match) return NextResponse.json({ error: "match not found" }, { status: 404 });

    const existingMedia = (match.media as { kind?: string }[] | null) ?? [];
    if (existingMedia.some((m) => m?.kind === "comic-page")) {
        return NextResponse.json({ error: "this match already has comic pages" }, { status: 400 });
    }

    const charIds = [match.a_character, match.b_character].filter((x): x is string => Boolean(x));
    const { data: charRows, error: charsErr } = charIds.length
        ? await service.from("afwar_characters").select("*").in("id", charIds)
        : { data: [] as Character[], error: null };
    if (charsErr) return NextResponse.json({ error: charsErr.message }, { status: 500 });
    const characters = (charRows ?? []) as Character[];
    const aChar = characters.find((c) => c.id === match.a_character);
    const bChar = characters.find((c) => c.id === match.b_character);

    const isOwner = characters.some((c) => c.owner_id === user.id);
    if (!isOwner) {
        return NextResponse.json({ error: "only an owner of either combatant may commission this render" }, { status: 403 });
    }
    if (!aChar || !bChar) {
        return NextResponse.json({ error: "both combatants must be resolved characters" }, { status: 400 });
    }

    const tellings = (match.tellings as Telling[] | null) ?? [];
    const verdict = match.verdict;
    const canonTelling = (verdict && tellings.find((t) => t.pcId === verdict.canonPcId)) ?? tellings[0];
    if (!canonTelling) {
        return NextResponse.json({ error: "this match has no narration to render from yet" }, { status: 400 });
    }

    const spend = await adjustBamf(service, user.id, -RENDER_COST, "comic_render", matchId);
    if (!spend.ok) return NextResponse.json({ error: spend.error ?? "insufficient $BAMF balance" }, { status: 400 });

    try {
        const pages = await renderMatchComic(service, {
            matchId,
            round: match.round,
            result: match.dice_transcript as MatchResult,
            canonTelling,
            aName: aChar.name,
            aBio: aChar.bio ?? "",
            aSheetUrl: aChar.model_sheet_url,
            bName: bChar.name,
            bBio: bChar.bio ?? "",
            bSheetUrl: bChar.model_sheet_url,
        });

        if (!pages.length) {
            // refund — the render produced nothing usable
            await adjustBamf(service, user.id, RENDER_COST, "comic_render", matchId);
            return NextResponse.json({ error: "render failed — $BAMF refunded" }, { status: 500 });
        }

        const media = pages.map((url) => ({ url, kind: "comic-page" }));
        await service.from("afwar_matches").update({ media }).eq("id", matchId);

        // patch the feed post's media too, same as the auto-cascade does
        const { data: feedPost } = await service
            .from("afwar_posts")
            .select("id, media")
            .eq("kind", "match")
            .contains("media", [{ match_id: matchId }])
            .maybeSingle();
        if (feedPost) {
            await service.from("afwar_posts").update({ media: [{ match_id: matchId }, ...media] }).eq("id", feedPost.id);
        }

        return NextResponse.json({ pages, balance: spend.balance });
    } catch (e) {
        // refund on hard failure
        await adjustBamf(service, user.id, RENDER_COST, "comic_render", matchId);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "render failed — $BAMF refunded" },
            { status: 500 }
        );
    }
}
