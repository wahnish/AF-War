// Hyper-Brooklyn — the war map. REWORKED 2026-07-05 (Todd-approved, spec §10b):
// zones are REAL Brooklyn neighborhoods (Hyper-Brooklyn is a phantom-zone
// Brooklyn); the canon landmarks from the concept bible live INSIDE them as
// POIs and carry the zone's terrain personality. Corruption still bleeds from
// the Gowanus. The finale is phantom EBBETS FIELD (the Dodgers' real home —
// "if the Dodgers ever win, It wakes"). THE GLOME BREATHES: the active map
// radius scales with player count (see glomeZones / setupSeason).

export interface Zone {
    id: string
    name: string
    poi?: string           // the canon landmark inside this neighborhood
    blurb: string          // prompt material — terrain personality
    adjacent: string[]
    corruptRound?: number
    finale?: boolean
}

export const ZONES: Zone[] = [
    { id: 'greenpoint', name: 'Greenpoint', poi: 'Nuhart Plastics', blurb: 'Waterfront lots and the Nuhart Plastics superfund husk — the ground pulses, the fence line gives you visions.', adjacent: ['williamsburg', 'east-williamsburg', 'monorail'] },
    { id: 'williamsburg', name: 'Williamsburg', poi: 'The Wormhole Tequila Bar', blurb: 'Multi-dimensional cocktails behind a converted loft facade; the GUCKS smuggling passage runs out the back. Everyone meets here eventually.', adjacent: ['greenpoint', 'east-williamsburg', 'bed-stuy', 'downtown-dumbo'] },
    { id: 'east-williamsburg', name: 'East Williamsburg', poi: 'The Extra Dimensional Borderlands', blurb: 'Industrial blocks where realities bleed through the zoning; Stormwalkers patrol the breaches between warehouses.', adjacent: ['greenpoint', 'williamsburg', 'bushwick'] },
    { id: 'bushwick', name: 'Bushwick', poi: 'The Hellmouth', blurb: 'A portal to the nether regions behind a mural-covered loading dock; the Commandos hold the line around the clock.', adjacent: ['east-williamsburg', 'bed-stuy', 'brownsville', 'monorail'] },
    { id: 'bed-stuy', name: 'Bed-Stuy', poi: 'The Bazaar', blurb: 'A marketplace that re-shuffles its own street grid overnight. Relics, potions, future favors as currency.', adjacent: ['williamsburg', 'bushwick', 'crown-heights', 'downtown-dumbo'] },
    { id: 'downtown-dumbo', name: 'DUMBO & Downtown', poi: 'The A.P.E. Ferry Terminal', blurb: 'Where beings clear customs under the bridge anchorage — APE Pass checkpoints, landing pads, gift shops.', adjacent: ['williamsburg', 'bed-stuy', 'gowanus', 'monorail'] },
    { id: 'crown-heights', name: 'Crown Heights', poi: 'The Arcades', blurb: 'Retro cabinets and holo-consoles down Franklin Ave; underground betting on simulations that can trap your essence.', adjacent: ['bed-stuy', 'flatbush', 'brownsville', 'ebbets-field'] },
    { id: 'brownsville', name: 'Brownsville', poi: 'Adult Fantasy HQ', blurb: "A scrappy walk-up between a 24-hour strip club and a wedding/funeral bodega. Don't eat the sushi.", adjacent: ['bushwick', 'crown-heights', 'east-flatbush', 'canarsie'] },
    { id: 'canarsie', name: 'Canarsie', poi: 'The Fringe', blurb: 'Where the Glome flickers over the marsh flats and the real world shows through. Static-thick air; time warps.', adjacent: ['brownsville', 'east-flatbush', 'monorail'] },
    { id: 'flatbush', name: 'Flatbush', poi: 'Chrono Bowl', blurb: 'Retro bowling for 4th-dimensional beings on Flatbush Ave. League nights settle underworld grudges; blasters checked at the shoe counter.', adjacent: ['crown-heights', 'east-flatbush', 'ebbets-field', 'sheepshead-bay'] },
    { id: 'east-flatbush', name: 'East Flatbush', poi: 'The Hinterlands', blurb: 'Half-finished projects and wild growth; rogue labs and outlaw compounds where the rules of physics are suggestions.', adjacent: ['brownsville', 'flatbush', 'canarsie'] },
    { id: 'park-slope', name: 'Park Slope', poi: 'The Heights', blurb: 'The elite enclave: brownstones hiding holo-gardens and cosmic penthouses. Power traded in whispers over strollers.', adjacent: ['gowanus', 'sunset-park', 'ebbets-field'] },
    { id: 'gowanus', name: 'Gowanus', poi: 'The Canal & The Brooklyn Stax', blurb: 'Black Mayonnaise sludge, dark pulsing energies, and luxury crate-towers above the superfund. The corruption bleeds from here.', adjacent: ['downtown-dumbo', 'park-slope', 'red-hook', 'sunset-park'] },
    { id: 'red-hook', name: 'Red Hook', poi: 'The Hedderack Wreck', blurb: 'Container docks hiding the crashed ship whose weaponry nobody fully deciphered. Salvage crews go missing politely.', adjacent: ['gowanus', 'sunset-park', 'monorail'] },
    { id: 'sunset-park', name: 'Sunset Park', poi: 'The Nest (entrance)', blurb: 'Industry City fronts for the tunnel mouth: neon stalls below, forbidden tech, favors that come due. The UnderHorde watches.', adjacent: ['park-slope', 'gowanus', 'red-hook', 'bay-ridge', 'bensonhurst'] },
    { id: 'bay-ridge', name: 'Bay Ridge', poi: 'The Verrazzano Anchor', blurb: 'Where the Glome meets the Narrows; the bridge cables hum with containment field harmonics. Old-timers fish for things that fish back.', adjacent: ['sunset-park', 'bensonhurst', 'monorail'] },
    { id: 'bensonhurst', name: 'Bensonhurst', poi: 'Pink Flamingo Park', blurb: 'The trailer-park of mystics under the elevated: potion-brewers, spell-casters, fortunes for a fee or a future favor.', adjacent: ['bay-ridge', 'sunset-park', 'gravesend'] },
    { id: 'gravesend', name: 'Gravesend', poi: 'Graves End', blurb: 'Final stop for the dead of all dimensions — refurbishment, rehabilitation, resale. Robot reclamation yards, bounty hunters, chemodrugs.', adjacent: ['bensonhurst', 'coney-island', 'sheepshead-bay'] },
    { id: 'coney-island', name: 'Coney Island', poi: 'The Boardwalk', blurb: 'Faded amusement park melancholy: creaky rides, flickering lights, interdimensional tourists photographing the Wonder Wheel like a relic.', adjacent: ['gravesend', 'brighton-beach', 'monorail'] },
    { id: 'brighton-beach', name: 'Brighton Beach', poi: 'The Awful Waffle', blurb: 'Mediocre waffles served by chain-smoking waitress impersonators; intergalactic celebrities queue for the sarcasm.', adjacent: ['coney-island', 'sheepshead-bay'] },
    { id: 'sheepshead-bay', name: 'Sheepshead Bay', poi: 'The Charter Docks', blurb: 'Party boats that come back with fewer passengers and better stories. Golden Wing repairs the family shrimp boat here on weekends.', adjacent: ['brighton-beach', 'gravesend', 'flatbush', 'monorail'] },
    { id: 'ebbets-field', name: 'Ebbets Field (Phantom)', poi: 'Brooklyn Dodgers Stadium', blurb: 'The Guardians of Defeat play here, in the stadium that never left. If the stands ever fill and the Dodgers win, the Primordial wakes. Sealed — for now.', adjacent: ['crown-heights', 'flatbush', 'park-slope'], finale: true },
    { id: 'monorail', name: 'The Monorail', poi: 'The Eternal Ride', blurb: 'A loop with no stops around the borough rim. Holding it means you can be anywhere the rail sees.', adjacent: ['greenpoint', 'bushwick', 'canarsie', 'downtown-dumbo', 'red-hook', 'bay-ridge', 'coney-island', 'sheepshead-bay'] },
]

