// AF dice core — the Adult Fantasy Player's Handbook rules, adapted for
// server-side async resolution. Every deviation from the book is recorded
// in docs/rulings.md.
//
// Book rules kept verbatim:
//   · Step dice d4..d20, exploding ("crits can stack — keep rolling")
//   · Nat 1 on the FIRST roll = critical failure
//   · Opposed rolls, ties go to the initiator
//   · Failing Successfully: daily Incompetence Counter (roll of largest die);
//     each nat-1 decrements it; the crit-fail that lands it on 0 becomes a
//     CRITICAL SUCCESS and must be narrated as failure-causing-success
//   · VP: powers cost VP equal to their level; Blaze of Glory = spend into
//     negative for an undefendable auto-success, then take 1d10 per negative VP

import { Rng, rollDie } from './rng.js'

export type Die = 4 | 6 | 8 | 10 | 12 | 20
export const ABILITIES = ['STR', 'END', 'DEX', 'CHA', 'INT'] as const
export type Ability = (typeof ABILITIES)[number]
export type Stats = Record<Ability, Die>

export interface ExplodedRoll {
    die: Die
    rolls: number[]      // each face shown, in order (explosions append)
    total: number
    natOne: boolean      // nat 1 on the FIRST roll only
    exploded: boolean
}

/** Exploding step-die roll. Max face → roll again and add, repeatedly. */
export function explode(rng: Rng, die: Die): ExplodedRoll {
    const rolls: number[] = []
    let r = rollDie(rng, die)
    rolls.push(r)
    let total = r
    while (r === die) {
        r = rollDie(rng, die)
        rolls.push(r)
        total += r
    }
    return { die, rolls, total, natOne: rolls[0] === 1, exploded: rolls.length > 1 }
}

// ── Powers (RULING R3): using an archetype power of level L costs L VP and
//    adds a bonus die stepped by level. Specific book powers keep their
//    narrative identity; mechanically they ride this curve in v1.
export function powerBonusDie(level: number): Die {
    if (level <= 2) return 4
    if (level <= 4) return 6
    if (level <= 6) return 8
    if (level <= 9) return 10
    return 12
}

export interface CombatantState {
    id: string
    stats: Stats
    hp: number
    vp: number
    /** Failing Successfully: today's Incompetence Counter (rolled at day start). */
    incompetence: number
    /** Director-tuned async defense policy (RULING R2 — the one real rules change). */
    policy: DefensePolicy
}

export interface DefensePolicy {
    /** Defend with DEX (dodge) unless attack is keyed to this list → END (resist). */
    resistVs: Ability[]
    /** Counterattack when own HP > this AND we lost the previous exchange. */
    counterWhenHpAbove: number
    /** Spend VP on a power when an exchange is high-stakes (match point). */
    spendVpAtMatchPoint: boolean
    /** Approve Blaze of Glory when facing defeat in a death-stakes match. */
    blazeOfGloryIfDying: boolean
}

export function rollIncompetence(rng: Rng, stats: Stats): number {
    const largest = Math.max(...Object.values(stats)) as Die
    return rollDie(rng, largest)
}

// ── One opposed exchange ────────────────────────────────────────────────────
export interface ExchangeBeat {
    n: number
    attacker: string
    defender: string
    attackAbility: Ability
    attackRoll: ExplodedRoll
    powerUsed?: { name: string; level: number; vpSpent: number; bonus: ExplodedRoll }
    defenseMode: 'dodge' | 'resist' | 'counter'
    defenseRoll: ExplodedRoll
    counterRoll?: ExplodedRoll
    winner: string
    damage: number
    critFail?: { who: string; failedSuccessfully: boolean }
    blazeOfGlory?: { who: string; vpDebt: number; selfDamage: number; died: boolean }
    note?: string
}

export interface PowerPick {
    name: string
    level: number
}

/**
 * Resolve one opposed exchange. Attacker rolls ability (+ optional power bonus),
 * defender dodges/resists per policy, may counter. Ties go to the initiator.
 * Crit-fails checked BEFORE totals: a nat-1 loses the exchange outright unless
 * Failing Successfully fires (counter hits 0) — then it's a critical success.
 */
