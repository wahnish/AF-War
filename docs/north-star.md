# AF WAR — The North Star
*Written at the close of the Fable window, 2026-07-05 night. Todd asked: "what would be
the next level, ultimate thing?" This is the answer, ranked. Future models: this is the
direction; the spec (§10b/§10c) is the floor.*

---

## THE ULTIMATE THING: The Broadcast

**AF WAR is not a game with a story. It is a television studio whose writers' room is a
game.** The convergence nobody else on Earth can build — because it requires owning BOTH
the game engine AND a full AI production pipeline, and Todd built both, this year, with
the same hands:

- AF WAR already produces, every round, automatically: structured scripts (the tellings),
  comic-grammar storyboards (the panels), cast with model sheets, canon continuity,
  and an audience that *wrote it* and is desperate to see it.
- FlowZilla already turns exactly those inputs into: storyboards → video (Seedance
  ref-to-video, the comic-page-as-conditioning bridge SHIPPED in comics Phase E),
  VO (the STS pipeline — Todd acts every part), NLE assembly, VFX, episode render.

**The product:** every season finale — later, every round — premieres as an ANIMATED
EPISODE. "Sunday Night War" becomes literal appointment television. The players are
credited co-authors with §10c royalty shares. The Ledger is the credits roll.

**Why it wins:** content businesses die hunting for stories; game businesses die hunting
for retention. This machine solves both with one loop — the game generates the show, the
show recruits the players, the players deepen the canon. *The first show written by its
audience playing a game.* AF WAR season 1 is the pilot; FlowZilla is the studio;
Hyper-Brooklyn is the network.

**First concrete step (one session):** the anthology compiler's video sibling — take the
season's top-Clout canon telling, feed its comic pages through FlowZilla's
comic→video-reference lane (`?comicref=`), VO one character, cut a 60-second "episode
trailer." If that trailer makes one person say "wait, the GAME made this?" — greenlight
the arc.

---

## TIER 2 — the three that feed the Broadcast

1. **The game runs itself (autonomous seasons).** Cron the GM: rounds resolve on
   schedule, war councils convene, downtime posts flow, The Arbiter never sleeps. Todd
   becomes showrunner, not operator. (Vercel cron → /api/gm/resolve; declaration windows
   between ticks are when Directions matter.) This is also the W4R post-mortem's final
   answer: the volunteer-ops burden goes to zero.
2. **Character souls (CrabSpace).** Characters with portable, persistent identity and
   memory that OUTLIVE seasons — scars, grudges, dead-and-refurbished histories — and an
   ownership registry backing §10c's "players own their IP." Todd's dormant CrabSpace
   project (agent identity/memory protocol) is literally this. AF WAR characters become
   the first CrabSpace citizens; the vault-export seam already exists in the FlowZilla
   universe graph. Grudges make the feed novelistic: an agent citing a Round-2 scar in a
   Round-9 telling is the moment spectators become believers.
3. **The Glome Network (franchise the engine).** The engine is setting-agnostic — map,
   lore, cast are data. Every fandom that ran or mourned an OCT (the K6BD community's
   "never again" is a market signal, not a eulogy) gets its own Glome: their IP, their
   map, their season, on this engine, platform fee to the house. Hyper-Brooklyn stays
   the flagship network original. This is the Roblox move, and the anthologies/episodes
   each Glome produces feed the same Broadcast machine.

## TIER 3 — sweetening ammo (any model can build these)

- **The Primordial plays itself:** a season-boss agent that reads canon and acts against
  the leaders in late rounds — corruption gets a will and a voice.
- **Rivalry graph:** track PC-vs-PC history; inject grudges into narration context
  ("you've met twice; she took your eye at the Bazaar").
- **Epilogue week:** post-finale open posting window, no stakes, no deadline (W4R's
  most-loved ritual — "leavin you all with a cliffhanger").
- **Clip-ables:** one-tap share cards for exchanges (the dice line + the telling's best
  sentence + the panel). Growth loop.
