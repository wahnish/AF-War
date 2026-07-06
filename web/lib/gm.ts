// The GM engine core — extracted from api/gm/resolve and api/gm/downtime so
// both the interactive routes AND the cron tick (api/gm/tick) share one
// implementation. Callers (route handlers) own auth/role-gating and the
// service-role client; these functions assume both are already valid.
import type { SupabaseClient } from "@supabase/supabase-js";
import { heuristicIntent, playRound, attackableZones } from "@/lib/engine/season";
import type { PCDef, RoundIntent } from "@/lib/engine/season";
import { makeRng } from "@/lib/engine/rng";
import { serializeSeasonState, deserializeSeasonState } from "@/lib/serialize";
import { narrateMatch, judgeMatch, gazetteRecap } from "@/lib/agents/narrate";
import type { Telling, Verdict } from "@/lib/agents/narrate";
import { narrateDowntime } from "@/lib/agents/downtime";
import type { Season, Character, Direction } from "@/lib/types";
import { crewIntent } from "@/lib/agents/strategist";
import { settleBets } from "@/lib/bets";
import { maybeRenderComic } from "@/lib/comic";
import { maybeForgeItem } from "@/lib/loot";
import { writeLetter } from "@/lib/agents/letters";
import type { Telling as LetterTelling, Verdict as LetterVerdict } from "@/lib/agents/narrate";
import { sendMail } from "@/lib/mail";

export interface ResolveRoundResult {
    round: number;
    matches: number;
    events: number;
    nowIso: string;
}

/**
 * Resolves ONE round for the given season: engine (heuristicIntent or
 * per-crew agent intents + playRound), the narration cascade (narrateMatch
 * x2 + judgeMatch per match, gazetteRecap for the round), clout awards,
 * comic auto-render for the round's best/death matches, bet settlement,
 * and a 30%-per-tick chance of forging a new season-loot item. Every LLM
 * step is individually tolerant of failure. Throws only on hard DB errors
 * that make the round unresolvable (no season, already finished, no state).
 */
