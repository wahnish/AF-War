# AF WAR — web

The playable web app for AF WAR (Season 1: The Glome Weakens). Next.js 16 (App
Router, TypeScript), Supabase for auth + data.

## Setup

1. `npm install`
2. Copy `.env.local` (already present) — confirm `NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` match the AF WAR Supabase project.
3. **Paste `../db/schema.sql` into the Supabase SQL editor** (repo root, not
   `web/`) — creates all `afwar_*` tables + RLS policies + the `sheets`
   storage bucket. Optionally also paste `db/seed-posts.sql` (in this folder)
   for 3 sample feed posts so the Feed isn't empty pre-season.
4. `npm run dev` — runs on port 3000 by default.
5. `npm run build && npx tsc --noEmit` before shipping — both must be clean.

## Auth gate: proxy.ts, not middleware.ts

Next 16 renamed `middleware.ts` → `proxy.ts` (runs on the Node runtime by
default). The old `middleware.ts` convention still works locally but deploys
to the **Edge runtime on Vercel**, where a `next/server` CJS dependency
crashes on `__dirname` and 500s every route. `proxy.ts` at the project root is
the fix — same `@supabase/ssr` session-refresh + redirect-to-`/login` pattern
as `~/Documents/FlowZilla/flowzilla/proxy.ts`.

## The engine copy (`lib/engine/`)

The AF WAR rules engine (`../engine/*.ts` — pure TS, zero I/O, seeded RNG) is
the single source of truth for game logic. This app does **not** import it
via a relative path out of the Next project root, because:

- Next's build (webpack and Turbopack) roots its module graph and output
  file tracing at the project directory. A relative import like
  `../../engine/season.ts` resolves fine in `next dev`, but isn't guaranteed
  to survive `next build`'s file tracing into a deployable bundle (files
  outside the project root aren't automatically included).
- Vercel deployments only upload the `web/` directory in a typical setup —
  there is no `../engine` on the server unless it's copied in at build time.

Instead, `scripts/sync-engine.mjs` copies `rng.ts`, `dice.ts`, `map.ts`,
`match.ts`, `season.ts` into `web/lib/engine/` on every `predev`/`prebuild`
(wired in `package.json`). It also rewrites `from './x.js'` import
specifiers to `from './x'` so the copies resolve under Next's TS module
resolution (the source engine uses `.js` extensions for native Node ESM).

**Never hand-edit files in `web/lib/engine/`** — they're regenerated from
`../engine/` on every dev/build and your changes will be silently
overwritten. Edit the engine at its source (`AFWar/engine/`) instead.

`web/lib/serialize.ts` is web-only: it converts `SeasonState`'s `Map<>` fields
to/from plain objects for JSONB storage in `afwar_seasons.state`. It lives
next to (not inside) `lib/engine/` deliberately — `lib/engine/` is wiped and
regenerated on every dev/build, so anything meant to survive belongs outside
it. This also keeps the engine's "zero I/O, no serialization concerns"
design intact.

## API routes

- `POST /api/generate-sheet` — generates a character model sheet via
  `fal-ai/nano-banana-2`. Requires `FAL_KEY` in `.env.local` (already
  populated from the AFWar fallback chain); 501s otherwise.
- `POST /api/gm/resolve` — the GM trigger seam. Loads the current season,
  runs one engine round via `heuristicIntent` + `playRound`, persists
  matches/canon events/a recap post, and saves the updated state. Requires
  `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (commented out by default —
  paste it from the Supabase dashboard's Settings → API to enable); 501s
  otherwise. Narration/judging/Gazette generation is **not** wired into this
  route yet — it only advances engine state. That LLM cascade is the next
  seam (see `../agents/` for the prompts to call from here).
- `GET /api/season/current` — returns the most recently created
  `afwar_seasons` row (state included) for the Map/Ledger pages.

## Constraints honored

- Dependencies: `next`, `react`, `@supabase/supabase-js`, `@supabase/ssr`,
  `@fal-ai/client` only.
- Zone ids are never hardcoded in game logic — the Map page reads zones from
  `ZONES` (via the synced engine copy) and season state, with a presentation-
  only coordinate lookup (`lib/zoneLayout.ts`) that falls back to a ring
  layout for any zone id it doesn't recognize.
