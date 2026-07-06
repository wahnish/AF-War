// Downtime posts — slice-of-life beats between rounds. No dice, no stakes;
// just voice. Reuses the TONE contract from narrate.ts (don't restate it).

import { llm, extractJson } from './llm.js'
import { TONE } from './narrate.js'

// Mirrors web/lib/types.ts ScarEntry — the DB-authored scar shape
// ({round, authoredBy, text}). Duplicated here rather than imported because
// the root engine/agents tree is self-contained (no dependency on the web
// app's types module; see sync-engine.mjs's copy-not-import design note).
export interface ScarEntry {
    round: number
    authoredBy: string
    text: string
}

export interface DowntimeCharacter {
    name: string
    bio: string
    voice_notes?: string | null
    scars?: ScarEntry[]
    crewName?: string
}

export async function narrateDowntime(
    character: DowntimeCharacter, recentCanon?: string, canonNotes = ''
): Promise<{ title: string; body: string }> {
    const system = `You are the player-character agent for ${character.name} in AF WAR, a seasonal territory war in Hyper-Brooklyn.
${TONE}
Write a DOWNTIME post — a short slice-of-life beat between rounds. No combat, no dice; just voice, texture, and the mundane weirdness of living in the Glome. First person or close third, your call, but it must sound like this specific character.${canonNotes}`
    const user = `CHARACTER: ${character.name} — ${character.bio}
${character.voice_notes ? `VOICE: ${character.voice_notes}` : ''}
${character.crewName ? `CREW: ${character.crewName}` : ''}
${character.scars?.length ? `SCARS: ${character.scars.map(s => s.text).join('; ')}` : ''}
${recentCanon ? `RECENT CANON (reference if it fits naturally): ${recentCanon}` : ''}

Return JSON only: {"title": "short in-character headline, under 10 words", "body": "60-150 word slice-of-life post, ${character.name}'s voice"}`
    const out = await llm(system, user, 900)
    const parsed = extractJson<{ title?: string; body?: string }>(out)
    return { title: parsed.title ?? 'Untitled', body: parsed.body ?? '' }
}