export const CORRUPTION_SOURCE = 'gowanus'

export function zoneById(id: string): Zone {
    const z = ZONES.find(z => z.id === id)
    if (!z) throw new Error(`unknown zone ${id}`)
    return z
}

/**
 * THE GLOME BREATHES (spec §10b): the active map is a contiguous region sized
 * by player count — few players = a tight knife-fight, more = the Glome
 * dilates. Grown by BFS from the finale zone (the war always orbits the
 * stadium). Gowanus (the corruption source) and the finale are always inside.
 * Returns the ACTIVE zone id set; zones outside are "beyond the Glome".
 */
export function glomeZones(playerCount: number, shuffleRing: (ring: string[]) => string[]): Set<string> {
    const target = Math.max(8, Math.min(ZONES.length, 6 + Math.ceil(playerCount * 1.2)))
    const active = new Set<string>(['ebbets-field', CORRUPTION_SOURCE])
    let frontier = ['ebbets-field', CORRUPTION_SOURCE]
    while (active.size < target && frontier.length) {
        const ring: string[] = []
        for (const id of frontier) for (const adj of zoneById(id).adjacent) {
            if (!active.has(adj) && !ring.includes(adj)) ring.push(adj)
        }
        if (!ring.length) break
        for (const id of shuffleRing(ring)) {
            if (active.size >= target) break
            active.add(id)
        }
        frontier = ring.filter(id => active.has(id))
    }
    return active
}

/**
 * Corruption schedule: BFS outward from the Gowanus, seeded shuffle within each
 * distance ring, restricted to the active Glome. `perRound[r]` = zones that
 * fall when round r opens. The finale zone never corrupts.
 */
export function corruptionSchedule(
    order: string[],
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

export function bfsCorruptionOrder(shuffleRing: (ring: string[]) => string[], activeZones?: Set<string>): string[] {
    const inGlome = (id: string) => !activeZones || activeZones.has(id)
    const seen = new Set<string>([CORRUPTION_SOURCE])
    const out: string[] = [CORRUPTION_SOURCE]
    let frontier = [CORRUPTION_SOURCE]
    while (frontier.length) {
        const ring: string[] = []
        for (const id of frontier) {
            for (const adj of zoneById(id).adjacent) {
                if (seen.has(adj)) continue
                const z = zoneById(adj)
                if (z.finale || !inGlome(adj)) continue
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
