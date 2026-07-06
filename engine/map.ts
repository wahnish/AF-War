// Hyper-Brooklyn — the war map. Every zone is canon (docs/lore/af-concept-bible.md).
// Corruption (the Primordial stirring as the Glome weakens) spreads outward from
// the Gowanus Canal — the storm circle, straight from the lore. Dodgers Stadium
// is sealed until the convergence finale ("if the Dodgers ever win, It wakes").

export interface Zone {
    id: string
    name: string
    blurb: string          // prompt material — terrain personality from the bible
    adjacent: string[]
    corruptRound?: number  // set at season setup by the corruption schedule
    finale?: boolean
}

export const ZONES: Zone[] = [
    { id: 'ellis-island', name: 'Ellis Island APE Station', blurb: 'The Alien Portal Entry Station — customs queues of beings from every dimension, APE Pass checkpoints, landing pads.', adjacent: ['monorail', 'the-heights', 'bazaar'] },
    { id: 'the-heights', name: 'The Heights', blurb: 'Hidden enclave of the elite: luxury high-rises, holo-gardens, cosmic penthouses. Power traded in whispers.', adjacent: ['ellis-island', 'arcades', 'stax'] },
    { id: 'stax', name: 'The Brooklyn Stax', blurb: 'Luxury-industrial towers of repurposed shipping crates above the Gowanus. Residents sport bonus "mutations."', adjacent: ['the-heights', 'gowanus', 'awful-waffle'] },
    { id: 'gowanus', name: 'Gowanus Canal', blurb: 'Black Mayonnaise sludge, mutated wildlife, dark pulsing energies from the depths. The corruption bleeds from here.', adjacent: ['stax', 'nuhart', 'graves-end', 'af-hq'] },
    { id: 'nuhart', name: 'Nuhart Plastics', blurb: 'Abandoned toxic factory; the ground pulses with unnatural energy; hallucinations at the fence line.', adjacent: ['gowanus', 'graves-end', 'hinterlands'] },
    { id: 'graves-end', name: 'Graves End', blurb: 'Final stop for the dead of all dimensions — refurbishment, rehabilitation, resale. Robot reclamation yards, bounty hunters, chemodrugs.', adjacent: ['gowanus', 'nuhart', 'the-nest', 'dodgers'] },
    { id: 'the-nest', name: 'The Nest', blurb: 'Labyrinthine tunnels beneath the city: neon stalls, forbidden tech, favors that come due. The UnderHorde watches.', adjacent: ['graves-end', 'bazaar', 'hellmouth'] },
    { id: 'bazaar', name: 'The Bazaar', blurb: 'A marketplace that shifts its own layout overnight. Relics, potions, future favors as currency.', adjacent: ['ellis-island', 'the-nest', 'wormhole', 'chrono-bowl'] },
    { id: 'wormhole', name: 'The Wormhole Tequila Bar', blurb: 'Multi-dimensional cocktails, GUCKS smuggling passage in the back, everyone meets here eventually.', adjacent: ['bazaar', 'awful-waffle', 'arcades'] },
    { id: 'awful-waffle', name: 'The Awful Waffle', blurb: 'Mediocre waffles served by chain-smoking waitress impersonators; intergalactic celebrities queue for the sarcasm.', adjacent: ['wormhole', 'stax', 'pink-flamingo'] },
    { id: 'arcades', name: 'The Arcades', blurb: 'Retro cabinets and holo-consoles; underground betting on simulations that can trap your essence.', adjacent: ['the-heights', 'wormhole', 'chrono-bowl'] },
    { id: 'chrono-bowl', name: 'Chrono Bowl', blurb: 'Retro bowling for 4th-dimensional beings. Underworld league nights; blasters checked at the shoe counter.', adjacent: ['arcades', 'bazaar', 'dodgers'] },
    { id: 'pink-flamingo', name: 'Pink Flamingo Park', blurb: 'Trailer-park of mystics: potion-brewers, spell-casters, fortunes told for a fee or a future favor.', adjacent: ['awful-waffle', 'coney', 'dodgers'] },
    { id: 'coney', name: 'Coney Island', blurb: 'Faded amusement park; creaky rides, flickering lights, melancholy nostalgia and interdimensional tourists.', adjacent: ['pink-flamingo', 'monorail', 'fringe'] },
    { id: 'fringe', name: 'The Fringe', blurb: 'Where the Glome flickers and the real world shows through. Static-thick air; time warps unpredictably.', adjacent: ['coney', 'monorail', 'hinterlands', 'edb'] },
    { id: 'hinterlands', name: 'The Hinterlands', blurb: 'Half-finished projects and wild growth at the city edge; rogue labs and outlaw compounds. Rules of physics are suggestions.', adjacent: ['fringe', 'nuhart', 'edb', 'monorail'] },
    { id: 'edb', name: 'The Extra Dimensional Borderlands', blurb: 'Realities bleed together; Stormwalkers patrol the breaches; smugglers thread the seams.', adjacent: ['fringe', 'hinterlands', 'hellmouth', 'monorail'] },
    { id: 'hellmouth', name: 'The Hellmouth', blurb: 'A portal to the nether regions; the Hellmouth Commandos hold the line around the clock.', adjacent: ['edb', 'the-nest', 'af-hq'] },
    { id: 'af-hq', name: 'Adult Fantasy HQ', blurb: 'Brownsville walk-up between a 24-hour strip club and a wedding/funeral bodega. Don\'t eat the sushi.', adjacent: ['hellmouth', 'gowanus', 'dodgers'] },
    { id: 'dodgers', name: 'Brooklyn Dodgers Stadium', blurb: 'The Guardians of Defeat play here. If the stadium fills and the Dodgers win, the Primordial wakes. Sealed — for now.', adjacent: ['graves-end', 'chrono-bowl', 'pink-flamingo', 'af-hq'], finale: true },
    { id: 'monorail', name: 'The Monorail', blurb: 'The Eternal Ride: a loop with no stops around the city\'s rim. Holding it means you can be anywhere the rail sees.', adjacent: ['ellis-island', 'coney', 'fringe', 'hinterlands', 'edb'] },
]