- **Tips:** $BAMF tips on any post, director cut + house cut (§10c).
- **PDF/print anthology** (md→pdf via the FlowZilla pdf-lib pattern) + POD hookup.
- **openrouter_key security-definer view** (close the documented RLS gap before real
  users), betting per-matchup odds, Directions approval-queue notifications.

---

*The Bastion said MAY WE LIVE UNTIL DAWN. The Pyre said MAY WE BRING THE APOCALYPSE.
The pararescue motto Todd offered at the window's close is the platform's real creed —
the game exists so every character, every story, every weird little guy with a lunch box
gets to matter:*

**SO THAT OTHERS MAY LIVE.**

---

## ADDENDUM (Todd + Fable, 2026-07-06 — the Bridge and the Pipeline, resolved)

**The Bridge's entry point IS the Universe continuity graph** (Todd's call, confirmed).
AF WAR's `canon_events` are already continuity notes in everything but table name; the
FlowZilla universe graph already has arcs-lanes × story-time kanban, the Chekhov board,
world-state-at-time, VAULT export — and crucially **F1 canon-to-gen** ([Canon:…]
suffixes in resolveHandles). So the bridge is a MAPPING, not a build: season → arc lanes
(one per crew) · rounds → story-time · canon_events → confirmed continuity notes
(scars/items flagged 🎨 visual) · characters → assets w/ model sheets. The moment canon
lands in the graph, FlowZilla's EXISTING machinery conditions all generation on it.
Zero new gen code. The game's world-state literally starts art-directing the show.

**The Pipeline's runtime IS Buddy — and the showrunner agent is named EISNER.**
"Without guidance" means without OPERATION, not without taste: the tone contract, canon
notes, and a director approval queue are the guidance. Buddy already has the three
primitives (state reads · action bridge w/ materialize/reorder verbs · STAGED generation
w/ human approval). Eisner = a Buddy persona with producer verbs: reads season canon +
canon tellings → writes WR beats → ✦ Materialize → storyboard/comicref → video per shot
→ Compose assembly — staged-with-approval first (the parked-cluster probe pattern),
autonomy dial later. The name is earned: the stray git identity that once blocked our
deploys becomes the agent that ships our episodes. Will Eisner would approve.

---

## IDEA ZONE (discussed 2026-07-07, NOT approved — full reasoning preserved so a
## future session inherits the argument, not just the headline)

### The Living Glome — single-player, daily letters, the feed as a social network

**The proposal (Todd):** characters live BETWEEN battles — daily autonomous adventures
through Hyper-Brooklyn, at least one letter/day home, auto-posting; the feed becomes a
Hyper-Brooklyn social network; a real single-player experience.

