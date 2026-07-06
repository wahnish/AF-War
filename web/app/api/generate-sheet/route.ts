import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const runtime = "nodejs";

// Style + nb2() pattern copied from ~/Documents/AFWar/comic/render.ts.
const STYLE =
    "Gritty 1990s American comic book art, bold confident inks, flat colors with neon accents, retro-futuristic Hyper-Brooklyn (Venture-Brothers-adjacent adult animation energy played straight). Halftone texture, dramatic lighting.";

// FAL_KEY fallback chain (agents/llm.ts pattern), simplified for the web app:
// Next.js loads web/.env.local automatically, so put FAL_KEY there. We
// deliberately do NOT walk the filesystem for a sibling AFWar/.env here —
// Next's build-time file tracer flags cross-directory fs reads as an
// unbounded trace (see next.config.ts warning history) and .env.local is
// the documented, traced-safe way to supply server secrets in Next.
function resolveFalKey(): string | undefined {
    return process.env.FAL_KEY;
}

async function nb2(prompt: string): Promise<string> {
    const result = (await fal.subscribe("fal-ai/nano-banana-2", {
        input: { prompt, aspect_ratio: "1:1" },
    })) as { data?: { images?: { url: string }[] } };
    const url = result.data?.images?.[0]?.url;
    if (!url) throw new Error("no image returned from nano-banana-2");
    return url;
}

export async function POST(request: Request) {
    const key = resolveFalKey();
    if (!key) {
        return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 501 });
    }
    fal.config({ credentials: key });

    const body = (await request.json().catch(() => ({}))) as {
        name?: string;
        bio?: string;
        archetype?: string;
    };
    if (!body.bio) {
        return NextResponse.json({ error: "bio is required" }, { status: 400 });
    }

    try {
        const prompt = `Character model sheet, single character, full body, neutral pose plus head close-up: ${body.name ?? "an Original Character"} — ${body.archetype ? `${body.archetype}. ` : ""}${body.bio}. ${STYLE} Plain background.`;
        const url = await nb2(prompt);
        return NextResponse.json({ url });
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "generation failed" },
            { status: 500 }
        );
    }
}