export async function resolveRound(
    supabase: SupabaseClient,
    seasonId: string,
    opts: { agentIntents?: boolean; rollLoot?: boolean } = {}
): Promise<ResolveRoundResult> {
    const { data: seasonRow, error: seasonErr } = await supabase
        .from("afwar_seasons")
        .select("*")
        .eq("id", seasonId)
        .maybeSingle();
    if (seasonErr) throw new Error(seasonErr.message);
    if (!seasonRow) throw new Error("no season found");

    const season = seasonRow as Season;
    if (!season.state) throw new Error("season has no state");

    const state = deserializeSeasonState(season.state as never);
    if (state.finished) throw new Error("season is already finished");

    const rng = makeRng(`${state.seed}:gm:${state.round + 1}`);

    let intent: RoundIntent;
    const warCouncilPosts: { crewId: string; crewName: string; reasoning: string }[] = [];
    if (opts.agentIntents) {
        const fallback = heuristicIntent(state, rng);
        const attacks: RoundIntent["attacks"] = [];
        const allianceProposals: RoundIntent["allianceProposals"] = [];
        const recentCanon = state.canon
            .slice(-8)
            .map((e) => JSON.stringify(e))
            .join("\n");

        for (const crew of state.crews.values()) {
            if (crew.eliminated) continue;
            const fighters = [...state.pcs.values()].filter((p) => p.crewId === crew.id && p.status === "active");
            if (!fighters.length) continue;
            const zoneIds = attackableZones(state, crew.id);
            const otherCrews = [...state.crews.values()]
                .filter((c) => c.id !== crew.id && !c.eliminated)
                .map((c) => ({
                    id: c.id,
                    name: c.name,
                    motto: c.motto,
                    zones: c.zones,
                    fighters: [],
                    alliances: c.alliances,
                    gravesEndCredit: c.gravesEndCredit,
                }));

            try {
                const result = await crewIntent(
                    {
                        id: crew.id,
                        name: crew.name,
                        motto: crew.motto,
                        zones: crew.zones,
                        fighters: fighters.map((f) => ({ id: f.id, name: f.id, hp: f.hp, kills: f.kills })),
                        alliances: crew.alliances,
                        gravesEndCredit: crew.gravesEndCredit,
                    },
                    zoneIds,
                    otherCrews,
                    recentCanon
                );
                if (result.attacks.length) {
                    for (const a of result.attacks) attacks.push({ crewId: crew.id, pcId: a.pcId, targetZone: a.targetZone, stakes: a.stakes });
                } else {
                    attacks.push(...fallback.attacks.filter((a) => a.crewId === crew.id));
                }
                if (result.allianceProposal) allianceProposals.push([crew.id, result.allianceProposal]);
                if (result.reasoning) warCouncilPosts.push({ crewId: crew.id, crewName: crew.name, reasoning: result.reasoning });
            } catch (e) {
                console.error(`[gm] crewIntent failed for ${crew.name}, falling back to heuristic:`, e);
                attacks.push(...fallback.attacks.filter((a) => a.crewId === crew.id));
            }
        }
        intent = { attacks, allianceProposals, resurrections: fallback.resurrections };
    } else {
        intent = heuristicIntent(state, rng);
    }

    const report = playRound(state, intent);

    const nowIso = new Date().toISOString();

    const charIds = Array.from(new Set(report.matches.flatMap((m) => [m.a, m.b])));
    const { data: charRows } = charIds.length
        ? await supabase.from("afwar_characters").select("*").in("id", charIds)
        : { data: [] as Character[] };
    const characters = new Map<string, Character>((charRows ?? []).map((c: Character) => [c.id, c]));

    const crewIds = Array.from(new Set((charRows ?? []).map((c: Character) => c.crew_id).filter(Boolean))) as string[];
    const { data: crewRows } = crewIds.length
        ? await supabase.from("afwar_crews").select("id,name").in("id", crewIds)
        : { data: [] as { id: string; name: string }[] };
    const crewNames = new Map<string, string>((crewRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

    const { data: directionRows } = await supabase
        .from("afwar_directions")
        .select("*")
        .eq("season_id", season.id)
        .eq("round", report.round)
        .in("character_id", charIds.length ? charIds : ["00000000-0000-0000-0000-000000000000"]);
    const directions = new Map<string, Direction>((directionRows ?? []).map((d: Direction) => [d.character_id, d]));

    const ownerIds = Array.from(new Set((charRows ?? []).map((c: Character) => c.owner_id).filter(Boolean))) as string[];
    const { data: ownerRows } = ownerIds.length
        ? await supabase.from("afwar_profiles").select("id, openrouter_key, model_tier, model_name").in("id", ownerIds)
        : { data: [] as { id: string; openrouter_key: string | null; model_tier: string; model_name: string | null }[] };
    const ownerProfiles = new Map<string, { openrouter_key: string | null; model_tier: string; model_name: string | null }>(
        (ownerRows ?? []).map((p: { id: string; openrouter_key: string | null; model_tier: string; model_name: string | null }) => [p.id, p])
    );

    function llmOverrideFor(c: Character): { key?: string; model?: string } | undefined {
        const profile = ownerProfiles.get(c.owner_id);
        if (!profile || profile.model_tier !== "byo" || !profile.openrouter_key) return undefined;
        return { key: profile.openrouter_key, model: profile.model_name || undefined };
    }

    const { data: canonCastRows } = await supabase
        .from("afwar_canon_cast")
        .select("name, canon_notes")
        .eq("active", true);
    const canonCast = (canonCastRows ?? []) as { name: string; canon_notes: { date: string; note: string }[] }[];

    function canonNotesFor(text: string): string {
        const hits = canonCast.filter((c) => c.name && text.includes(c.name) && c.canon_notes?.length);
        if (!hits.length) return "";
        const lines = hits.flatMap((c) => c.canon_notes.map((n) => `${c.name}: ${n.note}`));
        return `\n\nCANON NOTES (behavior corrections, obey strictly): ${lines.join(" | ")}`;
    }

    function toPCDef(c: Character): PCDef {
        const direction = directions.get(c.id);
        const directorNote = direction
            ? `\n\nDIRECTOR'S NOTE (from your creator): ${direction.gambit ?? ""}${
                  direction.tone_note ? ` — tone: ${direction.tone_note}` : ""
              }`
            : "";
        const factionNote = c.faction ? `\n\nFACTION: ${c.faction}` : "";
        const bioWithContext = (c.bio ?? "") + directorNote + factionNote;
        return {
            id: c.id,
            name: c.name,
            crewId: c.crew_id ?? "",
            stats: c.stats,
            attackAbility: c.attack_ability,
            power: c.power?.name ? { name: c.power.name, level: c.power.level } : undefined,
            policy: c.policy,
            bio: bioWithContext + canonNotesFor(bioWithContext + c.name),
            modelSheetHint: "",
        };
    }

    let bestMatchId: string | null = null;
    let bestScore = -1;
    const comicCandidates: { matchId: string; m: (typeof report.matches)[number]; tellings: Telling[]; verdict: Verdict | null; aChar?: Character; bChar?: Character }[] = [];

    for (const m of report.matches) {
        const aChar = characters.get(m.a);
        const bChar = characters.get(m.b);

        let tellings: Telling[] = [];
        let verdict: Verdict | null = null;

        if (aChar && bChar) {
            const aDef = toPCDef(aChar);
            const bDef = toPCDef(bChar);

            const [aTelling, bTelling] = await Promise.all([
                narrateMatch(aDef, bDef, m, report.round, llmOverrideFor(aChar)).catch((e) => {
                    console.error(`[gm] narrateMatch failed for ${aChar.name}:`, e);
                    return null;
                }),
                narrateMatch(bDef, aDef, m, report.round, llmOverrideFor(bChar)).catch((e) => {
                    console.error(`[gm] narrateMatch failed for ${bChar.name}:`, e);
                    return null;
                }),
            ]);

            tellings = [aTelling, bTelling].filter((t): t is Telling => t !== null);

            if (aTelling && bTelling) {
                try {
                    verdict = await judgeMatch(aTelling, bTelling, m, aChar.name, bChar.name, canonNotesFor(`${aChar.name} ${bChar.name}`));
                } catch (e) {
                    console.error(`[gm] judgeMatch failed for match ${m.a} vs ${m.b}:`, e);
                }
            }
        } else {
            console.error(`[gm] missing character row(s) for match ${m.a} vs ${m.b} — transcript-only`);
        }

        const { data: insertedMatch } = await supabase
            .from("afwar_matches")
            .insert({
                season_id: season.id,
                round: report.round,
                zone_id: m.zoneId,
                stakes: m.stakes,
                a_character: m.a,
                b_character: m.b,
                dice_transcript: m,
                tellings,
                verdict,
                winner: m.winner,
            })
            .select("id")
            .single();

        if (verdict) {
            for (const [pcId, score] of Object.entries(verdict.scores)) {
                const c = characters.get(pcId);
                if (!c) continue;
                const { data: current } = await supabase
                    .from("afwar_characters")
                    .select("clout")
                    .eq("id", pcId)
                    .maybeSingle();
                const existingClout = (current as { clout: number } | null)?.clout ?? c.clout ?? 0;
                await supabase
                    .from("afwar_characters")
                    .update({ clout: existingClout + score })
                    .eq("id", pcId);
            }
            const maxScore = Math.max(...Object.values(verdict.scores));
            if (insertedMatch && maxScore > bestScore) {
                bestScore = maxScore;
                bestMatchId = insertedMatch.id;
            }
        }

        if (insertedMatch) {
            comicCandidates.push({ matchId: insertedMatch.id, m, tellings, verdict, aChar, bChar });
        }

        const canonTelling =
            (verdict && tellings.find((t) => t.pcId === verdict!.canonPcId)) ?? tellings[0] ?? null;
        const title = canonTelling?.title ?? `${aChar?.name ?? m.a} vs ${bChar?.name ?? m.b}`;
        const excerpt = canonTelling
            ? canonTelling.prose.length > 380
                ? canonTelling.prose.slice(0, 380) + "…"
                : canonTelling.prose
            : `${aChar?.name ?? m.a} and ${bChar?.name ?? m.b} threw down — dice-only record, narration unavailable this round.`;

        const { data: insertedPost } = await supabase
            .from("afwar_posts")
            .insert({
                season_id: season.id,
                author_character: null,
                kind: "match",
                title,
                body: excerpt,
                media: insertedMatch ? [{ match_id: insertedMatch.id }] : [],
                round: report.round,
            })
            .select("id")
            .single();

        if (insertedPost && insertedMatch) {
            const cand = comicCandidates.find((c) => c.matchId === insertedMatch.id);
            if (cand) (cand as typeof cand & { postId?: string }).postId = insertedPost.id;
        }
    }

    for (const cand of comicCandidates) {
        const isRoundBest = cand.matchId === bestMatchId;
        if (cand.m.stakes !== "death" && !isRoundBest) continue;
        const canonTelling =
            (cand.verdict && cand.tellings.find((t) => t.pcId === cand.verdict!.canonPcId)) ?? cand.tellings[0];
        if (!canonTelling || !cand.aChar || !cand.bChar) continue;

        const pages = await maybeRenderComic(
            supabase,
            {
                matchId: cand.matchId,
                round: report.round,
                result: cand.m,
                canonTelling,
                aName: cand.aChar.name,
                aBio: cand.aChar.bio ?? "",
                aSheetUrl: cand.aChar.model_sheet_url,
                bName: cand.bChar.name,
                bBio: cand.bChar.bio ?? "",
                bSheetUrl: cand.bChar.model_sheet_url,
            },
            cand.verdict,
            isRoundBest
        );

        if (pages.length) {
            const media = pages.map((url) => ({ url, kind: "comic-page" }));
            await supabase.from("afwar_matches").update({ media }).eq("id", cand.matchId);
            const postId = (cand as typeof cand & { postId?: string }).postId;
            if (postId) {
                await supabase
                    .from("afwar_posts")
                    .update({ media: [{ match_id: cand.matchId }, ...media] })
                    .eq("id", postId);
            }
        }
    }

    // Character letters (growth-spec §1 / item 4): after narration/judging,
    // each ACTIVE character whose owner has letters_enabled emails their
    // director in voice — recap, gossip, and one question needing a
    // Direction. Reuses the exact per-round data the feed post/comic
    // cascade above already computed (tellings, verdict, directions,
    // crew names) — this is a second render target, not new game logic.
    try {
        await sendRoundLetters(supabase, {
            seasonId: season.id,
            round: report.round,
            comicCandidates,
            characters,
            crewNames,
            directions,
        });
    } catch (e) {
        console.error(`[gm] sendRoundLetters failed for round ${report.round}:`, e);
    }

    try {
        await settleBets(supabase, season.id, report.round, report.matches);
    } catch (e) {
        console.error(`[gm] settleBets failed for round ${report.round}:`, e);
    }

    for (const wc of warCouncilPosts) {
        await supabase.from("afwar_posts").insert({
            season_id: season.id,
            author_character: null,
            kind: "downtime",
            title: `War Council — ${wc.crewName}`,
            body: wc.reasoning,
            media: [],
            round: report.round,
        });
    }

    if (report.events.length) {
        await supabase.from("afwar_canon_events").insert(
            report.events.map((event) => ({
                season_id: season.id,
                round: report.round,
                event,
            }))
        );
    }

    // Avenge-me invites (growth-spec §2c / item 3): every death this round
    // auto-creates an invite carrying the grudge forward. The dead
    // character's LAST letter/beat becomes a hook for a NEW director —
    // inheriting a named villain from round one. Best-effort: a failure here
    // must never fail round resolution.
    for (const event of report.events) {
        if (event.kind !== "death") continue;
        try {
            const deadChar = characters.get(event.pcId);
            if (!deadChar) continue;
            // sync the DB row to the engine's verdict — without this the
            // AvengeBar (status === 'dead') never fires (known dual-track gap, closed here)
            await supabase.from("afwar_characters").update({ status: "dead" }).eq("id", deadChar.id);
            const code = crypto.randomUUID().replace(/-/g, "").slice(0, 9);
            await supabase.from("afwar_invites").insert({
                code,
                inviter_id: deadChar.owner_id,
                kind: "avenge",
                character_id: deadChar.id,
                grudge: event,
            });
        } catch (e) {
            console.error(`[gm] avenge-invite creation failed for death event ${event.pcId}:`, e);
        }
    }

    const namesMap = new Map<string, string>();
    for (const c of characters.values()) namesMap.set(c.id, c.name);
    for (const [id, name] of crewNames) namesMap.set(id, name);
    for (const crew of state.crews.values()) namesMap.set(crew.id, crew.name);
    for (const pc of state.pcs.values()) namesMap.set(pc.id, pc.name);

    try {
        const gazetteNotes = canonNotesFor(Array.from(namesMap.values()).join(" "));
        const gazette = await gazetteRecap(report.round, report.events, namesMap, gazetteNotes);
        await supabase.from("afwar_posts").insert({
            season_id: season.id,
            author_character: null,
            kind: "gazette",
            title: `Round ${report.round} — Hyper-Brooklyn Gazette`,
            body: gazette,
            media: [],
            round: report.round,
        });
    } catch (e) {
        console.error(`[gm] gazetteRecap failed for round ${report.round}:`, e);
    }

    await supabase.from("afwar_posts").insert({
        season_id: season.id,
        author_character: null,
        kind: "system",
        title: `Round ${report.round} resolved`,
        body: `${report.matches.length} match(es), ${report.corrupted.length} zone(s) corrupted, ${report.events.length} canon event(s). Scores: ${JSON.stringify(report.scores)}`,
        media: [],
        round: report.round,
    });

    const { error: updateErr } = await supabase
        .from("afwar_seasons")
        .update({
            state: serializeSeasonState(state),
            status: state.finished ? "finished" : "active",
        })
        .eq("id", season.id);
    if (updateErr) throw new Error(updateErr.message);

    // Season loot forge (final polish round §4): 30% chance per tick/round.
    if (opts.rollLoot !== false && Math.random() < 0.3) {
        try {
            await maybeForgeItem(supabase, season.id, state);
        } catch (e) {
            console.error(`[gm] maybeForgeItem failed for round ${report.round}:`, e);
        }
    }

    return { round: report.round, matches: report.matches.length, events: report.events.length, nowIso };
}

interface RoundLettersInput {
    seasonId: string;
    round: number;
    comicCandidates: { matchId: string; m: { a: string; b: string; zoneId: string; stakes: string }; tellings: LetterTelling[]; verdict: LetterVerdict | null; aChar?: Character; bChar?: Character }[];
    characters: Map<string, Character>;
    crewNames: Map<string, string>;
    directions: Map<string, Direction>;
}

/**
 * Character letters (growth-spec §1): for each ACTIVE character involved in
 * this round's matches (that's the population with fresh recap material —
 * downtime-only characters get their beat via the existing downtime pass,
 * not a letter), with letters_enabled and an owner with a real email, write
 * an in-voice letter (recap + gossip + one Direction-shaped question) and
 * send it. Tolerant of individual failures — one bad send must never sink
 * the round or block another character's letter.
 */
async function sendRoundLetters(supabase: SupabaseClient, input: RoundLettersInput): Promise<void> {
    const service = supabase; // caller already passes the service-role client (see resolveRound)

    // Only characters that appear in this round's matches have fresh
    // per-round material to recap — pull recap text + judge note + gossip
    // material for each.
    const perCharacter = new Map<
        string,
        { recapText: string; judgeNote?: string; gossip: { name: string; relation: string; note: string }[] }
    >();

    for (const cand of input.comicCandidates) {
        const { aChar, bChar, tellings, verdict } = cand;
        if (!aChar || !bChar) continue;
        for (const [me, opponent] of [
            [aChar, bChar],
            [bChar, aChar],
        ] as [Character, Character][]) {
            const myTelling = tellings.find((t) => t.pcId === me.id);
            const recapText = myTelling?.prose ?? `You and ${opponent.name} threw down at ${cand.m.zoneId}.`;
            const judgeNote = verdict ? verdict.critique : undefined;
            const relation = cand.m.stakes === "death" ? "the being you just fought to the death" : "your opponent this round";
            const note = tellings.find((t) => t.pcId === opponent.id)?.title ?? `fought you at ${cand.m.zoneId}`;
            const existing = perCharacter.get(me.id);
            const gossip = [{ name: opponent.name, relation, note }];
            if (existing) {
                existing.gossip.push(...gossip);
            } else {
                perCharacter.set(me.id, { recapText, judgeNote, gossip });
            }
        }
    }

    for (const [charId, material] of perCharacter) {
        const character = input.characters.get(charId);
        if (!character) continue;
        if (character.status !== "active") continue;
        if ((character as unknown as { letters_enabled?: boolean }).letters_enabled === false) continue;

        try {
            const { data: userRes, error: userErr } = await service.auth.admin.getUserById(character.owner_id);
            if (userErr || !userRes?.user?.email) continue;
            const email = userRes.user.email;

            const letter = await writeLetter(
                { id: character.id, name: character.name, bio: character.bio ?? "", voice_notes: character.voice_notes, crewName: character.crew_id ? input.crewNames.get(character.crew_id) : undefined },
                {
                    round: input.round,
                    recapText: material.recapText,
                    judgeNote: material.judgeNote,
                    gossipSubjects: material.gossip,
                }
            );

            const magicLink = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/barracks#direction-${character.id}`;
            const body = `${letter.body}\n\n—\nReply with your orders, boss: ${magicLink}`;

            await sendMail({ to: email, subject: letter.subject, text: body });
        } catch (e) {
            console.error(`[gm] letter send failed for character ${character.name} (${character.id}):`, e);
        }
    }
}

export interface DowntimeResult {
    posted: number;
    replies: number;
    note?: string;
}

/** Downtime pass core, shared between api/gm/downtime and the cron tick. */
export async function runDowntimePass(supabase: SupabaseClient): Promise<DowntimeResult> {
    function shuffle<T>(arr: T[]): T[] {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    const { data: activeRows, error: charsErr } = await supabase
        .from("afwar_characters")
        .select("*")
        .eq("status", "active");
    if (charsErr) throw new Error(charsErr.message);

    const active = (activeRows ?? []) as Character[];
    if (active.length === 0) return { posted: 0, replies: 0, note: "no active characters" };

    const crewIds = Array.from(new Set(active.map((c) => c.crew_id).filter(Boolean))) as string[];
    const { data: crewRows } = crewIds.length
        ? await supabase.from("afwar_crews").select("id,name").in("id", crewIds)
        : { data: [] as { id: string; name: string }[] };
    const crewNames = new Map<string, string>((crewRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

    const { data: seasonRow } = await supabase
        .from("afwar_seasons")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    const round = (seasonRow as Season | null)?.state?.round ?? null;

    const { data: canonCastRows } = await supabase
        .from("afwar_canon_cast")
        .select("name, canon_notes")
        .eq("active", true);
    const canonCast = (canonCastRows ?? []) as { name: string; canon_notes: { date: string; note: string }[] }[];
    function canonNotesFor(text: string): string {
        const hits = canonCast.filter((c) => c.name && text.includes(c.name) && c.canon_notes?.length);
        if (!hits.length) return "";
        const lines = hits.flatMap((c) => c.canon_notes.map((n) => `${c.name}: ${n.note}`));
        return `\n\nCANON NOTES (behavior corrections, obey strictly): ${lines.join(" | ")}`;
    }

    const n = Math.min(active.length, 3 + Math.floor(Math.random() * 3));
    const chosen = shuffle(active).slice(0, n);

    let posted = 0;
    let replies = 0;

    for (const character of chosen) {
        try {
            const { title, body } = await narrateDowntime(
                {
                    name: character.name,
                    bio: character.bio ?? "",
                    voice_notes: character.voice_notes,
                    scars: character.scars,
                    crewName: character.crew_id ? crewNames.get(character.crew_id) : undefined,
                },
                undefined,
                canonNotesFor(`${character.name} ${character.bio ?? ""}`)
            );

            const { error: insertErr } = await supabase.from("afwar_posts").insert({
                season_id: seasonRow?.id ?? null,
                author_character: character.id,
                kind: "downtime",
                title: `${character.name}: ${title}`,
                body,
                media: [],
                round,
            });
            if (insertErr) {
                console.error(`[gm] downtime insert failed for ${character.name}:`, insertErr);
                continue;
            }
            posted++;

            if (Math.random() < 0.3) {
                const others = active.filter((c) => c.id !== character.id);
                if (others.length === 0) continue;
                const replier = shuffle(others)[0];
                try {
                    const reply = await narrateDowntime(
                        {
                            name: replier.name,
                            bio: replier.bio ?? "",
                            voice_notes: replier.voice_notes,
                            scars: replier.scars,
                            crewName: replier.crew_id ? crewNames.get(replier.crew_id) : undefined,
                        },
                        `${title}: ${body}`,
                        canonNotesFor(`${replier.name} ${replier.bio ?? ""}`)
                    );
                    const { error: replyErr } = await supabase.from("afwar_posts").insert({
                        season_id: seasonRow?.id ?? null,
                        author_character: replier.id,
                        kind: "downtime",
                        title: `${replier.name}: ${reply.title}`,
                        body: `↪ re: ${title}\n\n${reply.body}`,
                        media: [],
                        round,
                    });
                    if (replyErr) {
                        console.error(`[gm] downtime reply insert failed for ${replier.name}:`, replyErr);
                        continue;
                    }
                    replies++;
                } catch (e) {
                    console.error(`[gm] downtime reply narration failed for ${replier.name}:`, e);
                }
            }
        } catch (e) {
            console.error(`[gm] downtime narration failed for ${character.name}:`, e);
        }
    }

    return { posted, replies };
}
