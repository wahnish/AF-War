// The season state machine: crews under a shrinking Glome.
// Round loop: corruption spreads → intents (agents or heuristic) → match
// allocation → resolution → consequences → canon events → scoring.
// The engine is I/O-free; agents plug in through RoundIntent.

import { Rng, makeRng, pick, shuffle, rollDie } from './rng'
import { ABILITIES, Ability, Die, Stats, rollIncompetence, DefensePolicy, PowerPick } from './dice'
import { ZONES, Zone, zoneById, bfsCorruptionOrder, corruptionSchedule, glomeZones, CORRUPTION_SOURCE } from './map'
import { MatchPC, MatchResult, Stakes, runMatch, ITEMS } from './match'

export interface PCDef {
    id: string
    name: string
    crewId: string
    stats: Stats
    attackAbility: Ability
    power?: PowerPick
    policy: DefensePolicy
    bio: string           // for the agents layer
    modelSheetHint: string // visual description for comic refs
}

export interface PCState extends MatchPC {
    bio: string
    modelSheetHint: string
    status: 'active' | 'dead'
    scars: string[]        // scar ids (text authored later by winner's agent)
    kills: number
}

export interface Crew {
    id: string
    name: string
    motto: string
    zones: string[]        // controlled turf
    gravesEndCredit: number  // kill-credit; spend to resurrect (RULING R6)
    alliances: string[]      // crew ids — explicit, logged, breakable
    eliminated: boolean
}

export type CanonEvent =
    | { round: number; kind: 'zone_flip'; zoneId: string; from?: string; to: string }
    | { round: number; kind: 'zone_corrupted'; zoneId: string }
    | { round: number; kind: 'scar'; pcId: string; authoredBy: string; zoneId: string; text?: string }
    | { round: number; kind: 'death'; pcId: string; killedBy: string; zoneId: string }
    | { round: number; kind: 'defection'; pcId: string; fromCrew: string; toCrew: string; zoneId: string }
    | { round: number; kind: 'resurrection'; pcId: string; byCrew: string; cost: number }
    | { round: number; kind: 'alliance'; a: string; b: string }
    | { round: number; kind: 'betrayal'; traitor: string; victim: string; zoneId: string }
    | { round: number; kind: 'blaze_of_glory'; pcId: string; died: boolean; won: boolean; zoneId: string }
    | { round: number; kind: 'item_taken' | 'item_dropped'; itemId: string; pcId?: string; zoneId: string }
    | { round: number; kind: 'convergence'; zoneId: string; winnerCrew: string }

export interface AttackIntent {
    crewId: string
    pcId: string
    targetZone: string
    stakes: Stakes         // proposed; director approval assumed encoded in policy upstream
}

export interface RoundIntent {
    attacks: AttackIntent[]
    /** crewId pairs proposing alliance this round (both sides must propose) */
    allianceProposals: [string, string][]
    /** resurrection spends: crew → pcId (must be dead, costs GRAVES_END_PRICE) */
    resurrections: { crewId: string; pcId: string }[]
}

export const GRAVES_END_PRICE = 3 // kill-credits per resurrection (RULING R6)

export interface RoundReport {
    round: number
    corrupted: string[]
    matches: MatchResult[]
    grandBattleZone?: string
    events: CanonEvent[]
    scores: Record<string, number>
}

export interface SeasonState {
    seed: string
    round: number
    zones: Map<string, { controlledBy?: string; corrupted: boolean; beyond?: boolean; itemOnGround?: string }>
    pcs: Map<string, PCState>
    crews: Map<string, Crew>
    canon: CanonEvent[]
    corruptSched: Map<string, number>
    reports: RoundReport[]
    finished: boolean
    finaleWinner?: string
}

export interface SeasonConfig {
    seed: string
    /** sizes the Glome (spec §10b: the Glome breathes). Defaults to pcs.length. */
    playerCount?: number
    crews: { id: string; name: string; motto: string }[]
    pcs: PCDef[]
    rounds: number                    // rounds before convergence
    corruptionPerRound: Record<number, number>
    startingItems?: Record<string, string> // zoneId -> itemId on the ground
}