export const CORRUPTION_SOURCE = 'gowanus'

export function zoneById(id: string): Zone {
    const z = ZONES.find(z => z.id === id)
    if (!z) throw new Error(`unknown zone ${id}`)
    return z
}

/**
 * Corruption schedule: BFS outward from the Gowanus, seeded shuffle within each
 * distance ring. `perRound[r]` = how many zones fall when round r opens.
 * The finale zone never corrupts (it's where everyone converges).
 */
export function corruptionSchedule(
    order: string[],           // pre-shuffled BFS order (see bfsCorruptionOrder)
    perRound: Record<number, number>
): Map<string, number> {
    const sched = new Map<string, number>()
    let i = 0
    for (const [roundStr, count] of Object.entries(perRound)) {
        const round = Number(roundStr)
        for (let k = 0; k < count && i < order.length; k++, i++) sched.set(order[i], round)
    }
    return sched
}

export function bfsCorruptionOrder(shuffleRing: (ring: string[]) => string[]): string[] {
    const seen = new Set<string>([CORRUPTION_SOURCE])
    const out: string[] = [CORRUPTION_SOURCE]
    let frontier = [CORRUPTION_SOURCE]
    while (frontier.length) {
        const ring: string[] = []
        for (const id of frontier) {
            for (const adj of zoneById(id).adjacent) {
                if (seen.has(adj)) continue
                const z = zoneById(adj)
                if (z.finale) continue // the stadium never falls before the finale
                seen.add(adj)
                ring.push(adj)
            }
        }
        const shuffled = shuffleRing(ring)
        out.push(...shuffled)
        frontier = shuffled
    }
    return out
}
