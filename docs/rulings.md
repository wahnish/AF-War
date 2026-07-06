# AF WAR — Rulings Log
Every ambiguity in the AF Player's Handbook or W4R format resolved during the build.
Todd reviews; anything he overrules gets re-implemented.

- **R1 (Todd, 7/5): 5th starting die.** Handbook lists 4 dice for 5 abilities.
  Starting array = d10 / d8 / d6 / **d6** / d4.

- **R2 (Todd-approved concept, 7/5): Defense Policy.** AF's defend/counterattack choice is
  synchronous. Async play adds a director-tuned decision table per PC:
  `resistVs[]` (END instead of DEX vs listed attack abilities),
  `counterWhenHpAbove`, `spendVpAtMatchPoint`, `blazeOfGloryIfDying`.
  The ONLY rules change to AF; everything else is the book.

- **R3: power mechanics v1.** Book powers have bespoke effects; v1 maps a power of
  level L to: cost L VP, add one exploding bonus die by level
  (1–2→d4, 3–4→d6, 5–6→d8, 7–9→d10, 10+→d12). Named powers keep narrative identity.

- **R4: crit-fail precedence.** If both sides roll nat 1 in one exchange, the
  attacker's crit-fail resolves first (initiator owns the disaster).

- **R5 (Todd, 7/5): best-of-3 exchanges** per match; the previous exchange's LOSER
  initiates the next (comeback pressure, echoes the book's least-goes-first
  initiative). Safety cap at 5 exchanges. Failing Successfully counters persist
  across a round (a round = an in-game day).

- **R6: Graves End tab.** W4R's Blood Meter, re-skinned in canon (Graves End
  refurbishes the dead — it's in the bible). A kill earns the killer's crew
  1 credit; resurrection costs 3. Credit is giftable between allies (not yet
  implemented — S2).

- **R7: cursed items.** W4R item mechanics, AF skins:
  Black Mayonnaise Blade (all holder's matches → death stakes),
  Hypno-Waffle (loser defects to winner's crew),
  Hedderack Landwaster Cannon (win → capture one extra adjacent zone; lose → drop it).

- **R8: undefended zones flip without a match.** A crew with no live PCs cannot
  hold territory against an attack.

- **R9: one match per zone per round.** First valid claim (seeded shuffle) takes the
  slot; later claims on the same zone are dropped that round.

- **R10: Blaze of Glory in matches.** Available when facing defeat in a DEATH-stakes
  match, policy-gated. The all-in steals the match unless the self-damage kills
  you (dying mid-blaze = you still lose; the corpse is spectacular).

- **R11: post-round recovery.** Between rounds every active PC heals 1d4 (book's
  post-combat rule applied per-day), VP resets to 10, Incompetence re-rolls.

- **R12: Monorail mobility.** Holding the Monorail lets you attack any zone the rail
  touches (Ellis Island, Coney, Fringe, Hinterlands, EDB) regardless of adjacency.

- **R13: corruption.** Spreads by seeded BFS from the Gowanus starting round 2 per a
  per-round schedule. Corrupted zones are uncontrollable and unattackable; holders
  lose them immediately. Dodgers Stadium never corrupts (finale site).

- **R14: convergence finale.** When scheduled rounds end, each surviving crew sends
  its best fighter (kills, then biggest die) to Dodgers Stadium: single-elimination
  DEATH matches, seeded bracket. Champion's crew +8 points; season winner = points
  (zones + kills + finale bonus).

- **R16 (Todd, 7/5 night): REAL BROOKLYN MAP + THE GLOME BREATHES.** Zones are real
  neighborhoods (Hyper-Brooklyn = phantom-zone Brooklyn); canon landmarks are POIs
  inside them carrying the terrain personality. Finale = phantom Ebbets Field.
  Active map = contiguous BFS region around the finale sized max(8, 6+ceil(players×1.2));
  zones outside are "beyond the Glome" (unplayable, dim on the map). Corruption BFS
  is restricted to the active Glome. Nuhart→Greenpoint, Graves End→Gravesend,
  AF HQ→Brownsville, Wormhole→Williamsburg, Awful Waffle→Brighton Beach, etc.