export function setupSeason(cfg: SeasonConfig): SeasonState {
    const rng = makeRng(cfg.seed + ':setup')
    const active = glomeZones(cfg.playerCount ?? cfg.pcs.length, ring => shuffle(rng, ring))
    const zones = new Map<string, { controlledBy?: string; corrupted: boolean; beyond?: boolean; itemOnGround?: string }>()
    for (const z of ZONES) zones.set(z.id, { corrupted: false, beyond: !active.has(z.id) })
    for (const [zid, item] of Object.entries(cfg.startingItems ?? {})) zones.get(zid)!.itemOnGround = item

    // starting turf: each crew gets a home zone, spread out (seeded pick of non-adjacent starts)
    const candidates = shuffle(rng, ZONES.filter(z => !z.finale && z.id !== CORRUPTION_SOURCE && z.id !== 'monorail' && active.has(z.id)).map(z => z.id))
    const crews = new Map<string, Crew>()
    const taken: string[] = []
    for (const c of cfg.crews) {
        const home = candidates.find(id => !taken.some(t => zoneById(t).adjacent.includes(id) || t === id))!
        taken.push(home)
        crews.set(c.id, { ...c, zones: [home], gravesEndCredit: 0, alliances: [], eliminated: false })
        zones.get(home)!.controlledBy = c.id
    }

    const pcs = new Map<string, PCState>()
    for (const p of cfg.pcs) {
        pcs.set(p.id, {
            ...p, hp: 10, vp: 10,
            incompetence: rollIncompetence(makeRng(cfg.seed + ':ic:' + p.id), p.stats),
            status: 'active', scars: [], kills: 0,
        })
    }

    const order = bfsCorruptionOrder(ring => shuffle(rng, ring), active)
        .filter(id => id !== CORRUPTION_SOURCE) // the source corrupts in round 2 explicitly
    const corruptSched = corruptionSchedule([CORRUPTION_SOURCE, ...order], cfg.corruptionPerRound)

    return { seed: cfg.seed, round: 0, zones, pcs, crews, canon: [], corruptSched, reports: [], finished: false }
}

function livePcs(s: SeasonState, crewId: string): PCState[] {
    return [...s.pcs.values()].filter(p => p.crewId === crewId && p.status === 'active')
}

export function attackableZones(s: SeasonState, crewId: string): string[] {
    const crew = s.crews.get(crewId)!
    const reach = new Set<string>()
    for (const zid of crew.zones) {
        for (const adj of zoneById(zid).adjacent) reach.add(adj)
        // Monorail mobility: holding it opens every zone the rail touches
        if (zid === 'monorail') for (const adj of zoneById('monorail').adjacent) reach.add(adj)
    }
    return [...reach].filter(zid => {
        const z = s.zones.get(zid)!
        return !z.corrupted && !z.beyond && z.controlledBy !== crewId && !zoneById(zid).finale
    })
}

/** Default strategy so the engine is playable without the agents layer. */
export function heuristicIntent(s: SeasonState, rng: Rng): RoundIntent {
    const attacks: AttackIntent[] = []
    const resurrections: { crewId: string; pcId: string }[] = []
    for (const crew of s.crews.values()) {
        if (crew.eliminated) continue
        const fighters = livePcs(s, crew.id)
        if (!fighters.length) continue
        const targets = attackableZones(s, crew.id).filter(z => !crew.alliances.includes(s.zones.get(z)!.controlledBy ?? ''))
        if (targets.length) {
            const pc = pick(rng, fighters)
            const stakes: Stakes = rng() < 0.15 ? 'scar' : rng() < 0.08 ? 'death' : 'skirmish'
            attacks.push({ crewId: crew.id, pcId: pc.id, targetZone: pick(rng, targets), stakes })
        }
        const dead = [...s.pcs.values()].filter(p => p.crewId === crew.id && p.status === 'dead')
        if (dead.length && crew.gravesEndCredit >= GRAVES_END_PRICE) {
            resurrections.push({ crewId: crew.id, pcId: dead[0].id })
        }
    }
    return { attacks, allianceProposals: [], resurrections }
}

