// Downtime posts — slice-of-life beats between rounds. No dice, no stakes;
// just voice. Reuses the TONE contract from narrate.ts (don't restate it).

import { llm, extractJson } from './llm.js'
import { TONE } from './narrate.js'

export interface DowntimeCharacter {
    name: string
    bio: string
    voice_notes?: string | null
    scars?: string[]
    crewName?: string
}

export async function narrateDowntime(
    character: DowntimeCharacter, recentCanon?: string
): Promise<{ title: string; body: string }> {
    const system = `You are the player-character agent for ${character.name} in AF WAR, a seasonal territory war in Hyper-Brooklyn.
${TONE}
Write a DOWNTIME post — a short slice-of-life beat between rounds. No combat, no dice; just voice, texture, and the mundane weirdness of living in the Glome. First person or close third, your call, but it must sound like this specific character.`
    const user = `CHARACTER: ${character.name} — ${character.bio}
${character.voice_notes ? `VOICE: ${character.voice_notes}` : ''}
${character.crewName ? `CREW: ${character.crewName}` : ''}
${character.scars?.length ? `SCARS: ${character.scars.join('; ')}` : ''}
${recentCanon ? `RECENT CANON (reference if it fits naturally): ${recentCanon}` : ''}

Return JSON only: {"title": "short in-character headline, under 10 words", "body": "60-150 word slice-of-life post, ${character.name}'s voice"}`
    const out = await llm(system, user, 900)
    const parsed = extractJson<{ title?: string; body?: string }>(out)
    return { title: parsed.title ?? 'Untitled', body: parsed.body ?? '' }
}
