// Match resolution — best-of-3 opposed exchanges (RULING R5), stakes, items,
// Blaze of Glory. Emits the BEAT SHEET: the ground-truth contract that both
// sides' narrations must honor.

import { Rng } from './rng'
import {
    CombatantState, ExchangeBeat, resolveExchange, blazeOfGlory, Ability, PowerPick,
} from './dice'

export type Stakes = 'skirmish' | 'scar' | 'death' | 'corruption'

export interface ItemDef {
    id: string
    name: string
    blurb: string
    /** forces every match the holder fights to this stake */
    forcesStakes?: Stakes
    /** on win: capture one extra adjacent zone; on loss: item drops in the zone */
    landwaster?: boolean
}

// Cursed items — W4R mechanics wearing AF skins (docs/rulings.md R7)
export const ITEMS: ItemDef[] = [
    { id: 'black-mayo-blade', name: 'The Black Mayonnaise Blade', blurb: 'Dredged from the Gowanus; it whispers. Every fight it touches is to the death.', forcesStakes: 'death' },
    { id: 'hypno-waffle', name: 'The Hypno-Waffle', blurb: 'An Awful Waffle special that never went on the menu. Lose to its holder and you wake up on their crew.', forcesStakes: 'corruption' },
    { id: 'landwaster', name: 'The Hedderack Landwaster Cannon', blurb: 'Salvaged ship weaponry nobody fully deciphered. Win big or drop it where you fell.', landwaster: true },
]

export interface MatchPC extends CombatantState {
    name: string
    crewId: string
    attackAbility: Ability   // signature attack stat (from archetype)
    power?: PowerPick        // signature archetype power
    itemId?: string
}

export interface MatchResult {
    zoneId: string
    stakes: Stakes
    a: string                // pc ids
    b: string
    exchanges: ExchangeBeat[]
    exchangeWins: Record<string, number>
    winner: string
    loser: string
    /** stake consequences, already applied to season state by the caller */
    consequence?:
        | { kind: 'scar'; to: string; authoredBy: string }
        | { kind: 'death'; who: string; killedBy: string }
        | { kind: 'corruption'; who: string; toCrew: string }
    blaze?: NonNullable<ExchangeBeat['blazeOfGlory']> & { alsoWon: boolean }
    itemDropped?: string
    itemExtraCapture?: boolean
}

/**
 * Best-of-3 exchanges, alternating initiative (loser of the previous exchange
 * attacks next — the book's "least goes first" energy, adapted). Failing
 * Successfully counters persist across the match (they're daily).
 */
export function runMatch(
    rng: Rng, zoneId: string, stakes: Stakes, a: MatchPC, b: MatchPC
): MatchResult {
    // items can escalate stakes
    for (const pc of [a, b]) {
        const item = ITEMS.find(i => i.id === pc.itemId)
        if (item?.forcesStakes) stakes = item.forcesStakes
    }

    const wins: Record<string, number> = { [a.id]: 0, [b.id]: 0 }
    const exchanges: ExchangeBeat[] = []
    let attacker = a, defender = b
    let n = 1
    while (wins[a.id] < 2 && wins[b.id] < 2 && n <= 5) {
        const matchPoint = wins[attacker.id] === 1 || wins[defender.id] === 1
        const power = attacker.policy.spendVpAtMatchPoint && matchPoint ? attacker.power : undefined
        const beat = resolveExchange(rng, n, attacker, defender, attacker.attackAbility, {
            matchPoint, deathStakes: stakes === 'death', atkPower: power,
        })
        exchanges.push(beat)
        wins[beat.winner] = (wins[beat.winner] ?? 0) + 1
        // loser of the exchange initiates the next (comeback pressure)
        if (beat.winner === attacker.id) [attacker, defender] = [defender, attacker]
        n++
    }

    let winner = wins[a.id] >= 2 ? a : b
    let loser = winner === a ? b : a

    // Blaze of Glory: facing defeat in a death match, policy-approved
    let blaze: MatchResult['blaze']
    if (stakes === 'death' && loser.policy.blazeOfGloryIfDying && loser.power && loser.hp > 0) {
        const bog = blazeOfGlory(rng, loser, Math.max(6, loser.power.level))
        // the all-in is an auto-success: it steals the match unless it kills you
        const alsoWon = !bog.died
        blaze = { ...bog, alsoWon }
        if (alsoWon) [winner, loser] = [loser, winner]
    }

    const result: MatchResult = {
        zoneId, stakes, a: a.id, b: b.id, exchanges,
        exchangeWins: wins, winner: winner.id, loser: loser.id, blaze,
    }

    // stake consequences (caller applies to season state; recorded here)
    if (stakes === 'scar') result.consequence = { kind: 'scar', to: loser.id, authoredBy: winner.id }
    if (stakes === 'death') {
        const dead = blaze?.died ? (blaze.who === loser.id ? loser : winner) : loser
        result.consequence = { kind: 'death', who: dead.id, killedBy: dead.id === loser.id ? winner.id : loser.id }
    }
    if (stakes === 'corruption') result.consequence = { kind: 'corruption', who: loser.id, toCrew: winner.crewId }

    // landwaster
    const wItem = ITEMS.find(i => i.id === winner.itemId)
    const lItem = ITEMS.find(i => i.id === loser.itemId)
    if (wItem?.landwaster) result.itemExtraCapture = true
    if (lItem?.landwaster) result.itemDropped = lItem.id

    return result
}
