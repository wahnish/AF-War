import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { adjustBamf, hasLedgerReason } from "@/lib/bamf";
import { characterSheetPrompt } from "@/lib/prompts";

export const runtime = "nodejs";

const SHEET_GEN_COST = 25;

// FAL_KEY fallback chain (agents/llm.ts pattern), simplified for the web app:
// Next.js loads web/.env.local automatically, so put FAL_KEY there. We
// deliberately do NOT walk the filesystem for a sibling AFWar/.env here —
// Next's build-time file tracer flags cross-directory fs reads as an
// unbounded trace (see next.config.ts warning history) and .env.local is
// the documented, traced-safe way to supply server secrets in Next.
function resolveFalKey(): string | undefined {
    return process.env.FAL_KEY;
}

// The prompt is the ported FlowZilla 8-panel character turnaround template
// (web/lib/prompts.ts) — a 16:9 multi-angle sheet, not a single portrait.
async function nb2(prompt: string): Promise<string> {
    const result = (await fal.subscribe("fal-ai/nano-banana-2", {
        input: { prompt, aspect_ratio: "16:9" },
    })) as { data?: { images?: { url: string }[] } };
    const url = result.data?.images?.[0]?.url;
    if (!url) throw new Error("no image returned from nano-banana-2");
    return url;
}

// gpt-image-2 lane — VERIFIED shape from FlowZilla comics
// (app/api/v1/comics/[id]/generate-page/route.ts): slug 'openai/gpt-image-2',
// image_size 'portrait_4_3' is the one CONFIRMED enum value in that codebase
// (its aspect enum is fixed and has no verified 16:9/landscape option there —
// the brief's own comment notes "no 2:3" as the closest miss, so we do not
// speculate a landscape value here). The 8-panel sheet template still
// renders on a portrait canvas, just letterboxed rather than edge-to-edge —
// acceptable for a v1 alt-model option; nano-banana-2 (16:9 above) is the
// default lane for the correctly-proportioned sheet.
async function gptImage2(prompt: string): Promise<string> {
    const result = (await fal.subscribe("openai/gpt-image-2", {
        input: { prompt, image_size: "portrait_4_3" },
    })) as { data?: { images?: { url: string }[] } };
    const url = result.data?.images?.[0]?.url;
    if (!url) throw new Error("no image returned from gpt-image-2");
    return url;
}

export async function POST(request: Request) {
    const key = resolveFalKey();
    if (!key) {
        return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 501 });
    }
    fal.config({ credentials: key });

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const service = createServiceClient();
    if (!service) return NextResponse.json({ error: "service role key needed" }, { status: 501 });

    const body = (await request.json().catch(() => ({}))) as {
        name?: string;
        bio?: string;
        archetype?: string;
        model?: "nano-banana-2" | "gpt-image-2";
    };
    if (!body.bio) {
        return NextResponse.json({ error: "bio is required" }, { status: 400 });
    }

    // Pricing (final polish round §1d): first sheet-gen per user is free,
    // every one after costs 25 $BAMF. Checked/charged BEFORE the fal call so
    // a failed generation never bills the user (see refund-on-failure below).
    const usedFreebie = await hasLedgerReason(service, user.id, "sheet_gen");
    let charged = false;
    if (usedFreebie) {
        const spend = await adjustBamf(service, user.id, -SHEET_GEN_COST, "sheet_gen");
        if (!spend.ok) return NextResponse.json({ error: spend.error ?? "insufficient $BAMF balance" }, { status: 400 });
        charged = true;
    }

    try {
        const prompt = characterSheetPrompt({ name: body.name, bio: body.bio, archetype: body.archetype });
        const url = body.model === "gpt-image-2" ? await gptImage2(prompt) : await nb2(prompt);

        if (!usedFreebie) {
            // record the free generation so the NEXT call gets charged
            await adjustBamf(service, user.id, 0, "sheet_gen");
        }

        return NextResponse.json({ url, charged: charged ? SHEET_GEN_COST : 0 });
    } catch (e) {
        if (charged) await adjustBamf(service, user.id, SHEET_GEN_COST, "sheet_gen"); // refund
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "generation failed" },
            { status: 500 }
        );
    }
}