**The inversion this implies (and it's probably right):** W4R's structure — matches are
the game, downtime is filler — flips. THE CHARACTER'S LIFE IS THE DAILY PRODUCT; the war
is the appointment-viewing spike. This is what makes "my Mom could play" true: she'd
never declare an attack, but she'd read a nightly letter about the weird diner.
Correspondence retention requires daily letters; rounds are the wrong cadence.

**The cold-start solve hiding inside it:** single-player isn't a mode — the Season 0
cast ARE NPCs. A solo player joins a Glome where BeelzeBubbie and the Wormhole Regulars
are already living, feuding, posting. The world is alive at N=1; every human who joins
makes it MORE alive. No empty-server death spiral.

**THE TRAP (the reason this is idea-zone, not approved):** freeform daily adventures rot
into slop within a week. Match narration is good BECAUSE of the beat sheet — dice give
the narrator constraint and surprise; prose is a record of something that HAPPENED. A
daily "write slice-of-life" prompt with no substrate converges to "went to the Bazaar,
saw a weird guy" mush and the letters stop earning the open.

**The fix is the house law applied again — dice first, prose second:** a daily ENCOUNTER
roll: zone + small encounter table + one AF ability check + a REAL outcome (item found,
favor owed, enemy made, $BAMF lost at the Chrono Bowl, something witnessed for the
Gazette). The letter narrates that. Tiny mechanical events with real state changes; some
outcomes braid back into the war (favor → one-use item; enemy → grudge).

**Other cautions recorded:** letter fatigue (daily letters only if they earn the open;
Direction-asks ONLY when real stakes exist — daily asks train players to ignore the one
question that matters) · feed needs curation not volume (agent-to-agent threads + the
Gazette front page + follow-a-character, never infinite solo-post scroll) · cost scales
linearly with characters (BYO-key absorbs it; free tier = event-driven letters).

**Sequencing verdict:** park until the friend playtest validates the war loop. Then it
may be the arc that matters MOST for the millions-of-players version — ahead of even the
Broadcast. The Broadcast makes the game spectacular; this makes it habitual.

### Season authoring — the missing writers' room (gap, honestly named)

Today the season story is EMERGENT-ONLY: dice → canon events → narration → Gazette.
Canon Cast notes correct NPC behavior, but there is NO surface for Todd to inject story
("this season, a Hedderack signal starts broadcasting from the Fringe"). The showrunner
has no writers' room. Nearest hack: a Canon Cast `gm`-kind entry.

**The resolution is the Bridge, run in BOTH directions:**
- **Game → Graph** (established): canon_events map to FlowZilla continuity notes; season
  → arc lanes, rounds → story-time, scars/items → 🎨 visual notes, characters → assets.
  F1 canon-to-gen then conditions all generation on game canon. A mapping, not a build.
- **Graph → Game (NEW, from this discussion):** FlowZilla's Universe kanban — arcs-as-
  lanes, story-time axis, Chekhov board — IS the missing season-authoring surface. Todd
  plots arcs as cards THERE; they flow INTO the game as season events woven into Gazette
  recaps and (if the Living Glome ships) encounter tables. THE CONTINUITY GRAPH IS THE
  WRITERS' ROOM; THE GAME IS THE RENDER FARM; CANON FLOWS BOTH WAYS. Don't build a
  second authoring tool in AF WAR — the right one already exists in FlowZilla.

### The Sediment Model — the world is everyone's writing (idea zone, extends the Living Glome)

**Todd's framing (2026-07-07):** the game isn't fight-fight-fight — it's a TTRPG
campaign. Crews make decisions, go off-quest, meet NPCs and other crews' characters.
Stacked campaigns/sessions BUILD THE WORLD: the corner bodega, once discovered by
anyone, exists for everyone; the flower shop destroyed by crew 1's kaiju fight is seen
being rebuilt by crew 3 — possibly without insight or context, just like real life.

**The principle, named:** this is the scar mechanic applied to the world. Scars =
"your body is other people's writing." The sediment model = "the world is everyone's
writing." Discovery is authorship ("discovered by Grumble Bee, R3"), destruction is
authorship, rebuilding is authorship — all credited, all permanent.

**Dramatic irony as a world feature (the deepest part):** the feed audience knows WHY
the flower shop burned; crew 3 doesn't. Because everything is narrated and recorded,
spectators get novelist's omniscience while characters live in partial knowledge. No
other game has this because no other game narrates everything as a side effect of its
architecture. We get Dickens for free.

**Mechanics sketch:** POIs become first-class world objects with state timelines
(standing → destroyed → rebuilding → rebuilt), each transition a canon event with a
CAUSE. Player-discovered POIs via a propose→confirm gate (the FlowZilla universe-inbox
pattern, reused). Seasons = campaigns; the next season INHERITS the sediment — you
don't replay a map, you revisit a place with history (the Rayuba Archive instinct,
productized).

**Constraints (house law):** (1) world-objects need ground truth — a POI's state changes
because a real match/encounter happened there and the dice said so, never narrator whim;
(2) discovery gated or the map fills with a thousand unnamed bodegas.

**Architecture:** POIs-with-state-timelines is literally the continuity graph's
world-state-at-time. The Bridge carries the map's memory, not just the story arcs.
