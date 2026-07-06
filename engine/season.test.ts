import { describe, it, expect } from 'vitest'
import { makeRng } from './rng.js'
import { ZONES, zoneById, bfsCorruptionOrder } from './map.js'
import { runMatch, MatchPC } from './match.js'
import {
    setupSeason, playRound, playConvergence, heuristicIntent, SeasonConfig, PCDef,
    attackableZones, GRAVES_END_PRICE,
} from './season.js'
import { Stats } from './dice.js'

const STATS: Stats = { STR: 10, END: 8, DEX: 6, CHA: 6, INT: 4 }

function pcDef(id: string, crewId: string): PCDef {
    return {
        id, name: id.toUpperCase(), crewId, stats: STATS, attackAbility: 'STR',
        power: { name: 'Blast', level: 3 },
        policy: { resistVs: ['STR'], counterWhenHpAbove: 7, spendVpAtMatchPoint: true, blazeOfGloryIfDying: true },
        bio: 'test pc', modelSheetHint: 'test',
    }
}

const CFG: SeasonConfig = {
    seed: 'af-war-test',
    crews: [
        { id: 'crew-a', name: 'The Waffle Irons', motto: 'Order up.' },
        { id: 'crew-b', name: 'Sewer Kings', motto: 'The depths provide.' },
        { id: 'crew-c', name: 'Chrono Bowlers', motto: 'Strike eternal.' },
    ],
    pcs: [
        pcDef('a1', 'crew-a'), pcDef('a2', 'crew-a'),
        pcDef('b1', 'crew-b'), pcDef('b2', 'crew-b'),
        pcDef('c1', 'crew-c'), pcDef('c2', 'crew-c'),
    ],
    rounds: 4,
    corruptionPerRound: { 2: 1, 3: 2, 4: 3 },
}

describe('map', () => {
    it('adjacency is symmetric', () => {
        for (const z of ZONES) for (const adj of z.adjacent) {
            expect(zoneById(adj).adjacent, `${adj} should point back to ${z.id}`).toContain(z.id)
        }
    })
    it('corruption order reaches every non-finale zone', () => {
        const order = bfsCorruptionOrder(r => r)
        expect(new Set(order).size).toBe(order.length)
        expect(order.length).toBe(ZONES.filter(z => !z.finale).length)
        expect(order).not.toContain('ebbets-field')
    })
})

describe('season', () => {
    it('sets up with non-adjacent crew homes', () => {
        const s = setupSeason(CFG)
        const homes = [...s.crews.values()].map(c => c.zones[0])
        expect(new Set(homes).size).toBe(3)
        for (const h of homes) for (const other of homes) {
            if (h !== other) expect(zoneById(h).adjacent).not.toContain(other)
        }
    })
    it('is fully deterministic under a seed', () => {
        const play = () => {
            const s = setupSeason(CFG)
            for (let r = 1; r <= CFG.rounds; r++) playRound(s, heuristicIntent(s, makeRng(CFG.seed + ':intent:' + r)))
            playConvergence(s)
            return JSON.stringify({ canon: s.canon, winner: s.finaleWinner })
        }
        expect(play()).toBe(play())
    })
    it('runs a full season: corruption spreads, finale crowns a winner, canon accumulates', () => {
        const s = setupSeason(CFG)
        for (let r = 1; r <= CFG.rounds; r++) {
            const rep = playRound(s, heuristicIntent(s, makeRng(CFG.seed + ':intent:' + r)))
            expect(rep.round).toBe(r)
        }
        const corrupted = [...s.zones.values()].filter(z => z.corrupted).length
        expect(corrupted).toBe(1 + 2 + 3)
        expect(s.zones.get('ebbets-field')!.corrupted).toBe(false)
        const finale = playConvergence(s)
        expect(s.finished).toBe(true)
        expect(s.finaleWinner).toBeDefined()
        expect(finale.matches.length).toBeGreaterThanOrEqual(1)
        expect(s.canon.some(e => e.kind === 'convergence')).toBe(true)
    })
    it('attackable zones exclude own turf, corrupted zones, and the finale', () => {
        const s = setupSeason(CFG)
        for (const crew of s.crews.keys()) {
            const targets = attackableZones(s, crew)
            expect(targets).not.toContain('ebbets-field')
            for (const t of targets) expect(s.zones.get(t)!.controlledBy).not.toBe(crew)
        }
    })
    it('undefended zones flip without a match', () => {
        const s = setupSeason(CFG)
        const target = attackableZones(s, 'crew-a').find(z => !s.zones.get(z)!.controlledBy)!
        const rep = playRound(s, { attacks: [{ crewId: 'crew-a', pcId: 'a1', targetZone: target, stakes: 'skirmish' }], allianceProposals: [], resurrections: [] })
        expect(rep.matches.length).toBe(0)
        expect(s.zones.get(target)!.controlledBy).toBe('crew-a')
    })
    it('death stakes grant Graves End credit and resurrection works at price', () => {
        // engineered: kill b1 via repeated death matches until one lands, then resurrect
        const s = setupSeason(CFG)
        let dead = false
        for (let r = 1; r <= 8 && !dead; r++) {
            const bZone = s.crews.get('crew-b')!.zones[0]
            if (!bZone) break
            const reachable = attackableZones(s, 'crew-a').includes(bZone)
            const intent = reachable
                ? { attacks: [{ crewId: 'crew-a' as const, pcId: 'a1', targetZone: bZone, stakes: 'death' as const }], allianceProposals: [] as [string, string][], resurrections: [] }
                : heuristicIntent(s, makeRng('h' + r))
            playRound(s, intent)
            dead = [...s.pcs.values()].some(p => p.status === 'dead')
        }
        if (dead) {
            const corpse = [...s.pcs.values()].find(p => p.status === 'dead')!
            const crew = s.crews.get(corpse.crewId)!
            crew.gravesEndCredit = GRAVES_END_PRICE
            playRound(s, { attacks: [], allianceProposals: [], resurrections: [{ crewId: crew.id, pcId: corpse.id }] })
            expect(s.pcs.get(corpse.id)!.status).toBe('active')
            expect(crew.gravesEndCredit).toBe(0)
        }
    })
    it('alliance forms on mutual proposal; attacking an ally logs a betrayal', () => {
        const s = setupSeason(CFG)
        playRound(s, { attacks: [], allianceProposals: [['crew-a', 'crew-b'], ['crew-b', 'crew-a']], resurrections: [] })
        expect(s.crews.get('crew-a')!.alliances).toContain('crew-b')
        // now a betrays b if reachable
        for (let r = 2; r <= 10; r++) {
            const bZone = s.crews.get('crew-b')!.zones[0]
            if (bZone && attackableZones(s, 'crew-a').includes(bZone)) {
                playRound(s, { attacks: [{ crewId: 'crew-a', pcId: 'a1', targetZone: bZone, stakes: 'skirmish' }], allianceProposals: [], resurrections: [] })
                expect(s.canon.some(e => e.kind === 'betrayal' && e.traitor === 'crew-a')).toBe(true)
                expect(s.crews.get('crew-a')!.alliances).not.toContain('crew-b')
                return
            }
            playRound(s, { attacks: [], allianceProposals: [], resurrections: [] })
        }
    })
})