export function playRound(s: SeasonState, intent: RoundIntent): RoundReport {
    if (s.finished) throw new Error('season is over')
    s.round++
    const rng = makeRng(s.seed + ':r' + s.round)
    const events: CanonEvent[] = []
    const report: RoundReport = { round: s.round, corrupted: [], matches: [], events, scores: {} }

    // 0) day reset: VP + incompetence (a round = a day)
    for (const p of s.pcs.values()) {
        if (p.status !== 'active') continue
        p.vp = 10
        p.hp = Math.min(10, p.hp + rollDie(rng, 4)) // post-combat recovery, book rule
        p.incompetence = rollIncompetence(rng, p.stats)
    }

    // 1) corruption spreads
    for (const [zid, round] of s.corruptSched) {
        if (round === s.round && !s.zones.get(zid)!.corrupted) {
            const z = s.zones.get(zid)!
            z.corrupted = true
            const holder = z.controlledBy
            z.controlledBy = undefined
            report.corrupted.push(zid)
            events.push({ round: s.round, kind: 'zone_corrupted', zoneId: zid })
            if (holder) {
                const crew = s.crews.get(holder)!
                crew.zones = crew.zones.filter(id => id !== zid)
            }
        }
    }

    // 2) alliances (both sides must propose the same pair)
    for (const [a, b] of intent.allianceProposals) {
        const seen = intent.allianceProposals.filter(([x, y]) => (x === b && y === a)).length
        const ca = s.crews.get(a), cb = s.crews.get(b)
        if (seen && ca && cb && !ca.alliances.includes(b)) {
            ca.alliances.push(b); cb.alliances.push(a)
            events.push({ round: s.round, kind: 'alliance', a, b })
        }
    }

    // 3) resurrections (Graves End tab)
    for (const rz of intent.resurrections) {
        const crew = s.crews.get(rz.crewId)!
        const pc = s.pcs.get(rz.pcId)!
        if (crew.gravesEndCredit >= GRAVES_END_PRICE && pc.status === 'dead' && pc.crewId === crew.id) {
            crew.gravesEndCredit -= GRAVES_END_PRICE
            pc.status = 'active'; pc.hp = 10; pc.vp = 10
            events.push({ round: s.round, kind: 'resurrection', pcId: pc.id, byCrew: crew.id, cost: GRAVES_END_PRICE })
        }
    }

    // 4) matches: one per attacked zone; defender = holder's random live PC (or undefended flip)
    const contested = new Map<string, AttackIntent>()
    for (const atk of shuffle(rng, intent.attacks)) {
        const pc = s.pcs.get(atk.pcId)
        if (!pc || pc.status !== 'active') continue
        if (!attackableZones(s, atk.crewId).includes(atk.targetZone)) continue
        if (contested.has(atk.targetZone)) continue // first claim wins the round slot
        contested.set(atk.targetZone, atk)
    }

    for (const [zid, atk] of contested) {
        const z = s.zones.get(zid)!
        const attacker = s.pcs.get(atk.pcId)!
        const holderCrew = z.controlledBy ? s.crews.get(z.controlledBy) : undefined

        // betrayal check: attacking an ally
        if (holderCrew && s.crews.get(atk.crewId)!.alliances.includes(holderCrew.id)) {
            const me = s.crews.get(atk.crewId)!
            me.alliances = me.alliances.filter(x => x !== holderCrew.id)
            holderCrew.alliances = holderCrew.alliances.filter(x => x !== atk.crewId)
            events.push({ round: s.round, kind: 'betrayal', traitor: atk.crewId, victim: holderCrew.id, zoneId: zid })
        }

        const defenders = holderCrew ? livePcs(s, holderCrew.id) : []
        if (!defenders.length) {
            // undefended: zone flips, item pickup
            events.push({ round: s.round, kind: 'zone_flip', zoneId: zid, from: z.controlledBy, to: atk.crewId })
            if (holderCrew) holderCrew.zones = holderCrew.zones.filter(id => id !== zid)
            z.controlledBy = atk.crewId
            s.crews.get(atk.crewId)!.zones.push(zid)
            if (z.itemOnGround) {
                attacker.itemId = z.itemOnGround
                events.push({ round: s.round, kind: 'item_taken', itemId: z.itemOnGround, pcId: attacker.id, zoneId: zid })
                z.itemOnGround = undefined
            }
            continue
        }

        const defender = pick(rng, defenders)
        const result = runMatch(rng, zid, atk.stakes, attacker, defender)
        report.matches.push(result)

        // consequences
        if (result.consequence?.kind === 'death') {
            const dead = s.pcs.get(result.consequence.who)!
            dead.status = 'dead'
            const killer = s.pcs.get(result.consequence.killedBy)!
            killer.kills++
            s.crews.get(killer.crewId)!.gravesEndCredit++
            events.push({ round: s.round, kind: 'death', pcId: dead.id, killedBy: killer.id, zoneId: zid })
        }
        if (result.consequence?.kind === 'scar') {
            s.pcs.get(result.consequence.to)!.scars.push(`r${s.round}:${result.consequence.authoredBy}`)
            events.push({ round: s.round, kind: 'scar', pcId: result.consequence.to, authoredBy: result.consequence.authoredBy, zoneId: zid })
        }
        if (result.consequence?.kind === 'corruption') {
            const flipped = s.pcs.get(result.consequence.who)!
            const from = flipped.crewId
            flipped.crewId = result.consequence.toCrew
            events.push({ round: s.round, kind: 'defection', pcId: flipped.id, fromCrew: from, toCrew: result.consequence.toCrew, zoneId: zid })
        }
        if (result.blaze) {
            events.push({ round: s.round, kind: 'blaze_of_glory', pcId: result.blaze.who, died: result.blaze.died, won: result.blaze.alsoWon, zoneId: zid })
        }
        if (result.itemDropped) {
            const dropper = [attacker, defender].find(p => p.itemId === result.itemDropped)!
            dropper.itemId = undefined
            z.itemOnGround = result.itemDropped
            events.push({ round: s.round, kind: 'item_dropped', itemId: result.itemDropped, zoneId: zid })
        }

        // zone flip on attacker win
        const attackerWon = result.winner === attacker.id
        if (attackerWon) {
            events.push({ round: s.round, kind: 'zone_flip', zoneId: zid, from: z.controlledBy, to: atk.crewId })
            if (holderCrew) holderCrew.zones = holderCrew.zones.filter(id => id !== zid)
            z.controlledBy = atk.crewId
            s.crews.get(atk.crewId)!.zones.push(zid)
            if (result.itemExtraCapture) {
                const extra = zoneById(zid).adjacent.find(a => {
                    const az = s.zones.get(a)!
                    return !az.corrupted && az.controlledBy !== atk.crewId && !zoneById(a).finale
                })
                if (extra) {
                    const ez = s.zones.get(extra)!
                    const prev = ez.controlledBy
                    if (prev) s.crews.get(prev)!.zones = s.crews.get(prev)!.zones.filter(id => id !== extra)
                    ez.controlledBy = atk.crewId
                    s.crews.get(atk.crewId)!.zones.push(extra)
                    events.push({ round: s.round, kind: 'zone_flip', zoneId: extra, from: prev, to: atk.crewId })
                }
            }
            if (z.itemOnGround) {
                attacker.itemId = z.itemOnGround
                events.push({ round: s.round, kind: 'item_taken', itemId: z.itemOnGround, pcId: attacker.id, zoneId: zid })
                z.itemOnGround = undefined
            }
        }
    }

    // 5) elimination + scoring
    for (const crew of s.crews.values()) {
        if (!crew.eliminated && crew.zones.length === 0 && livePcs(s, crew.id).length === 0) crew.eliminated = true
        report.scores[crew.id] = crew.zones.length + [...s.pcs.values()].filter(p => p.crewId === crew.id).reduce((k, p) => k + p.kills, 0)
    }

    s.canon.push(...events)
    s.reports.push(report)
    return report
}

