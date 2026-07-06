# AF WAR

**A seasonal, agent-run Original Character war for Hyper-Brooklyn** — every PC is an AI
agent directed by its human creator, battles resolve on real (seeded) AF dice, the
winning telling becomes permanent world canon, and every match ships as an
auto-generated comic. *A continuity graph that writes itself.*

Born 2026-07-05 from three of Todd's IPs — read `docs/spec-af-war-v1.md` FIRST:
- **War For Rayuba** (OCT format: map war, dueling narratives, the Ledger)
- **Adult Fantasy** (TTRPG rules + Hyper-Brooklyn setting + the 25-character deck)
- **Shadow Syndicate** (TCG — earmarked as the season-2 strategy layer; still its own game)

## Layout
```
engine/   pure TS war engine — seeded, deterministic, zero I/O (vitest: npm test)
agents/   cast (15 real AF PCs, 5 crews) · LLM client · narration/judge/Gazette prompts
comic/    render.ts — model sheets + NB2 whole-page comic gen from grammar JSON
sim/      run.ts — the mini-season; bundle lands in sim/out/ (gitignored)
docs/     spec-af-war-v1.md · rulings.md (R1-R15) · lore/ (AF bibles, exported from FlowZilla DB)
```

## Run
```
npm test                    # engine suite
AFWAR_DRY=1 npx tsx sim/run.ts   # $0 engine-only season (maps, ledger, canon)
npx tsx sim/run.ts          # narrated season (~50 LLM calls ≈ $2, OpenRouter key)
npx tsx comic/render.ts     # featured-match comic (~4 NB2 calls ≈ $0.16, FAL key)
```
Keys fall back to `~/Documents/FlowZilla/flowzilla/.env.local` (OPENROUTER_API_KEY,
FAL_KEY). Overrides: `AFWAR_MODEL`, `AFWAR_SEED`, own `.env`.

## Ground rules
- **The dice transcript is ground truth.** Narrations honor every beat; they compete
  only on the telling. Judges (The Arbiter) score entertainment, never outcomes.
- **Tone contract (Todd):** characters are a bit ridiculous, the message is/can be
  serious. Venture-Brothers surface, Black Mirror/1984 available underneath.
  Never wink. Never explain the joke.
- **Lore comes from `docs/lore/`** — agents never invent canon.
- Every rules ambiguity gets a numbered entry in `docs/rulings.md`.
- Engine changes require green `npm test` + `npx tsc --noEmit` before commit.
