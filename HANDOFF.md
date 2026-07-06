# AF WAR — HANDOFF
*Build log, chronological, 2026-07-05 → 2026-07-06. Written for a fresh session with
zero context. If you're picking this up cold: read `README.md` first, then this,
then `ORIENTATION-PROMPT.md` for how Todd works.*

---

## WHAT THIS IS

AF WAR: a seasonal, agent-run Original Character war for Hyper-Brooklyn. Every PC is
an AI agent directed by its human creator. Battles resolve on real seeded dice. The
winning telling becomes permanent world canon. Every match ships as an auto-generated
comic. Full design is `docs/spec-af-war-v1.md`; long-game direction is
`docs/north-star.md`; every rules ambiguity resolved along the way is logged in
`docs/rulings.md` (R1–R16).

---

## THE BUILD, IN ORDER

**Cold start (7/5 morning).** Todd walked in with three of his own IPs and no fixed
plan: **War For Rayuba** (W4R — an OCT/map-war format he'd run before, archived
post-mortem included the line "volunteer basis is waaay too much work"), the
**Adult Fantasy TTRPG** (rules + Hyper-Brooklyn setting + a 25-character deck), and
**Shadow Syndicate** (a TCG, earmarked as the Season 2 strategy layer — explicitly
NOT consumed by this build, stays its own game). The three-IP stack: W4R contributes
format (seasonal war, dueling narratives, the Ledger), AF contributes rules + IP
(step-dice resolution, the setting, the cast), SS is a roadmap item only.

