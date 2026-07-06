# AF WAR — Cold-Session Orientation Prompt
*Paste everything below the rule into a fresh session.*

---

## WHO YOU'RE WORKING WITH

Todd — solo founder, 30-year broadcast veteran, now an AI filmmaker. He's the sole
founder of FlowZilla/GridZilla Studio (his other, larger project: an AI video/comics
production app, at `~/Documents/FlowZilla/flowzilla`; that repo has its own cold-start
prompt at `~/Documents/FlowZilla/flowzilla/ORIENTATION-PROMPT.md` — don't confuse the
two repos or the two orientation prompts). AF WAR is Todd's second build, born the
same week, running in parallel.

How he works, plainly:
- **Direct. Wants pushback.** Don't just agree and execute — if something in a spec
  or a request looks wrong, say so before building it.
- **"Done > perfect."** Ship the thing that proves the idea; polish later, and only
  if the idea survives contact with reality.
- **Discuss before build.** "Let's discuss" means plan and stop for the go — approving
  something mid-discussion is not a starting gun to build the whole thing. Confirm
  scope before writing code on anything non-trivial.
- **Label recommended options.** When you present Todd a choice (AskUserQuestion or
  otherwise), say which option you'd pick and why. Don't hand him an unranked menu.

---

## WHAT AF WAR IS

A seasonal, agent-run Original Character war for Hyper-Brooklyn. Every playable
character is an AI agent, directed (not puppeted) by its human creator. Battles
resolve on real, seeded, deterministic dice — nobody, not even a judge or the GM
agent, can override an outcome. The winning side's telling of each battle becomes
permanent world canon; the losing telling stays visible as non-canon "apocrypha."
Every match ships as an auto-generated comic, rendered off each character's model
sheet. It's a continuity graph that writes itself — and per the North Star, the
long-game bet is that this is not a game with a story, it's a television studio whose
writers' room is a game.

---

## THE THREE-IP STACK

AF WAR was assembled 2026-07-05 from three of Todd's existing IPs, each contributing
a different layer:

| Layer | Source | Contributes |
|---|---|---|
| Format | **War For Rayuba** (W4R) | Seasonal map war, dueling narratives, the Ledger, consequence matches, spectator arenas |
| Rules + setting | **Adult Fantasy** (AF TTRPG) | Step-dice resolution, VP economy, Failing Successfully, Hyper-Brooklyn setting, the 25-character deck |
| Roadmap only | **Shadow Syndicate** (TCG) | Earmarked as the Season 2+ strategy layer. NOT built yet, NOT consumed by AF WAR — it stays its own standalone game candidate. Don't build SS mechanics into v1. |

---

## CURRENT STATE

- **Live:** https://af-war.vercel.app
- **GitHub:** `wahnish/AF-War`
- **Deployed:** Next.js 16 + Supabase web app (`web/`) — Feed, Map, Match rooms,
  Barracks, Ledger, Guide, Arcade (betting), Admin, GM console, auth/login. Supabase
  project `xnwemuvjlajmvhgtnwrw`. Schema is three additive files:
  `db/schema.sql` (core) → `db/schema-002.sql` (sweetening: Canon Cast, BYO keys,
  role-gating, betting, war councils, anthology, factions) →
  `db/schema-003.sql` (economy: $BAMF ledger, tips, loot, cron config).
- **Cron autonomy:** `web/vercel.json` schedules `/api/gm/tick` daily at 15:00 UTC —
  the game runs itself; Todd is showrunner, not operator.
- **Engine + sim:** `engine/` is pure TS, seeded/deterministic, 23 vitest tests green.
  `sim/out/` (gitignored) holds a full simulated Season 0 including a rendered
  2-page auto-comic, "The Waffle Incident" — read `HANDOFF.md` for the full
  chronological build log before touching anything.

---

## THE NORTH STAR

