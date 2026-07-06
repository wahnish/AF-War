import { describe, it, expect } from 'vitest'
import { makeRng } from './rng.js'
import {
    explode, resolveExchange, blazeOfGlory, rollIncompetence, powerBonusDie,
    CombatantState, Stats,
} from './dice.js'

const STATS: Stats = { STR: 10, END: 8, DEX: 6, CHA: 6, INT: 4 }

function fighter(id: string, over: Partial<CombatantState> = {}): CombatantState {
    return {
        id, stats: STATS, hp: 10, vp: 10, incompetence: 5,
        policy: { resistVs: [], counterWhenHpAbove: 99, spendVpAtMatchPoint: false, blazeOfGloryIfDying: false },
        ...over,
    }
}

describe('explode', () => {
    it('is deterministic under a seed', () => {
        const a = explode(makeRng('x'), 8)
        const b = explode(makeRng('x'), 8)
        expect(a).toEqual(b)
    })
    it('explodes on max face and stacks', () => {
        // hunt a seed that explodes a d4 at least twice, then verify the sum
        for (let i = 0; i < 200; i++) {
            const r = explode(makeRng('seed' + i), 4)
            if (r.rolls.length >= 3) {
                expect(r.rolls[0]).toBe(4)
                expect(r.rolls[1]).toBe(4)
                expect(r.total).toBe(r.rolls.reduce((s, x) => s + x, 0))
                expect(r.exploded).toBe(true)
                return
            }
        }
        throw new Error('no double explosion found in 200 seeds — implausible')
    })
    it('flags nat 1 on first roll only', () => {
        for (let i = 0; i < 100; i++) {
            const r = explode(makeRng('n' + i), 6)
            expect(r.natOne).toBe(r.rolls[0] === 1)
        }
    })
})

describe('resolveExchange', () => {
    it('ties go to the initiator', () => {
        // hunt a seed producing a tie without crit-fails
        for (let i = 0; i < 3000; i++) {
            const rng = makeRng('tie' + i)
            const atk = fighter('A'), def = fighter('D')
            const beat = resolveExchange(rng, 1, atk, def, 'STR', { matchPoint: false, deathStakes: false })
            if (beat.critFail || beat.defenseMode === 'counter') continue
            if (beat.attackRoll.total === beat.defenseRoll.total && !beat.powerUsed) {
                expect(beat.winner).toBe('A')
                expect(beat.damage).toBeGreaterThanOrEqual(1)
                return
            }
        }
        throw new Error('no clean tie found')
    })
    it('defender crit-fail = double damage undefended', () => {
        for (let i = 0; i < 3000; i++) {
            const rng = makeRng('dcf' + i)
            const atk = fighter('A'), def = fighter('D')
            const beat = resolveExchange(rng, 1, atk, def, 'STR', { matchPoint: false, deathStakes: false })
            if (beat.critFail && beat.critFail.who === 'D' && !beat.critFail.failedSuccessfully && !beat.attackRoll.natOne) {
                expect(beat.winner).toBe('A')
                expect(beat.damage).toBe(beat.attackRoll.total * 2)
                expect(def.hp).toBe(10 - beat.damage)
                return
            }
        }
        throw new Error('no defender crit-fail found')
    })
    it('Failing Successfully: the crit-fail that zeroes the counter WINS', () => {
        for (let i = 0; i < 3000; i++) {
            const rng = makeRng('fs' + i)
            const atk = fighter('A', { incompetence: 1 }) // next nat-1 fires it
            const def = fighter('D')
            const beat = resolveExchange(rng, 1, atk, def, 'STR', { matchPoint: false, deathStakes: false })
            if (beat.attackRoll.natOne) {
                expect(beat.critFail?.failedSuccessfully).toBe(true)
                expect(beat.winner).toBe('A')
                expect(beat.note).toContain('FAILING SUCCESSFULLY')
                return
            }
        }
        throw new Error('no nat-1 attacker found')
    })
    it('power spend deducts VP and adds a bonus die', () => {
        for (let i = 0; i < 500; i++) {
            const rng = makeRng('pw' + i)
            const atk = fighter('A'), def = fighter('D')
            const beat = resolveExchange(rng, 1, atk, def, 'STR', {
                matchPoint: true, deathStakes: false, atkPower: { name: 'Telekinetic Blast', level: 3 },
            })
            if (beat.critFail) continue
            expect(beat.powerUsed?.vpSpent).toBe(3)
            expect(atk.vp).toBe(7)
            expect(beat.powerUsed?.bonus.die).toBe(powerBonusDie(3))
            return
        }
        throw new Error('no clean power exchange found')
    })
    it('failed counterattack takes FULL undefended damage', () => {
        for (let i = 0; i < 3000; i++) {
            const rng = makeRng('cc' + i)
            const atk = fighter('A')
            const def = fighter('D', { policy: { resistVs: [], counterWhenHpAbove: 0, spendVpAtMatchPoint: false, blazeOfGloryIfDying: false } })
            const beat = resolveExchange(rng, 1, atk, def, 'STR', { matchPoint: false, deathStakes: false })
            if (beat.defenseMode === 'counter' && beat.winner === 'A') {
                expect(beat.damage).toBe(beat.attackRoll.total + (beat.powerUsed?.bonus.total ?? 0))
                expect(def.hp).toBe(10 - beat.damage)
                return
            }
        }
        throw new Error('no failed counter found')
    })
})

describe('blazeOfGlory', () => {
    it('spends into negative VP and takes 1d10 per debt point', () => {
        const rng = makeRng('bog')
        const who = fighter('A', { vp: 2 })
        const r = blazeOfGlory(rng, who, 6)
        expect(r.vpDebt).toBe(4)
        expect(who.vp).toBe(-4)
        expect(r.selfDamage).toBeGreaterThanOrEqual(4)
        expect(r.selfDamage).toBeLessThanOrEqual(40)
        expect(r.died).toBe(who.hp <= 0)
    })
})

describe('rollIncompetence', () => {
    it('uses the largest stat die', () => {
        for (let i = 0; i < 50; i++) {
            const v = rollIncompetence(makeRng('ic' + i), STATS)
            expect(v).toBeGreaterThanOrEqual(1)
            expect(v).toBeLessThanOrEqual(10)
        }
    })
})
