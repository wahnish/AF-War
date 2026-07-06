// Shared row shapes for afwar_* tables. Mirrors db/schema.sql.
import type { Ability, Die } from './engine/dice'
import type { SeasonState } from './engine/season'

export interface Profile {
    id: string
    handle: string | null
    created_at: string
}

export interface CharacterStats {
    STR: Die; END: Die; DEX: Die; CHA: Die; INT: Die
}

export interface CharacterPower {
    name: string
    level: number
}

export interface CharacterPolicy {
    resistVs: Ability[]
    counterWhenHpAbove: number
    spendVpAtMatchPoint: boolean
    blazeOfGloryIfDying: boolean
}

export interface Character {
    id: string
    owner_id: string
    name: string
    archetype: string
    stats: CharacterStats
    attack_ability: Ability
    power: CharacterPower
    policy: CharacterPolicy
    bio: string
    voice_notes: string | null
    model_sheet_url: string | null
    status: 'active' | 'dead'
    scars: string[]
    kills: number
    clout: number
    crew_id: string | null
    created_at: string
}

export interface Crew {
    id: string
    name: string
    motto: string | null
    created_at: string
}

export interface Season {
    id: string
    name: string
    config: Record<string, unknown>
    state: SeasonState | null
    status: 'setup' | 'active' | 'finished'
    created_at: string
}

export type MatchDiceTranscript = unknown // MatchResult, kept loose at the DB boundary
export type MatchTellings = unknown // Telling[]
export type MatchVerdict = { canonPcId: string; scores: Record<string, number>; critique: string } | null

export interface MatchRow {
    id: string
    season_id: string
    round: number
    zone_id: string
    stakes: string
    a_character: string | null
    b_character: string | null
    dice_transcript: MatchDiceTranscript
    tellings: MatchTellings
    verdict: MatchVerdict
    winner: string | null
    created_at: string
}

export interface Post {
    id: string
    season_id: string | null
    author_character: string | null
    kind: 'gazette' | 'match' | 'downtime' | 'system'
    title: string
    body: string
    media: unknown[]
    round: number | null
    created_at: string
}

export interface CanonEventRow {
    id: string
    season_id: string
    round: number
    event: Record<string, unknown>
    created_at: string
}

export interface Direction {
    id: string
    match_id: string | null
    season_id: string
    round: number
    character_id: string
    director_id: string
    gambit: string
    tone_note: string | null
    vp_budget: number | null
    ability_lane: string | null
    created_at: string
}
