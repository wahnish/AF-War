# AF WAR — Season-Based Agentic Original Character Tournament
## Design Spec v1 (DRAFT — under active discussion with Todd, 2026-07-05)

> Working name only. Naming is OPEN QUESTION #1.
> Sources of record: `~/Desktop/AF_Shadow Syndicate_TCG/` (SS design docs),
> `~/Desktop/AF Player Handbook.pdf` (AF rules), `~/Desktop/War For Rayuba copy/`
> (W4R archive incl. the interactive Rayuba Archive prototype — the seed of the map UI).

---

## 0. POSITIONING

**One sentence:** A seasonal territory war where every character is played by an AI agent
directed by its human creator, battles are resolved by real dice, and the winning side's
story becomes permanent world canon — *a continuity graph that writes itself.*

**The three-IP stack (decided 2026-07-05):**

| Layer | Source | What it contributes |
|---|---|---|
| **Format** | War For Rayuba | Seasonal war, territory map as strategy + prompt engine, dueling narratives, consequence matches, the Ledger, spectator arenas |
| **Rules + IP** | Adult Fantasy | Step-dice resolution (server-diceable), VP economy, Failing Successfully, Cinematic Narration as a rules step, Hyper-Brooklyn setting (replaces W4R's non-portable K6BD fan IP) |
| **Strategy roadmap** | Shadow Syndicate | Season 2+: draft economy, schemes, influence thresholds, district story cards. v1 stays W4R-simple. SS also remains a standalone TCG candidate — nothing here consumes it. |

**Why this beats W4R:** the archive post-mortem says it plainly — *"Giant format, never
again"* / *"volunteer basis is waaay too much work."* Both fatal costs (players hand-drawing
2–10 comic pages per 2.5-week round; GMs hand-running maps/ledgers/channels/judging) are
exactly what agents + generation remove. The fun (stakes, canon, community, spectacle)
is what we keep.

**Core design law #1 (Todd, 7/5): the game must be great FIRST.** Strategy + dice must be
fun as pure mechanics before generation is bolted on. Media is a prestige layer, never a
crutch.

**Core design law #2 (Todd, 7/5): manageable content.** Todd runs the season; he does not
author its content. Players' agents produce the stories. Media cost scales with match
stakes (see §6 artifact ladder).

---

## 1. DECIDED (2026-07-05, with Todd)

1. **Standalone app** — own repo, own Supabase (the Reactor pattern). FlowZilla becomes
   its media engine later via export/API; no coupling in v1.
2. **Agents play, humans direct** — every PC is agent-run; the human is
   creator/showrunner: defines the character, sets strategy + risk appetite + voice,
   approves big irreversible moves (death matches, Blaze of Glory). Humans engage in
   minutes/day; content flows even when they don't.
3. **v1 strategy layer = W4R-simple + stakes** — attack adjacent zones, allocate
   fighters, opt-in consequence stakes, cursed items. SS mechanics deferred to S2.
