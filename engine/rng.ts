// Seeded RNG (mulberry32) — every sim run is reproducible from a seed string.
export type Rng = () => number

export function makeRng(seed: string): Rng {
    let h = 1779033703 ^ seed.length
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
        h = (h << 13) | (h >>> 19)
    }
    let a = h >>> 0
    return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** Integer in [1, sides] */
export function rollDie(rng: Rng, sides: number): number {
    return 1 + Math.floor(rng() * sides)
}

/** Pick one element */
export function pick<T>(rng: Rng, arr: T[]): T {
    return arr[Math.floor(rng() * arr.length)]
}

/** Fisher-Yates shuffle (returns new array) */
export function shuffle<T>(rng: Rng, arr: T[]): T[] {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}
