// SeasonState uses Map<> fields (zones, pcs, crews, corruptSched) which don't
// round-trip through JSON/JSONB directly. These helpers convert to/from a
// plain-object shape for afwar_seasons.state storage. The engine itself stays
// untouched (zero I/O, as designed) — this lives in the web layer only.
//
// Deliberately NOT inside lib/engine/ — that directory is regenerated from
// ../engine/ by scripts/sync-engine.mjs on every predev/prebuild and would
// wipe this file.
import type { SeasonState } from "./engine/season";

export type SerializedSeasonState = Omit<
    SeasonState,
    "zones" | "pcs" | "crews" | "corruptSched"
> & {
    zones: Record<string, SeasonState["zones"] extends Map<string, infer V> ? V : never>;
    pcs: Record<string, SeasonState["pcs"] extends Map<string, infer V> ? V : never>;
    crews: Record<string, SeasonState["crews"] extends Map<string, infer V> ? V : never>;
    corruptSched: Record<string, number>;
};

export function serializeSeasonState(s: SeasonState): SerializedSeasonState {
    return {
        ...s,
        zones: Object.fromEntries(s.zones),
        pcs: Object.fromEntries(s.pcs),
        crews: Object.fromEntries(s.crews),
        corruptSched: Object.fromEntries(s.corruptSched),
    };
}

export function deserializeSeasonState(raw: SerializedSeasonState): SeasonState {
    return {
        ...raw,
        zones: new Map(Object.entries(raw.zones)),
        pcs: new Map(Object.entries(raw.pcs)),
        crews: new Map(Object.entries(raw.crews)),
        corruptSched: new Map(Object.entries(raw.corruptSched)),
    } as SeasonState;
}