export function resolveExchange(
    rng: Rng,
    n: number,
    atk: CombatantState,
    def: CombatantState,
    attackAbility: Ability,
    opts: { matchPoint: boolean; atkPower?: PowerPick; deathStakes: boolean }
): ExchangeBeat {
    const attackRoll = explode(rng, atk.stats[attackAbility])

    // Power spend (policy-gated upstream; engine just applies)
    let powerUsed: ExchangeBeat['powerUsed']
    if (opts.atkPower && atk.vp >= opts.atkPower.level) {
        const bonus = explode(rng, powerBonusDie(opts.atkPower.level))
        atk.vp -= opts.atkPower.level
        powerUsed = { name: opts.atkPower.name, level: opts.atkPower.level, vpSpent: opts.atkPower.level, bonus }
    }

    const defenseMode: ExchangeBeat['defenseMode'] = def.policy.resistVs.includes(attackAbility) ? 'resist' : 'dodge'
    const defAbility: Ability = defenseMode === 'resist' ? 'END' : 'DEX'
    const defenseRoll = explode(rng, def.stats[defAbility])

    const beat: ExchangeBeat = {
        n, attacker: atk.id, defender: def.id, attackAbility,
        attackRoll, powerUsed, defenseMode, defenseRoll,
        winner: '', damage: 0,
    }

    // Crit-fail gate (checked before totals; attacker first — RULING R4)
    for (const [who, roll, other] of [[atk, attackRoll, def], [def, defenseRoll, atk]] as const) {
        if (!roll.natOne) continue
        who.incompetence -= 1
        if (who.incompetence === 0) {
            // FAILING SUCCESSFULLY — the crit-fail becomes a critical success
            beat.critFail = { who: who.id, failedSuccessfully: true }
            beat.winner = who.id
            beat.damage = who === atk ? attackRoll.die : 0 // face value as flavor damage
            if (who === atk) other.hp -= beat.damage
            beat.note = 'FAILING SUCCESSFULLY: the botch becomes the win — narrate how.'
            return beat
        }
        beat.critFail = { who: who.id, failedSuccessfully: false }
        beat.winner = other.id
        beat.damage = 0
        beat.note = who === atk
            ? 'Attacker critically failed — the attack self-destructs.'
            : 'Defender critically failed — hit lands undefended for double damage.'
        if (who === def) {
            beat.damage = (attackRoll.total + (powerUsed?.bonus.total ?? 0)) * 2
            def.hp -= beat.damage
        }
        return beat
    }

    const atkTotal = attackRoll.total + (powerUsed?.bonus.total ?? 0)

    // Counterattack gamble (policy): declared with defense; failure = full undefended damage
    const wantsCounter = def.policy.counterWhenHpAbove < def.hp && !opts.matchPoint
    if (wantsCounter) {
        beat.defenseMode = 'counter'
        const counterRoll = explode(rng, def.stats[defAbility])
        beat.counterRoll = counterRoll
        if (counterRoll.total > atkTotal) {
            beat.winner = def.id
            beat.damage = counterRoll.total - atkTotal
            atk.hp -= beat.damage
            beat.note = 'Counterattack lands — a free hit the attacker cannot defend.'
        } else {
            beat.winner = atk.id
            beat.damage = atkTotal // FULL damage, undefended (book rule)
            def.hp -= beat.damage
            beat.note = 'Counterattack fails — full damage, undefended.'
        }
        return beat
    }

    if (atkTotal >= defenseRoll.total) {
        // ties go to the initiator (book rule)
        beat.winner = atk.id
        beat.damage = Math.max(1, atkTotal - defenseRoll.total)
        def.hp -= beat.damage
    } else {
        beat.winner = def.id
        beat.damage = 0
    }
    return beat
}

// ── Blaze of Glory ──────────────────────────────────────────────────────────
export function blazeOfGlory(rng: Rng, who: CombatantState, powerLevel: number): NonNullable<ExchangeBeat['blazeOfGlory']> {
    const debt = Math.max(1, powerLevel - Math.max(0, who.vp))
    who.vp -= powerLevel
    let selfDamage = 0
    for (let i = 0; i < debt; i++) selfDamage += rollDie(rng, 10)
    who.hp -= selfDamage
    return { who: who.id, vpDebt: debt, selfDamage, died: who.hp <= 0 }
}
