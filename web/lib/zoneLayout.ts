// Hand-placed SVG coordinates for the war map. Deliberately NOT derived from
// zone ids programmatically (ids are being reworked in parallel this session) —
// this is a presentation-layer lookup keyed by id, with a graceful fallback
// (radial scatter) for any zone id it doesn't recognize yet.
export const ZONE_COORDS: Record<string, { x: number; y: number }> = {
    "ellis-island": { x: 120, y: 90 },
    "the-heights": { x: 320, y: 70 },
    stax: { x: 520, y: 130 },
    gowanus: { x: 560, y: 300 },
    nuhart: { x: 620, y: 430 },
    "graves-end": { x: 560, y: 560 },
    "the-nest": { x: 380, y: 520 },
    bazaar: { x: 220, y: 440 },
    wormhole: { x: 340, y: 260 },
    "awful-waffle": { x: 480, y: 200 },
    arcades: { x: 200, y: 200 },
    "chrono-bowl": { x: 120, y: 330 },
    "pink-flamingo": { x: 220, y: 640 },
    coney: { x: 100, y: 700 },
    fringe: { x: 260, y: 760 },
    hinterlands: { x: 440, y: 720 },
    edb: { x: 560, y: 700 },
    hellmouth: { x: 480, y: 590 },
    "af-hq": { x: 640, y: 500 },
    dodgers: { x: 380, y: 640 },
    monorail: { x: 200, y: 600 },
};

export function coordFor(id: string, index: number, total: number): { x: number; y: number } {
    if (ZONE_COORDS[id]) return ZONE_COORDS[id];
    // fallback: scatter unknown zones on a ring so the map still renders
    // if engine zone ids move out from under this lookup.
    const angle = (index / Math.max(1, total)) * Math.PI * 2;
    return { x: 380 + 260 * Math.cos(angle), y: 400 + 260 * Math.sin(angle) };
}
