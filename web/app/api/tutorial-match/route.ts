import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { makeRng } from "@/lib/engine/rng";
import { rollIncompetence } from "@/lib/engine/dice";
import { runMatch, type MatchPC } from "@/lib/engine/match";
import { narrateMatch, judgeMatch, type Telling, type Verdict } from "@/lib/agents/narrate";
import type { PCDef } from "@/lib/engine/season";
import { adjustBamf } from "@/lib/bamf";
import type { Character } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// TUTORIAL MATCH — every new director's first, free, no-stakes fight vs the
// house NPC Sergeant Tricera-Cop (agents/cast.ts). Deliberately skips the
// real-match side effects (clout, afwar_posts feed post) — see gm.ts's
// resolveRound for what a REAL match does that this intentionally does not.
//
// Zone: the brief suggested 'coney-island' — confirmed a real zone id in
// engine/map.ts ("Coney Island" / The Boardwalk, low-stakes fairground
// flavor), so used as-is.
const TUTORIAL_ZONE = "coney-island";

// Tricera-Cop, verbatim from agents/cast.ts's pc('tricera-cop', ...) call —
// stats/power/policy/attack ability copied exactly, not re-derived.
const TRICERA_COP_CARD_STATS: [string, number][] = [
    ["STR", 40], // speed
    ["END", 70], // defense
    ["DEX", 10], // agility
    ["CHA", 20], // magic
    ["INT", 20], // intelligence
];
const TRICERA_COP_POINTS = 1;
const TRICERA_COP_POWER_NAME = "Dino Might";
const TRICERA_COP_FALLBACK_BIO =
    "Sergeant Tricera-Cop, the real deal big cheese — in his own mind. A glorified mall cop whose beat is a mystery; found in watering holes more than on patrol. Dreams of the Robot Repair Mall transfer. Will 'definitely' pass the Raze exam next time. Never takes bribes — but how much are you offering?";

// Reproduces agents/cast.ts's toStats(): rank the 5 card stats descending,
// assign the R1 starting array d10/d8/d6/d6/d4 by rank, attack ability =
// top-ranked stat.
function triceraCopStatsAndAttack(): { stats: Character["stats"]; attack: Character["attack_ability"] } {
    const ranked = [...TRICERA_COP_CARD_STATS].sort((a, b) => b[1] - a[1]);
    const array = [10, 8, 6, 6, 4] as const;
    const stats: Record<string, number> = {};
    ranked.forEach(([ab], i) => {
        stats[ab] = array[i];
    });
    return { stats: stats as unknown as Character["stats"], attack: ranked[0][0] as Character["attack_ability"] };
}