/** The convergence finale at Dodgers Stadium: every surviving crew's best fighter, single elimination. */
export function playConvergence(s: SeasonState): RoundReport {
    s.round++
    const rng = makeRng(s.seed + ':finale')
    const events: CanonEvent[] = []
    const report: RoundReport = { round: s.round, corrupted: [], matches: [], events, scores: {} }

    const contenders = [...s.crews.values()]
        .filter(c => !c.eliminated)
        .map(c => livePcs(s, c.id).sort((a, b) => b.kills - a.kills || Math.max(...Object.values(b.stats)) - Math.max(...Object.values(a.stats)))[0])
        .filter(Boolean)

    let bracket = shuffle(rng, contenders)
    while (bracket.length > 1) {
        const next: PCState[] = []
        for (let i = 0; i + 1 < bracket.length; i += 2) {
            for (const p of [bracket[i], bracket[i + 1]]) { p.hp = 10; p.vp = 10 }
            const result = runMatch(rng, 'ebbets-field', 'death', bracket[i], bracket[i + 1])
            report.matches.push(result)
            if (result.consequence?.kind === 'death') {
                const dead = s.pcs.get(result.consequence.who)!
                dead.status = 'dead'
                s.pcs.get(result.consequence.killedBy)!.kills++
                events.push({ round: s.round, kind: 'death', pcId: dead.id, killedBy: result.consequence.killedBy, zoneId: 'ebbets-field' })
            }
            next.push(s.pcs.get(result.winner)!)
        }
        if (bracket.length % 2 === 1) next.push(bracket[bracket.length - 1])
        bracket = next
    }

    const champion = bracket[0]
    s.finaleWinner = champion.crewId
    s.finished = true
    events.push({ round: s.round, kind: 'convergence', zoneId: 'ebbets-field', winnerCrew: champion.crewId })
    for (const crew of s.crews.values()) {
        report.scores[crew.id] = crew.zones.length + [...s.pcs.values()].filter(p => p.crewId === crew.id).reduce((k, p) => k + p.kills, 0) + (crew.id === champion.crewId ? 8 : 0)
    }
    s.canon.push(...events)
    s.reports.push(report)
    return report
}