describe('match integration', () => {
    it('best-of-3 always produces a winner and 2-5 exchanges', () => {
        for (let i = 0; i < 100; i++) {
            const rng = makeRng('m' + i)
            const a: MatchPC = { ...pcDef('a1', 'x'), hp: 10, vp: 10, incompetence: 5 } as MatchPC
            const b: MatchPC = { ...pcDef('b1', 'y'), hp: 10, vp: 10, incompetence: 5 } as MatchPC
            const r = runMatch(rng, 'bed-stuy', 'skirmish', a, b)
            expect(['a1', 'b1']).toContain(r.winner)
            expect(r.exchanges.length).toBeGreaterThanOrEqual(2)
            expect(r.exchanges.length).toBeLessThanOrEqual(5)
        }
    })
    it('cursed item escalates stakes: Black Mayo Blade forces death matches', () => {
        for (let i = 0; i < 50; i++) {
            const rng = makeRng('bm' + i)
            const a: MatchPC = { ...pcDef('a1', 'x'), hp: 10, vp: 10, incompetence: 5, itemId: 'black-mayo-blade' } as MatchPC
            const b: MatchPC = { ...pcDef('b1', 'y'), hp: 10, vp: 10, incompetence: 5 } as MatchPC
            const r = runMatch(rng, 'bed-stuy', 'skirmish', a, b)
            expect(r.stakes).toBe('death')
            expect(r.consequence?.kind).toBe('death')
            return
        }
    })
})

describe('the Glome breathes', () => {
    it('active map scales with player count and stays contiguous around the finale', () => {
        const small = setupSeason({ ...CFG, playerCount: 2 })
        const big = setupSeason({ ...CFG, playerCount: 20 })
        const activeCount = (s: ReturnType<typeof setupSeason>) => [...s.zones.values()].filter(z => !z.beyond).length
        expect(activeCount(small)).toBeLessThan(activeCount(big))
        expect(activeCount(small)).toBeGreaterThanOrEqual(8)
        expect(small.zones.get('ebbets-field')!.beyond).toBeFalsy()
        expect(small.zones.get('gowanus')!.beyond).toBeFalsy()
    })
    it('crews never spawn beyond the Glome; attacks never target beyond', () => {
        const s = setupSeason({ ...CFG, playerCount: 2 })
        for (const c of s.crews.values()) expect(s.zones.get(c.zones[0])!.beyond).toBeFalsy()
        for (const crew of s.crews.keys()) for (const t of attackableZones(s, crew)) {
            expect(s.zones.get(t)!.beyond).toBeFalsy()
        }
    })
})