**Spec locked (7/5, through the day).** `docs/spec-af-war-v1.md` went through three
decision rounds with Todd same-day: round 1 nailed the product shape (standalone
Supabase app, agents-play/humans-direct, artifact-ladder media scaling); round 2
picked crews-not-factions (2–6 PC crews, free-for-all, the Glome as a shrinking storm
circle borrowed straight from AF's Primordial lore) over the original two-faction
plan; round 3 locked comics-as-the-v1-wow (auto-comic generation, Yachimat pattern —
beat sheet → grammar JSON → bulk page gen → self-check regen loop) and closed with
§10b (the six product loops, ranked) and §10c (economics: sell agency, never dice).

**Engine (7/5).** `engine/` — pure TS, zero I/O, seeded/deterministic. Ships with
dice (step-dice + exploding + crit-fail + Failing Successfully + Blaze of Glory),
map/zone/adjacency logic, crew + turf + alliance/betrayal ledger, the Glome shrink
schedule, round state machine, match allocation, best-of-3 exchange resolution,
stakes (scar/death/corruption), items, the Blood Bank (Graves End), and scoring.
23 vitest tests green (`npm test` from repo root; `dice.test.ts` + `season.test.ts`).
Every ambiguity resolved along the way got a numbered ruling — R1 through R16, in
`docs/rulings.md`. Highlights: R16 (7/5 night) replaced an abstract map with **real
Brooklyn neighborhoods** (Williamsburg, Bushwick, Gravesend→Graves End, Brownsville→AF
HQ, etc.) and made **the Glome breathe** — the active/playable map radius scales with
player count (`max(8, 6+ceil(players×1.2))`), corruption BFS stays inside it, finale
is phantom Ebbets Field.

**Agents (7/5).** `agents/` — PC personas built from lore (never invented: agents
draw from `docs/lore/af-concept-bible.md` + `af-character-bible.md`, both exported
from the FlowZilla DB), a model-agnostic LLM client (`agents/llm.ts`, OpenRouter),
narration (`agents/narrate.ts`) and a GM/judge layer. The load-bearing design rule:
**narration = beat-sheet ground truth.** The engine emits a structured beat sheet
(initiative, exchange results, crits, Failing Successfully triggers, VP spends, item
procs); narration agents must honor every beat and may only invent connective tissue.
**The Arbiter (judge) scores ENTERTAINMENT ONLY** — voice, opponent portrayal, terrain
use, beat fidelity — never outcomes. Dice decided who won; The Arbiter decides who's
remembered well. Tone contract, stated once and enforced in every prompt: characters
are a bit ridiculous, the message is/can be serious — Venture-Brothers surface,
Black Mirror/1984 available underneath, never wink, never explain the joke.

**Sim Season 0 (7/5–7/6).** `sim/run.ts` ran a full mini-season — 5 crews, real PCs,
multiple rounds through a convergence finale — with resumable narration (cache +
graceful degradation, added after an early run crashed mid-season and lost paid LLM
calls). Output landed in `sim/out/` (gitignored): `feed.md`, per-round SVG maps,
`ledger.md`, per-match rooms with dice transcripts + dueling narratives, `canon.json`,
`recaps.json`, `rooms.json` — and a complete **2-page auto-generated comic, "The
Waffle Incident"** (SIM vs. Cobalt Fox @ The Awful Waffle), rendered via the
Yachimat-pattern pipeline: comic-grammar JSON → NB2 page gen off character model
sheets (`sim/out/comic/sheet-sim.png`, `sheet-cobalt-fox.png` as ref images) → a
vision-QA self-check loop that compares page vs. grammar and regenerates misses once.
This bundle is the probe Todd reads to judge whether the whole design works.

**Web app (7/6).** `web/` — Next.js 16 + Supabase, agent-built, live-verified boot.
Surfaces shipped: Feed, Map, Match rooms, Barracks, Ledger, Guide, Arcade, Admin, GM
console, login/auth. **Scar: Next 16 renamed `middleware.ts` → `proxy.ts`.** On
Vercel, the old `middleware.ts` convention deploys to the Edge runtime, where a
`next/server` CJS dependency crashes on `__dirname` → site-wide 500. `web/proxy.ts`
runs on the Node runtime instead (pattern copied from
`~/Documents/FlowZilla/flowzilla/proxy.ts` — this exact scar was already paid for
once on FlowZilla). Supabase project: `xnwemuvjlajmvhgtnwrw`. Schema
(`db/schema.sql`) covers profiles, crews, characters, seasons, matches, posts (the
Feed), canon_events (append-only continuity graph), directions (director → PC
influence: gambit/tone_note/vp_budget/ability_lane), and a public `sheets` storage
bucket for model sheets. RLS on everywhere; game-state writes are service-role only
(the GM engine's seam, `web/app/api/gm/*`).

**Deployed.** Live at **https://af-war.vercel.app**. GitHub: `wahnish/AF-War`
(`git@github.com:wahnish/AF-War` / `https://github.com/wahnish/AF-War.git`).
Two more deploy scars worth knowing: **framework preset** had to be set explicitly
(Vercel didn't reliably auto-detect the Next app living under `web/`, not repo root)
and **Vercel SSO/deployment-protection had to be turned off** for the live URL to be
publicly reachable without a Vercel login wall — both are one-time project-settings
fixes, not code. **Deploys are CLI-driven from the web dir: `cd web && vercel --prod`**
— not a git-push-triggered pipeline (deliberate, keeps deploys explicit).

**Loops 1–3 (7/6).** The GM cascade wired end-to-end: resolve → narrate → judge →
Clout → feed + Gazette post, all off one call (`web/app/api/gm/resolve`). Downtime
posts (`agents/downtime.ts`) — PCs post between rounds, replies included, the Truman
Show hook (north-star §Tier-2/§10b point 1: "my guy did WHAT last night?"). A
Directions UI so each director can submit a gambit/tone-note/VP-budget/ability-lane
before their PC's next match — directing IS the gameplay (north-star, spec §10b
point 2). Clout: Arbiter entertainment scores accrue to a public reputation stat
(two ladders: warlord and star). `/gm` console + start-season flow.

**Sweetening round (7/6).** `db/schema-002.sql` (additive-only, idempotent — every
statement uses `IF NOT EXISTS`/`ON CONFLICT DO NOTHING`/`ADD COLUMN IF NOT EXISTS`).
Shipped: **Canon Cast admin** — an editable NPC/judge roster (`afwar_canon_cast`)
carrying dated `canon_notes` ("Raze never apologizes; he issues corrections") injected
into every prompt that voices that character — a lore-consistency memory layer, and
the prototype of a CrabSpace-style persistent identity system. **BYO OpenRouter
keys** — `afwar_profiles.openrouter_key` + `model_tier` + `model_name`, so a player's
agent can run on their own key at their own dime (Todd's marginal cost ≈ 0). **Comic
auto-render wired into the cascade.** **Arcade betting** (`afwar_bets`, $BAMF stakes
on match outcomes). **`/gm` + `/admin` role-gating** off a new `afwar_profiles.role`
column (default `'player'`; Todd promotes himself to `'gm'` via one UPDATE — see
Pending Steps). **Agent war councils** — strategic intents that surface as feed
drama. **Season anthology compiler.** **Lore factions** (`afwar_characters.faction`
/ `afwar_canon_cast.faction`; app-layer enum, not a DB constraint, kept forgiving:
OG/Horde/Swarm/Soup/Primordial/GUCKS/unaffiliated).

**Economy + cron round (7/6).** `db/schema-003.sql` (additive, same idempotent
pattern). Shipped: **`afwar_bamf_ledger`** — every $BAMF mutation recorded
(`delta`, `reason`, `ref_id`); `afwar_profiles.bamf` is the cached running balance,
`web/lib/bamf.ts` the only writer. Faucet + tips wired
(`web/app/api/bamf/faucet`, `web/app/api/bamf/tip`; `tip_count`/`tip_total` columns
on `afwar_posts`). **Clout → royalty table** in the anthology compiler (spec §10c's
thesis made concrete: entertainment score literally becomes a royalty share).
**CRON GM** — `web/vercel.json` schedules `/api/gm/tick` daily at 15:00 UTC; the
game now runs itself (north-star Tier-2 point 1 — Todd becomes showrunner, not
operator). Season config carries `lastTick`/`cadenceHours` as plain jsonb keys on
the existing `afwar_seasons.config` column (no new DDL). **Season loot forge**
(`afwar_items` — display/lore layer over engine item drops; "earned, never sold" per
the never-sell law). **FlowZilla 8-panel turnaround prompt ported** — one model-sheet
generation prompt for every character, visual fairness by construction (nobody's
character gets a better art pipeline than anyone else's).

---

## KNOWN GAPS / SEAMS

- **`openrouter_key` RLS gap.** `afwar_profiles`'s existing "select all" policy
  exposes every column to every authenticated user, including `openrouter_key`. The
  fully-correct fix is a security-definer view that redacts the key for everyone but
  its owner; that migration was deliberately deferred as bigger than the sweetening
  round warranted. Current mitigation: the web app never selects
  `openrouter_key` in any shared/list query — only the owner's own settings fetch
  (`.eq('id', user.id)`) touches that column. Documented gap, not a silent one. Close
  this before onboarding real (non-Todd) users.
- **engine-items / `afwar_items` dual track.** The engine's mechanical item source of
  truth (`engine/match.ts` `ITEMS`, e.g. zones\[zid\].itemOnGround) and the display/lore
  layer (`afwar_items`, schema-003) are separate records that happen to reference the
  same `effect_template`/zone in the common case — they are not unified. Fine for now;
  unify post-v1 if players find the two tracks confusing (e.g. an item shows on the
  map from one system but its lore card comes from the other).
- **Anthology is markdown-only.** The season anthology compiler produces `.md`; no
  PDF/print step yet. North-star Tier 3 flags the FlowZilla pdf-lib pattern as the
  next step when this needs to be a sellable artifact.
- **`gm-client` eslint.** Known lint noise in `web/app/gm/gm-client.tsx`; not blocking
  builds, not yet cleaned up.
- **XP is deliberately not built.** This is a design choice, not an oversight:
  milestone-levels (archetype level from the AF handbook, R3's power-level mapping)
  is the sanctioned progression design. Don't add an XP bar without a real design
  conversation first — it's not a gap, it's a fence.

---

## TODD'S PENDING STEPS

1. **Paste `db/schema-003.sql`** into the Supabase SQL editor (project
   `xnwemuvjlajmvhgtnwrw`) if not already applied — it's additive/idempotent, safe
   to re-run.
2. **Confirm the gm-role UPDATE ran.** `db/schema-002.sql` added
   `afwar_profiles.role` (default `'player'`) but the promotion is a manual step:
   ```sql
   UPDATE afwar_profiles SET role = 'gm' WHERE id = '<your auth.users id>';
   -- find it via: SELECT id, handle FROM afwar_profiles;
   -- or: SELECT id FROM auth.users WHERE email = 'you@example.com';
   ```
   Without this, `/gm` and `/admin` role-gating locks Todd out of his own console.
3. **Playtest checklist** (the actual probe spec §8 asks for, now runnable live
   instead of just via `sim/`):
   - Is the strategy layer generating real decisions or noise, in a live round?
   - Do dice-constrained dueling narratives feel like W4R matches?
   - Does Failing Successfully produce the comedy it promises?
   - Is best-of-3 the right variance shape?
   - Would a spectator actually follow this feed — and can they, without hitting a
     login wall (see `docs/growth-spec.md` §2d — this is a real, currently-open gap)?
   - Does the auto-comic wow on a live match, not just in the `sim/out/` bundle?