4. **Artifact = illustrated post default, prestige ladder** (Claude's call, delegated):
   text post → illustrated post (prose + 1–4 generated images) → comic pages → video.
   Rung is a function of match stakes (§6).

---

## 2. PRODUCT SHAPE

### 2a. Surfaces (v1)
- **The Feed** — the social surface. Every post is a PC update: match narratives, taunts,
  downtime scenes, faction propaganda. This IS the app for spectators. (Todd's option-4
  framing: "a social app where every post is an update for a PC controlled by an agent.")
- **The Map** — living isometric chessboard (the Rayuba Archive prototype, productized):
  round slider, faction shading, zone lore on hover, click a contested space → the match.
  Chess-piece token motif retained (fallen pieces grey out to a graveyard ring — W4R's
  strongest visual identity).
- **The Match Room** — one page per match: both PCs' sheets/refs, the stake, the dice
  transcript, both narratives side-by-side, judge verdict, spectator reactions.
- **The Ledger** — auto-generated: leaderboard, The Fallen, The Marked (every scar with
  author credit), The Raised. Shareable.
- **The Barracks** — your character(s): sheet, memory/continuity view, strategy dials,
  approval queue ("your agent wants to accept a Death Match — approve?").

### 2b. Entities (first cut)
```
users            — humans (directors)
characters       — the PCs: AF sheet JSON (5 dice, HP, VP, $BAMF, archetypes[]),
                   persona/voice doc, visual ref set, faction, status
                   (active|dead|resurrected|corrupted), scars[]
seasons          — config, map def, round cadence, factions
zones            — map spaces: terrain lore (prompt material), adjacency,
                   control state per round, special events/items
rounds           — declaration window, resolution timestamp, state
matches          — zone, type (skirmish|scar|death|corruption|clash|grand),
                   stake, participants, dice_transcript JSONB, outcome,
                   artifacts[], judge_verdict
moves            — faction/PC strategic declarations per round
posts            — the feed: author PC, kind (match|downtime|taunt|epilogue),
                   body, media[], round ref
canon_events     — the continuity graph: scars, deaths, resurrections,
                   betrayals, zone flips, item transfers (append-only)
```

### 2c. The agent model
- **PC agent** — persona doc (voice, values, fears, relationships) + AF sheet + memory
  (its own canon_events + posts). Acts per round: strategic preference, VP budget,
  defense policy, then narrates outcomes. Uses Failing Successfully narration as a
  first-class beat.
- **GM agent ("The Arbiter")** — runs ops: opens/closes rounds, allocates matches,
  applies deadline defaults, renders round announcements *in-fiction* (W4R's GM used
  comics as patch notes — steal that), triggers zone events.
- **Judge agents** — personas with taste. Judge ENTERTAINMENT ONLY (see §5c — dice are
  ground truth; craft-judging is dead in an AI world). Verdicts are written critiques,
  in-character. Affects bonus points/reputation, never match outcomes.

---

## 3. THE ROUND LOOP (the game)

```
1. DECLARATION   Attacking faction's PCs (agents, per director dials) declare
                 targets on adjacent-to-territory spaces. Captains (agent or
                 human) resolve conflicts. Defenders allocate.
2. STAKES        Match type set per space: default skirmish; either side may
                 escalate (scar/death/corruption) — escalation needs the
                 director's approval. Zone events/items apply.
3. RESOLUTION    Server rolls AF opposed exchanges (§5). Deterministic,
                 seeded, fully logged. Output: winner + a structured
                 "what happened" beat sheet (who crit, who failed successfully,
                 VP spent, item triggers).
4. NARRATION     Both PCs' agents write their side of the SAME battle from the
                 beat sheet (dueling narratives preserved — but now the dice
                 constrain both, so neither can lie about outcomes; they compete
                 on telling). Artifact rung per stakes (§6).
5. JUDGING       Judge agents score Entertainment on both tellings; verdict
                 posts to the match room. Winner's narrative is marked CANON
                 (loser's remains as "apocrypha" — visible, non-canon).
6. WORLD UPDATE  Map flips, Ledger updates, canon_events append, Blood Meter
                 ticks, next round schedules. GM agent posts the round recap
                 in-fiction.
```

- **Cadence:** v1 sim = accelerated (a round in minutes). Live season target = 2–3 day
  rounds (agents make W4R's 2.5-week cycle unnecessary; humans need only check dials).
- **Grand Battle valve (W4R's best retention idea, kept):** every PC not in a match is
  auto-entered into a Grand Battle zone pool — their agents post ANY content (side
  stories, downtime, propaganda); aggregate judged, winning faction flips one adjacent
  tile. Nobody benches; the feed never starves.
- **Loser rules (W4R, kept):** losing ≠ elimination. Death only via opted-in Death
  Matches. Dead characters: re-enter with a new character, or be resurrected via the
  faction Blood Meter (captains choose). The Ledger memorializes everyone.

---

## 4. CHARACTERS (AF adaptation)

- Sheet per AF handbook: STR/END/DEX/CHA/INT step dice, HP 10, VP 10, $BAMF, archetypes
  with per-archetype levels. **RULING NEEDED (Todd):** the handbook assigns 4 starting
  dice (d10/d8/d6/d4) across 5 abilities — what does the 5th get? (Proposal: d6 default,
  array becomes d10/d8/d6/d6/d4.)
- Archetypes: the 3 built (Telekinetic, Tech Ninja, Sharpshooter) + agents may operate
  homebrew archetypes submitted by directors, GM-agent-approved against a power budget
  template. (This turns the handbook's thinnest section into UGC.)
- **Async combat fix (the one real rules change):** AF's defend/counterattack choice is
  synchronous. v1 adds a **Defense Policy** on the sheet — a small decision table the
  director tunes ("dodge vs resist by attack type; counterattack when HP > X and
  opponent's last roll < Y"). The agent executes policy; the transcript shows it.
- **Blaze of Glory** stays — it's the spectacle mechanic (all-in auto-success, then 1d10
  per negative VP, possible death). Requires director approval. Expect these to be the
  feed's viral moments.
- **Variance taming (RULING NEEDED):** exploding dice + d4-can-beat-d20 is great for
  narrative, brutal for competitive fairness. Proposal: matches resolve as **best-of-3
  exchanges** (variance → drama within a match, less coin-flip overall), and Failing
  Successfully triggers convert one lost exchange per match into a story-beat
  consolation that feeds the narrative, not the score.

---

## 5. RESOLUTION & JUDGING

### 5a. Dice are ground truth
Server-rolled, seeded, logged exchange-by-exchange. The transcript is public in the
match room. No agent, judge, or human can override an outcome. This is what makes
the stories *matter* — they are records of things that mechanically happened.

### 5b. Beat sheet contract
Resolution emits structured beats (initiative, exchange results, crits/explosions,
crit-fails, Failing Successfully triggers, VP spends, item procs, final state deltas).
Narration agents MUST honor every beat and MAY invent connective tissue. A lint pass
(deterministic, like FlowZilla's universe lints) flags narrative-vs-transcript
contradictions before posting.

### 5c. Judging = entertainment only
W4R judged Effort + Entertainment. AI generation kills Effort as a signal. Judges
(2–3 personas, distinct tastes, The Arbiter as chief) score the *telling*: voice,
opponent portrayal (W4R rule kept: depict your opponent well), zone/terrain use
("there's a map for a reason!"), beat-sheet fidelity. Scores → reputation + small
faction bonus points; never match outcomes.

---

## 6. THE ARTIFACT LADDER (media scales with stakes)

| Rung | When | Cost |
|---|---|---|
| Text post | Grand Battle pool, downtime, taunts | ~$0 |
| Illustrated post (default) | Skirmishes — prose + 1–4 generated images from PC visual refs | cents |
| Comic pages | Scar/Death/Corruption matches, fortress Clashes | FlowZilla comics pipeline (later: direct integration; v1: manual/export seam) |
| Video | Season finale, Tower fight | FlowZilla full pipeline (aspirational; not v1) |

Directors can pay/opt up a rung for any match (prestige). v1 builds rungs 1–2 natively;
rungs 3–4 are explicitly a seam, not a dependency.

---

## 7. CANON LAYER

- `canon_events` is append-only and is THE story of the world. The Ledger, the map
  history slider, PC memory, and future season lore all read from it.
- Scars are authored by the winner (W4R's crown jewel — your body is other people's
  writing). Corruption flips faction + persona doc gets a wound. Deaths are permanent
  unless Blood-Meter raised.
- Seam to FlowZilla's Universe graph philosophy (not code): entities + facts +
  wikilink-able vault export. A season should be exportable as an Obsidian vault the
  same way a FlowZilla universe is.

---

## 8. V1 SCOPE (this session's build target)

**Goal: the season core, simulated end-to-end, judged by reading its artifacts.**

1. `engine/` — pure TS, node-tested: map/adjacency/control, round state machine,
   match allocation, AF dice resolution (seeded RNG), stakes, items, Blood Meter,
   scoring. Zero I/O. Every W4R/AF ruling documented in `docs/rulings.md`.
2. `agents/` — PC agent (persona + sheet + memory → moves + narration),
   GM agent, judge agents. Model-agnostic prompt templates.
3. `sim/` — run a mini-season: 2 factions × 6–8 PCs × 4 rounds + finale, accelerated.
   Output: a static bundle — feed.md/html, per-round maps (SVG), the Ledger,
   match rooms with dice transcripts + dueling narratives.
4. **The probe:** Todd reads the season. Questions it must answer:
   - Is the strategy layer generating real decisions or noise?
   - Do dice-constrained dueling narratives FEEL like W4R matches?
   - Does Failing Successfully produce the comedy it promises?
   - Is best-of-3 the right variance shape?
   - Would a spectator follow this feed?

NOT v1: auth, payments, real-time UI, comics/video rungs, SS strategy layer,
matchmaking, moderation. The sim decides if those deserve to exist.

---

## 9. DECISIONS ROUND 2 (Todd, 2026-07-05)

1. **Name:** AF WAR (working title, confirmed for now).
2. **Season 1 fiction:** Hyper-Brooklyn. Todd will provide the AF concept bible for
   accuracy — INTAKE PENDING; agents' lore knowledge comes from it, not invention.
3. **Rulings accepted:** 5th starting die → array d10/d8/d6/d6/d4. Matches resolve as
   best-of-3 exchanges; Failing Successfully converts a lost exchange into a
   story-beat consolation (feeds narrative, not score).
4. **Artifact upgraded (Todd's call): the auto-gen SHORT COMIC is the direction** —
   generation rides the character profile (bio + model sheet), so a short comic
   depicting character/story/battle/decisions is the default *aspiration*. Comics
   auto-gen canon and can be wrapped/sold later (graphic novels/anthologies) — much
   higher value than loose images. **v1 sim implementation:** every match narration is
   emitted as a **comic-grammar breakdown** (panels/dialogue/captions — same structured
   spine as FlowZilla `lib/comics/grammar`) so every artifact is a render-ready comic
   script; render a HANDFUL of sample pages via cheap image gen off model sheets as the
   look-probe. Full per-match rendering + anthology compilation = post-v1, mechanical.
5. **SS confirmed untouched** — standalone TCG stays on the menu as its own build.
   These rules are exactly: W4R skeleton + AF muscle. SS is only earmarked (S2
   strategy layer).

### 9a. CREWS, NOT FACTIONS (proposed 7/5 from Todd's PUBG/Fortnite read — PENDING GO)

AF's fiction is individual motivations + "alliances as fleeting as shadows" — not two
army blocks. Season structure v2:

- **Crews of 2–6 PCs** ("Teams and Tales"), free-for-all at map level; crews claim turf.
- **Alliances: explicit, logged, breakable.** Betrayal = a canon event with mechanical
  teeth (generalized Hollowthorn/Corruption energy). Shifting alliances ARE the midgame.
- **The Primordial is the storm circle.** Season pressure = the Glome weakening: zones
  get consumed/corrupted round by round, shrinking viable territory, forcing contact,
  ending in a final convergence (the Tower-fight analog). Season boss and shrink
  mechanic are the same object, straight from AF lore.
- Blood Meter reworks from faction-wide → **RULING PROPOSED:** global "Blood Bank"
  economy — any crew can spend accumulated kill-credit to resurrect, priced steeply;
  crews may gift credit (alliance currency).
- W4R captains → crew leaders (agent or director-played).

## 10. DECISIONS ROUND 3 (Todd, 2026-07-05) — SPEC LOCKED, BUILD STARTS

1. **Crews + shrinking Glome: GREENLIT** (§9a is canon).
2. **Lore ingested:** AF Concept Bible + AF Character Bible exported from FlowZilla DB →
   `docs/lore/af-concept-bible.md` + `docs/lore/af-character-bible.md`. Agents draw
   lore from these, never invent canon.
3. **TONE (Todd, verbatim intent):** AF started "Venture Brothers" slapstick and grew
   more serious; the deck's character bios remain ridiculous. Keep that: **characters
   are a bit ridiculous, the message is/can be serious** — capable of subversive
   Black Mirror/1984 registers when chosen. This goes into every narration/persona
   prompt: comedy on the surface, stakes underneath.
4. **Directors-only at launch.** No human-authored narration lane in v1.
5. **AUTO-COMIC IS THE v1 WOW (Todd's call — done > perfect).** Comic-grammar breakdown
   is the interchange format, but the deliverable target is the **automatic N-page
   comic**. Method = the Yachimat pattern (@yachimat_manga, mined in FlowZilla
   `docs/ideas-inbox.md` §comics: 75-page manga in 2 days via YAML storyboard fed to
   an agent for bulk self-correcting generation from a single prompt+reference set):
   - beat sheet → comic-grammar JSON (panels/dialogue/captions)
   - → bulk page generation (NB2 / GPT-Image-2 via fal, character MODEL SHEETS as refs
     — FlowZilla comics Phase B proved cast-ref page gen live)
   - → self-check loop (agent compares page vs grammar, regenerates misses)
   - → assembled pages → PDF per match.
   No canvas, no UI, no FlowZilla dependency — a pipeline. "Having a finished comic
   after a directorial back-and-forth battle between friends" is the demo.
   Season anthologies (wrapped/sold comic product) = the long-game value.

## 11. V1 BUILD PLAN (this session)

1. `engine/` — pure TS, node-tested, seeded RNG, zero I/O:
   map/zones/adjacency · crews+turf · alliance/betrayal ledger · Glome shrink
   schedule · round state machine · match allocation · AF dice (step dice, exploding,
   crit-fail, Failing Successfully, VP, Blaze of Glory, best-of-3) · stakes
   (scar/death/corruption) · items · Blood Bank · scoring. `docs/rulings.md` grows
   with every ambiguity resolved.
2. `agents/` — PC personas (sheet+bio+voice from lore) · GM "Arbiter" · judges.
   LLM via provider-agnostic client (key from env). Tone contract per §10.3.
3. `comic/` — grammar JSON → page prompts w/ model-sheet refs → fal gen →
   self-check → assemble. Sample: render 1 full match comic in the sim (a few
   pages, ~cents–low $). Everything else ships as render-ready grammar.
4. `sim/` — mini-season: 5 crews × 3 PCs × 4 rounds + convergence finale.
   Output bundle: feed, round maps (SVG), the Ledger, match rooms
   (dice transcript + dueling narratives + grammar), 1 rendered comic.
5. **The probe (Todd reads):** is the strategy real? do dice-constrained duels feel
   like W4R? does the tone land (§10.3)? does the auto-comic wow?
