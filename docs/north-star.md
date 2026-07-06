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
