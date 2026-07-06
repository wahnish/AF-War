// Agent-driven strategic intents (schema-002 build, item 6). One LLM call
// per crew: the crew's collective will decides attacks, alliance proposals,
// and betrayals. Falls back to the heuristic per-crew on invalid output so a
// bad LLM response never breaks round resolution.

import { llm, extractJson } from './llm'
import { TONE } from './narrate'
import { zoneById } from '../engine/map'

export interface CrewIntentResult {
    attacks: { pcId: string; targetZone: string; stakes: 'skirmish' | 'scar' | 'death' }[]
    allianceProposal?: string
    betrayal?: boolean
    reasoning: string
}

export interface CrewSummary {
    id: string
    name: string
    motto: string
    zones: string[]
    fighters: { id: string; name: string; hp: number; kills: number }[]
    alliances: string[]
    gravesEndCredit: number
}

/**
 * crewIntent(crewState, mapSummary, otherCrews, recentCanon) — one LLM call
 * per crew returning strategic intent. The prompt frames the crew as a
 * collective will: in-character, seeking drama AND territory, alliances as
 * tools, betrayal at the perfect moment as legendary.
 */
export async function crewIntent(
    crew: CrewSummary,
    attackableZoneIds: string[],
    otherCrews: CrewSummary[],
    recentCanon: string
): Promise<CrewIntentResult> {
    const system = `You are the collective will of "${crew.name}" in AF WAR, a seasonal territory war in Hyper-Brooklyn.
${TONE}
You seek drama AND territory in equal measure. Alliances are tools, not friendships — propose one when it serves you.
Betrayal at the perfect moment is legendary; only do it when the story demands it. You speak for the whole crew's strategy this round.`

    const zoneLines = attackableZoneIds.map(zid => {
        const z = zoneById(zid)
        return `- ${zid}: ${z.name} — ${z.blurb}`
    }).join('\n') || '(no zones currently attackable)'

    const fighterLines = crew.fighters.map(f => `- ${f.id}: ${f.name} (hp ${f.hp}, kills ${f.kills})`).join('\n') || '(no active fighters)'
    const otherLines = otherCrews.map(c => `- ${c.id}: ${c.name} — turf: ${c.zones.length}, allied with you: ${crew.alliances.includes(c.id)}`).join('\n')

    const user = `YOUR CREW: ${crew.name} — "${crew.motto}"
TURF HELD: ${crew.zones.length} zone(s)
GRAVES END CREDIT: ${crew.gravesEndCredit}
YOUR FIGHTERS:
${fighterLines}

ATTACKABLE ZONES THIS ROUND:
${zoneLines}

OTHER CREWS:
${otherLines}

RECENT CANON: ${recentCanon || '(none yet)'}

Decide your crew's move this round. Return JSON only:
{"attacks": [{"pcId": "one of your fighter ids", "targetZone": "one of the attackable zone ids", "stakes": "skirmish|scar|death"}, ...up to 2],
"allianceProposal": "a crew id to propose alliance with, or omit",
"betrayal": true or omit (only true if you intend to attack an ally this round — the engine detects and logs it automatically if your attack target is allied turf),
"reasoning": "2-4 sentences, in character, why this move"}`

    const out = await llm(system, user, 900)
    const parsed = extractJson<Partial<CrewIntentResult>>(out)

    // validate: every attack must use a live fighter and an actually-attackable zone
    const fighterIds = new Set(crew.fighters.map(f => f.id))
    const zoneSet = new Set(attackableZoneIds)
    const attacks = (parsed.attacks ?? []).filter(a =>
        a && fighterIds.has(a.pcId) && zoneSet.has(a.targetZone) &&
        ['skirmish', 'scar', 'death'].includes(a.stakes)
    ).slice(0, 2)

    return {
        attacks,
        allianceProposal: parsed.allianceProposal,
        betrayal: parsed.betrayal,
        reasoning: parsed.reasoning ?? '',
    }
}