export async function POST(req: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { characterId?: string };
    if (!body.characterId) return NextResponse.json({ error: "characterId required" }, { status: 400 });
    const characterId = body.characterId;

    const service = createServiceClient();
    if (!service) return NextResponse.json({ error: "service role key needed" }, { status: 501 });

    const { data: charRow, error: charErr } = await service
        .from("afwar_characters")
        .select("*")
        .eq("id", characterId)
        .maybeSingle();
    if (charErr) return NextResponse.json({ error: charErr.message }, { status: 500 });
    const character = charRow as Character | null;
    if (!character) return NextResponse.json({ error: "character not found" }, { status: 404 });
    if (character.owner_id !== user.id) return NextResponse.json({ error: "not your character" }, { status: 403 });

    const { data: existingRows, error: existingErr } = await service
        .from("afwar_matches")
        .select("id")
        .eq("is_tutorial", true)
        .eq("a_character", characterId)
        .limit(1);
    if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 });
    if (existingRows && existingRows.length > 0) {
        return NextResponse.json({ error: "tutorial match already exists for this character" }, { status: 409 });
    }

    const rng = makeRng(`tutorial:${characterId}`);

    // ── build both MatchPCs ────────────────────────────────────────────
    const playerIncompetence = rollIncompetence(rng, character.stats);
    const playerPC: MatchPC = {
        id: character.id,
        name: character.name,
        crewId: character.crew_id ?? "",
        stats: character.stats,
        hp: 10,
        vp: 10,
        incompetence: playerIncompetence,
        policy: character.policy,
        attackAbility: character.attack_ability,
        power: character.power?.name ? { name: character.power.name, level: character.power.level } : undefined,
    };

    const { stats: tcStats, attack: tcAttack } = triceraCopStatsAndAttack();
    const tricerCopIncompetence = rollIncompetence(rng, tcStats);
    const triceraCopPC: MatchPC = {
        id: "tricera-cop",
        name: "Tricera-Cop",
        crewId: "commandos",
        stats: tcStats,
        hp: 10,
        vp: 10,
        incompetence: tricerCopIncompetence,
        policy: { resistVs: ["STR"], counterWhenHpAbove: 7, spendVpAtMatchPoint: true, blazeOfGloryIfDying: false },
        attackAbility: tcAttack,
        power: { name: TRICERA_COP_POWER_NAME, level: Math.min(12, TRICERA_COP_POINTS + 2) },
    };

    const matchResult = runMatch(rng, TUTORIAL_ZONE, "skirmish", playerPC, triceraCopPC);

    // ── canon notes + tricera-cop bio (prefer afwar_canon_cast row) ─────
    const { data: canonCastRows } = await service.from("afwar_canon_cast").select("name, canon_notes, bio").eq("active", true);
    const canonCast = (canonCastRows ?? []) as { name: string; canon_notes: { date: string; note: string }[]; bio: string | null }[];

    function canonNotesFor(text: string): string {
        const hits = canonCast.filter((c) => c.name && text.includes(c.name) && c.canon_notes?.length);
        if (!hits.length) return "";
        const lines = hits.flatMap((c) => c.canon_notes.map((n) => `${c.name}: ${n.note}`));
        return `\n\nCANON NOTES (behavior corrections, obey strictly): ${lines.join(" | ")}`;
    }

    const triceraCopCanonRow = canonCast.find((c) => c.name === "Tricera-Cop");
    const triceraCopBio = triceraCopCanonRow?.bio || TRICERA_COP_FALLBACK_BIO;

    // ── player's BYO-key override (same lookup pattern as lib/gm.ts) ────
    const { data: profileRow } = await service
        .from("afwar_profiles")
        .select("model_tier, model_name")
        .eq("id", user.id)
        .maybeSingle();
    const profile = profileRow as { model_tier: string; model_name: string | null } | null;
    const { data: secretRow } = await service
        .from("afwar_secrets")
        .select("openrouter_key")
        .eq("user_id", user.id)
        .maybeSingle();
    const secretKey = (secretRow as { openrouter_key: string | null } | null)?.openrouter_key;
    const playerOverride =
        profile && profile.model_tier === "byo" && secretKey ? { key: secretKey, model: profile.model_name || undefined } : undefined;

    const playerDef: PCDef = {
        id: character.id,
        name: character.name,
        crewId: character.crew_id ?? "",
        stats: character.stats,
        attackAbility: character.attack_ability,
        power: character.power?.name ? { name: character.power.name, level: character.power.level } : undefined,
        policy: character.policy,
        bio: (character.bio ?? "") + canonNotesFor((character.bio ?? "") + character.name),
        modelSheetHint: "",
    };
    const triceraCopDef: PCDef = {
        id: "tricera-cop",
        name: "Tricera-Cop",
        crewId: "commandos",
        stats: tcStats,
        attackAbility: tcAttack,
        power: { name: TRICERA_COP_POWER_NAME, level: Math.min(12, TRICERA_COP_POINTS + 2) },
        policy: triceraCopPC.policy,
        bio: triceraCopBio + canonNotesFor(triceraCopBio + "Tricera-Cop"),
        modelSheetHint: "triceratops-headed beat cop, straining uniform, mirrored aviators, coffee cup, mall-cop segway",
    };

    // ── narrate + judge, tolerant of failure (degrade to transcript-only) ─
    let tellings: Telling[] = [];
    let verdict: Verdict | null = null;
    try {
        const [playerTelling, triceraCopTelling] = await Promise.all([
            narrateMatch(playerDef, triceraCopDef, matchResult, 0, playerOverride).catch((e) => {
                console.error(`[tutorial-match] narrateMatch failed for ${playerDef.name}:`, e);
                return null;
            }),
            // Tricera-Cop narrates with NO override — house key, matching
            // gm.ts's rule that non-BYO PCs always narrate on the house key.
            narrateMatch(triceraCopDef, playerDef, matchResult, 0, undefined).catch((e) => {
                console.error(`[tutorial-match] narrateMatch failed for Tricera-Cop:`, e);
                return null;
            }),
        ]);
        tellings = [playerTelling, triceraCopTelling].filter((t): t is Telling => t !== null);
        if (playerTelling && triceraCopTelling) {
            // judge failure must not wipe successful tellings — same
            // per-step tolerance as gm.ts's resolveRound
            try {
                verdict = await judgeMatch(
                    playerTelling,
                    triceraCopTelling,
                    matchResult,
                    playerDef.name,
                    triceraCopDef.name,
                    canonNotesFor(`${playerDef.name} ${triceraCopDef.name}`)
                );
            } catch (e) {
                console.error(`[tutorial-match] judgeMatch failed for character ${characterId}:`, e);
            }
        }
    } catch (e) {
        console.error(`[tutorial-match] narration/judging failed for character ${characterId}:`, e);
    }

    // ── insert the match row — NO clout, NO afwar_posts row (tutorial only) ─
    const { data: insertedMatch, error: insertErr } = await service
        .from("afwar_matches")
        .insert({
            season_id: null,
            is_tutorial: true,
            round: 0,
            zone_id: TUTORIAL_ZONE,
            stakes: "skirmish",
            a_character: characterId,
            b_character: null,
            b_character_name: "Tricera-Cop",
            dice_transcript: matchResult,
            tellings,
            verdict,
            winner: matchResult.winner,
        })
        .select("id")
        .single();

    if (insertErr || !insertedMatch) {
        return NextResponse.json({ error: insertErr?.message ?? "failed to create tutorial match" }, { status: 500 });
    }

    // ── +10 $BAMF regardless of win/loss ─────────────────────────────────
    try {
        await adjustBamf(service, user.id, 10, "first_blood", characterId);
    } catch (e) {
        console.error(`[tutorial-match] adjustBamf failed for user ${user.id}:`, e);
    }

    return NextResponse.json({ matchId: insertedMatch.id });
}
