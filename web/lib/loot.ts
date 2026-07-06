// Season loot (final polish round §4): auto-generated cursed-object flavor
// over the engine's 3 real item mechanics. Effect templates are EXACTLY
// engine/match.ts's ITEMS ('forces_death' | 'forces_corruption' |
// 'landwaster') — only the name/lore/art are generated; balance stays
// hand-designed in the engine.
//
// KNOWN SEAM (documented per the brief, not fixed this round): the engine's
// own item drop (SeasonState.zones[zid].itemOnGround, an engine ITEMS id
// like 'black-mayo-blade') and this afwar_items row are TWO SEPARATE
// records. In the common case they reference the same zone/effect and
// narratively "are" the same item, but nothing enforces that — a forge call
// can drop lore-item flavor in a zone the engine considers itemless, or
// vice versa. afwar_items is purely the display+lore layer (map badge +
// Gazette post); engine mechanics never read it. Unify post-v1 if the
// double-bookkeeping confuses players.
import type { SupabaseClient } from "@supabase/supabase-js";
import { llm, extractJson } from "@/lib/agents/llm";
import { TONE } from "@/lib/agents/narrate";
import { ZONES, zoneById } from "@/lib/engine/map";
import type { SeasonState } from "@/lib/engine/season";
import { fal } from "@fal-ai/client";

export const EFFECT_TEMPLATES = ["forces_death", "forces_corruption", "landwaster"] as const;
export type EffectTemplate = (typeof EFFECT_TEMPLATES)[number];

const EFFECT_BLURBS: Record<EffectTemplate, string> = {
    forces_death: "every fight this item touches becomes a Death Match — there is no walking away",
    forces_corruption: "losing to this item's holder means waking up on their crew — a Hypno-Waffle-style flip",
    landwaster: "a decisive win claims one extra adjacent zone; a loss drops the item where you fell",
};

const STYLE =
    "Gritty 1990s American comic book art, bold confident inks, flat colors with neon accents, retro-futuristic Hyper-Brooklyn (Venture-Brothers-adjacent adult animation energy played straight). Halftone texture, dramatic lighting, single object centered on a plain background, no characters.";

function resolveFalKey(): string | undefined {
    return process.env.FAL_KEY;
}

async function nb2Item(prompt: string): Promise<string | null> {
    const key = resolveFalKey();
    if (!key) return null;
    fal.config({ credentials: key });
    try {
        const result = (await fal.subscribe("fal-ai/nano-banana-2", {
            input: { prompt, aspect_ratio: "1:1" },
        })) as { data?: { images?: { url: string }[] } };
        return result.data?.images?.[0]?.url ?? null;
    } catch (e) {
        console.error("[loot] nb2 art gen failed:", e);
        return null;
    }
}

interface ForgedFlavor {
    name: string;
    lore: string;
}

async function forgeFlavor(template: EffectTemplate, zoneName: string, zoneBlurb: string): Promise<ForgedFlavor> {
    const system = `You name and write lore for a cursed object in AF WAR, a seasonal territory war in Hyper-Brooklyn.
${TONE}
The object mechanically does this (do not restate the mechanic in-fiction, just make the object feel like it could do this): ${EFFECT_BLURBS[template]}.
Style: Hyper-Brooklyn cursed-object flavor — mundane object + cosmic wrongness, deadpan comedy, a Gazette-ready hook.`;
    const user = `ZONE: ${zoneName} — ${zoneBlurb}
Return JSON only: {"name": "a punchy cursed-object name (max 8 words)", "lore": "60-100 words of in-world lore/backstory for this object, found in this zone"}`;
    const out = await llm(system, user, 500);
    const parsed = extractJson<ForgedFlavor>(out);
    return { name: parsed.name || "Unnamed Relic", lore: parsed.lore || "" };
}

/**
 * Attempt to forge one new season-loot item: generates flavor (name + lore)
 * for a random effect template + random uncorrupted zone, generates NB2 art,
 * inserts the afwar_items row, and posts a Gazette-style drop announcement.
 * Tolerant of any failure (LLM or art gen) — degrades to a text-only item
 * with no art rather than throwing, never blocks the caller's round.
 */
export async function forgeItem(supabase: SupabaseClient, seasonId: string, state: SeasonState): Promise<void> {
    const uncorrupted = ZONES.filter((z) => {
        const zs = state.zones.get(z.id);
        return zs && !zs.corrupted && !zs.beyond && !z.finale && z.id !== "monorail";
    });
    if (!uncorrupted.length) return;

    const zone = uncorrupted[Math.floor(Math.random() * uncorrupted.length)];
    const template = EFFECT_TEMPLATES[Math.floor(Math.random() * EFFECT_TEMPLATES.length)];

    let flavor: ForgedFlavor;
    try {
        flavor = await forgeFlavor(template, zone.name, zone.blurb);
    } catch (e) {
        console.error("[loot] forgeFlavor failed:", e);
        flavor = { name: `Unmarked ${zone.name} Relic`, lore: `Found in ${zone.name}. Nobody remembers dropping it.` };
    }

    const artUrl = await nb2Item(
        `A cursed object: ${flavor.name} — ${flavor.lore}. Found in ${zone.name}, Hyper-Brooklyn. ${STYLE}`
    );

    const { error: insertErr } = await supabase.from("afwar_items").insert({
        season_id: seasonId,
        name: flavor.name,
        lore: flavor.lore,
        art_url: artUrl,
        effect_template: template,
        zone_id: zone.id,
        status: "ground",
    });
    if (insertErr) {
        console.error("[loot] afwar_items insert failed:", insertErr);
        return;
    }

    await supabase.from("afwar_posts").insert({
        season_id: seasonId,
        author_character: null,
        kind: "gazette",
        title: `⚔ Relic Drop — ${flavor.name}`,
        body: `**${flavor.name}** has surfaced in **${zoneById(zone.id).name}**.\n\n${flavor.lore}\n\n_Whoever picks it up should know what they're getting into._`,
        media: artUrl ? [{ url: artUrl, kind: "item-art" }] : [],
        round: state.round,
    });
}

/** Wraps forgeItem with the caller's own probability gate + tolerant catch,
 * so gm.ts's per-tick 30% roll and the manual /api/gm/forge route share
 * one code path without double-rolling probability. */
export async function maybeForgeItem(supabase: SupabaseClient, seasonId: string, state: SeasonState): Promise<void> {
    try {
        await forgeItem(supabase, seasonId, state);
    } catch (e) {
        console.error("[loot] forgeItem failed:", e);
    }
}
