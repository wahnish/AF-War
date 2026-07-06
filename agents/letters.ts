// Character letters — the growth-spec's core retention mechanic
// (docs/growth-spec.md §1). After each round, each active character emails
// its owner IN VOICE: a recap, gossip about a crewmate/rival (the "bonding
// gold" — never skip it), and ONE concrete question needing a Direction.
// Plain-text letter aesthetic — never a newsletter. Reuses the TONE contract
// from narrate.ts (don't restate it).

import { llm, extractJson } from './llm.js'
import { TONE } from './narrate.js'

export interface LetterCharacter {
    id: string
    name: string
    bio: string
    voice_notes?: string | null
    crewName?: string
}

export interface LetterGossipSubject {
    name: string
    relation: string // e.g. "crewmate", "rival", "the being who nearly killed you"
    note: string      // something that happened involving them this round
}

export interface LetterRoundContext {
    round: number
    recapText: string           // the character's own telling/prose or gazette excerpt for this round
    judgeNote?: string          // the Arbiter's critique, if this character had a judged match
    gossipSubjects: LetterGossipSubject[] // 1-2 other characters worth gossiping about
}

export interface Letter {
    subject: string
    body: string // plain text, signed by the character — no markdown headers, no bullet lists
}

/**
 * Writes one character's in-voice round letter. The letter must: recap the
 * round from THIS character's POV at their tone-contract register, gossip
 * about 1-2 others (explicitly required — this is the bonding gold that
 * makes AF WAR read like a group chat, not a report), and end with exactly
 * ONE concrete question answerable by submitting a Direction (gambit /
 * tone_note / vp_budget / ability_lane — the letter is a second interface
 * onto the same mechanic the Barracks Direction form already structures).
 */
export async function writeLetter(character: LetterCharacter, ctx: LetterRoundContext): Promise<Letter> {
    const system = `You are ${character.name}, a player character in AF WAR, a seasonal territory war in Hyper-Brooklyn, writing a personal email to your director (the human who plays you).
${TONE}
This is a LETTER, not a newsletter and not a status report. Write like a person emailing someone they trust: plain prose, first person, your own rhythm and diction, signed at the end with your name. NO markdown headers, NO bullet lists, NO "Round ${ctx.round} Recap:" style labels — if it reads like an app generated it, you have failed.
The letter has three jobs, in this order, blended into natural prose (not labeled sections):
1. Recap what happened to YOU this round, in your voice, at your emotional register.
2. GOSSIP — mention what one or two other beings (crewmates, rivals, whoever) did this round. This is not optional. You are a person with opinions about your friends and enemies; say them.
3. End with exactly ONE concrete question for your director that a real answer would change — something answerable by "here's your gambit / tone / VP budget / which ability to lean on for next time." Make it a genuine fork, not a formality.`

    const gossipLines = ctx.gossipSubjects
        .map((g) => `${g.name} (${g.relation}): ${g.note}`)
        .join('\n')

    const user = `ROUND ${ctx.round} — what happened to you:
${ctx.recapText}
${ctx.judgeNote ? `\nTHE ARBITER SAID: ${ctx.judgeNote}` : ''}
${character.voice_notes ? `\nYOUR VOICE: ${character.voice_notes}` : ''}
${character.crewName ? `\nYOUR CREW: ${character.crewName}` : ''}

GOSSIP MATERIAL (mention at least one of these, in your own words — don't just repeat this verbatim):
${gossipLines || '(nothing juicy happened to anyone else worth mentioning — invent a small, plausible aside about Hyper-Brooklyn instead)'}

Write the letter now: a short subject line, then the body. Return JSON only: {"subject": "short subject line, in character", "body": "the full letter, plain text, signed ${character.name}"}`

    const out = await llm(system, user, 900)
    const parsed = extractJson<{ subject?: string; body?: string }>(out)
    return {
        subject: parsed.subject ?? `${character.name} — Round ${ctx.round}`,
        body: parsed.body ?? '',
    }
}