**Read `docs/north-star.md` FIRST**, before any other doc, if the session's task is
strategic/directional rather than a specific bug or feature. It is short and it is
the actual thesis: **Broadcast → trailer proof by Todd → canon-to-FlowZilla-Universe-
graph mapping → an EISNER agent running on Buddy (FlowZilla's agent runtime).**

In brief: AF WAR already produces, every round, the exact inputs a TV production
pipeline needs (structured scripts, comic-grammar storyboards, cast with model
sheets, canon continuity, an audience that co-wrote it). FlowZilla already turns
those inputs into video. The bridge between the two products is a **mapping, not a
build** — AF WAR's `canon_events` slot directly into FlowZilla's existing Universe
continuity graph (arc lanes, story-time, Chekhov board, canon-to-gen conditioning) —
zero new generation code required. The showrunner agent for this pipeline is named
**Eisner** — a Buddy persona with producer verbs (reads canon → writes beats →
materializes storyboard/comicref → renders video → composes assembly), staged with
human approval first, autonomy dial later.

The concrete first step the North Star names: take the season's top-Clout canon
telling, run its comic pages through FlowZilla's comic-to-video-reference lane
(`?comicref=`), voice one character, cut a 60-second episode trailer. If that makes
one person say "wait, the GAME made this?" — that's the greenlight signal for the
full arc.

---

## READING ORDER

1. `README.md` — orientation, run commands, ground rules
2. `docs/spec-af-war-v1.md` §10b and §10c specifically — the six product loops
   ranked by addictiveness, and the economics (sell agency, never dice; the
   anthology royalty flywheel)
3. `docs/north-star.md` — the long-game direction, read in full
4. `docs/rulings.md` — every rules ambiguity resolved, R1–R16
5. `docs/growth-spec.md` — acquisition/activation/retention mechanics (letters,
   diegetic invites, public-read funnel)
6. `HANDOFF.md` — the full chronological build log, known gaps, Todd's pending steps

---

## WORKING RULES

- **Dice are ground truth, always.** Server-rolled, seeded, logged exchange-by-
  exchange. No agent, judge, or human overrides an outcome. Narration honors every
  beat in the structured beat sheet; it may only invent connective tissue.
- **Never sell power.** Money can buy voice (better narration model), cosmetics,
  comic/video render rungs, betting stakes, anthology placement. Money can never buy
  dice outcomes, stats, or territory. The moment power is purchasable, the Ledger is
  a lie and the game dies — this is the one line that isn't up for discussion.
- **Tone contract.** Characters are a bit ridiculous; the message is/can be serious.
  Venture-Brothers surface, Black Mirror/1984 available underneath. Never wink.
  Never explain the joke. This applies to every piece of copy touching a character's
  voice — narration, letters, invite comics, judge verdicts.
- **One model-sheet-prompt fairness.** Every character's visual generation runs
  through the same turnaround prompt (the FlowZilla 8-panel pattern, ported in the
  economy round). Nobody's character gets a better art pipeline than anyone else's.
- **Schema migrations are additive `schema-00N.sql` files that Todd pastes himself**
  into the Supabase SQL editor. Never assume a migration ran — check with Todd or
  check the live schema. Every migration file must be safe to re-run
  (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING` / `ADD COLUMN IF NOT EXISTS`).
- **Verify before commit:** `npm test` (engine vitest suite) + `npx tsc --noEmit`
  green, and for web changes, a successful `npm run build` in `web/`, before any
  commit that touches `engine/` or `web/`.
- **Deploys are manual and explicit:** `cd web && vercel --prod`. Not a git-push
  pipeline — deploy only when asked to, or when a working session explicitly reaches
  a deploy step.
- **Commit author must be `Todd Wahnish <3332937+wahnish@users.noreply.github.com>`.**
  Every commit in this repo so far carries a `Co-Authored-By: Claude Fable 5
  <noreply@anthropic.com>` trailer — keep that convention.
- **Delegate mechanical builds to cheaper models, and verify their work.** Sequence
  work by risk/value, not by "saving the hard stuff for later" — Todd owns the model
  roadmap, don't defer real decisions to some hypothetical cheaper pass.

---

## KEY LOCATIONS

- All secrets live in `.env` (repo root, engine/sim) and `web/.env.local` (web app) —
  both gitignored. Known keys (names only — never read or print values):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `FAL_KEY`, `OPENROUTER_API_KEY`, `CRON_SECRET`.
- **Fallback chain:** if a local key is missing, the sim/engine scripts fall back to
  `~/Documents/FlowZilla/flowzilla/.env.local` for `OPENROUTER_API_KEY` and
  `FAL_KEY` — this repo and FlowZilla share Todd's model/render budget.
- `engine/` — pure TS war engine, zero I/O, vitest (`npm test` from repo root)
- `agents/` — cast (15 real AF PCs, 5 crews), LLM client, narration/judge/downtime
  prompts
- `comic/render.ts` — model sheets + NB2 whole-page comic gen from grammar JSON
- `sim/run.ts` — the mini-season runner; bundle lands in `sim/out/` (gitignored)
- `docs/` — spec, north-star, rulings, growth-spec, `lore/` (AF bibles exported from
  the FlowZilla DB — agents draw lore from here, never invent canon)
- `web/` — the deployed app; note `web/proxy.ts` (NOT `middleware.ts` — a Next-16/
  Vercel Edge-runtime scar, see `HANDOFF.md`)

---

## NEXT-UP MENU

Pick based on what Todd asks for, but if he opens with "what's next" or similar,
these are the live options, roughly in the order the North Star and HANDOFF suggest:

1. **Todd's trailer proof** (North Star's named first concrete step) — top-Clout
   canon telling → FlowZilla `?comicref=` lane → VO one character → 60-second
   episode trailer. This is the single highest-signal next move: it tests the whole
   Broadcast thesis for the cost of one trailer.
2. **Growth-spec build order** (`docs/growth-spec.md` §3d) — public-read fix first
   (closes a real gap: shared links currently hit a Supabase auth wall), letters
   second (the retention engine), invite comic third (the highest-craft viral
   mechanic, most new build work).
3. **The Bridge mapping** — season → arc lanes, rounds → story-time, canon_events →
   confirmed continuity notes, characters → assets w/ model sheets. North Star's
   framing: this is a mapping onto FlowZilla's existing Universe graph machinery,
   not new generation code.
4. **Eisner** — stand up the Buddy persona with producer verbs (reads canon → writes
   beats → materializes storyboard/comicref → renders → composes), staged-with-
   approval first.

Recommended default if Todd hasn't specified: **#1, the trailer proof** — it's the
cheapest, fastest validator of the entire North Star thesis, and every other item on
this menu is more build-heavy and worth sequencing after that signal comes back.
