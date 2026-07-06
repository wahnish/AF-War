// Narration, judging, and Gazette recaps. The dice transcript is GROUND TRUTH:
// narrations must honor every beat; they compete only on the telling.

import { llm, extractJson, type LlmOverride } from './llm.js'
import type { PCDef } from '../engine/season.js'
import type { MatchResult } from '../engine/match.js'
import type { CanonEvent } from '../engine/season.js'
import { zoneById } from '../engine/map.js'

// The tone contract — Todd, 2026-07-05 (spec §10.3)
export const TONE = `TONE CONTRACT (Adult Fantasy): characters are a bit ridiculous; the message is/can be serious.
Venture-Brothers-grade comedy on the surface — deadpan cosmic absurdity, petty grievances mid-apocalypse —
with real stakes and occasional Black Mirror/1984 shadows underneath. Profanity is allowed and canonical
(this is Hyper-Brooklyn). Never wink at the camera. Never explain the joke. The dumber the detail, the
straighter you play it.`

export interface ComicPanel {
    n: number
    shot: string        // camera/composition, e.g. "wide establishing", "dutch close-up"
    description: string // what we SEE — characters, action, setting
    dialogue: { speaker: string; text: string; kind: 'speech' | 'thought' | 'shout' | 'caption' }[]
    sfx?: string
}

export interface Telling {
    pcId: string
    title: string
    prose: string
    panels: ComicPanel[]
}

function beatSummary(r: MatchResult): string {
    return JSON.stringify({
        stakes: r.stakes,
        exchanges: r.exchanges.map(e => ({
            n: e.n, attacker: e.attacker, defender: e.defender, ability: e.attackAbility,
            attackTotal: e.attackRoll.total + (e.powerUsed?.bonus.total ?? 0),
            attackDice: e.attackRoll.rolls, exploded: e.attackRoll.exploded,
            power: e.powerUsed?.name, defense: e.defenseMode, defenseTotal: e.defenseRoll.total,
            counter: e.counterRoll?.total, winner: e.winner, damage: e.damage,
            critFail: e.critFail, note: e.note,
        })),
        winner: r.winner, loser: r.loser, consequence: r.consequence, blaze: r.blaze,
    }, null, 1)
}

export async function narrateMatch(
    me: PCDef, opponent: PCDef, r: MatchResult, round: number, override?: LlmOverride
): Promise<Telling> {
    const zone = zoneById(r.zoneId)
    const iWon = r.winner === me.id
    const system = `You are the player-character agent for ${me.name} in AF WAR, a seasonal territory war in Hyper-Brooklyn.
${TONE}
You write YOUR character's account of a battle — a dueling narrative. Your opponent writes their own version of the SAME fight.
The DICE TRANSCRIPT below is ground truth. You MUST honor every beat: who won each exchange, damage, crit-fails, powers used, the final outcome. You may invent connective tissue, motive, and comedy — never outcomes.
If a beat says FAILING SUCCESSFULLY, the botch caused the win — narrate exactly how the failure became the success. Depict your opponent well (portraying them poorly is judged harshly). Use the zone's terrain — there's a map for a reason.`
    const user = `ROUND ${round} — ${zone.name}: ${zone.blurb}
YOU: ${me.name} — ${me.bio}
OPPONENT: ${opponent.name} — ${opponent.bio}
STAKES: ${r.stakes}${iWon ? ' — YOU WON this match.' : ' — YOU LOST this match.'}
DICE TRANSCRIPT (ground truth):
${beatSummary(r)}

Return JSON only:
{"title": "punchy episode title", "prose": "your 250-400 word account, ${me.name}'s voice", "panels": [6-8 comic panels: {"n":1,"shot":"...","description":"...","dialogue":[{"speaker":"...","text":"...","kind":"speech|thought|shout|caption"}],"sfx":"optional"}]}`
    const out = await llm(system, user, 2400, override)
    const parsed = extractJson<Omit<Telling, 'pcId'>>(out)
    // normalize — LLM shape drift must never crash the bundle
    const panels = (parsed.panels ?? []).map((p, i) => ({
        n: p.n ?? i + 1, shot: p.shot ?? 'panel', description: p.description ?? '',
        dialogue: (p.dialogue ?? []).map(d => ({ speaker: d.speaker ?? '', text: d.text ?? '', kind: d.kind ?? 'speech' as const })),
        ...(p.sfx ? { sfx: p.sfx } : {}),
    }))
    return { pcId: me.id, title: parsed.title ?? 'Untitled', prose: parsed.prose ?? '', panels }
}

export interface Verdict {
    canonPcId: string
    scores: Record<string, number>  // pcId -> 1-10 entertainment
    critique: string
}

export async function judgeMatch(a: Telling, b: Telling, r: MatchResult, aName: string, bName: string, canonNotes = ''): Promise<Verdict> {
    const system = `You are THE ARBITER, cosmic judge of AF WAR — a hooded entity of vast taste and limited patience, with a Hyper-Brooklyn Gazette columnist's tongue.
${TONE}
Two player agents narrated the SAME battle. The dice already decided who WON — you judge only ENTERTAINMENT: voice, comedy that lands, how well each depicted their OPPONENT, use of the zone's terrain, fidelity to the dice beats. The more entertaining telling becomes CANON. Write in character; be quotable; play favorites out loud.${canonNotes}`
    const user = `MATCH: ${aName} vs ${bName} — winner by dice: ${r.winner}
TELLING A (${aName}):
${JSON.stringify({ title: a.title, prose: a.prose })}
TELLING B (${bName}):
${JSON.stringify({ title: b.title, prose: b.prose })}

Return JSON only: {"canonPcId": "${a.pcId}" or "${b.pcId}", "scores": {"${a.pcId}": 1-10, "${b.pcId}": 1-10}, "critique": "80-140 words, in character, address both combatants"}`
    const out = await llm(system, user, 900)
    return extractJson<Verdict>(out)
}

export async function gazetteRecap(round: number, events: CanonEvent[], names: Map<string, string>, canonNotes = ''): Promise<string> {
    const system = `You write the front page of the HYPER-BROOKLYN GAZETTE — the borough's cosmic tabloid of record ("facts often take a backseat to sensationalism").
${TONE}
Turn this round's canon events into a front page: one screaming headline, then 3-5 short items (dateline style, 1-3 sentences each). Refer to zones and characters by name. The Primordial's corruption spreading is WEATHER-SECTION mundane to locals — report it like a subway delay.${canonNotes}`
    const named = events.map(e => JSON.stringify(e, (k, v) => typeof v === 'string' && names.has(v) ? names.get(v) : v))
    const user = `ROUND ${round} CANON EVENTS:\n${named.join('\n')}\n\nReturn the front page as markdown. No JSON.`
    return llm(system, user, 1000)
}
