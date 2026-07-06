# AF WAR — Growth Spec v1
*Written 2026-07-06. Companion to `spec-af-war-v1.md` (product/game design) and
`north-star.md` (long-game direction). This doc owns ONE question: how does AF WAR
acquire, activate, and retain humans — without ever compromising the Ground Rules
(dice are truth, never sell power, tone contract). Every mechanic below is diegetic:
it happens IN the fiction, through the actual product surfaces, or it doesn't ship.*

---

## 0. THE CHANNEL: email, not SMS

**Decision:** Resend or Postmark free tier (both offer inbound parsing + generous
free sends — pick whichever has the cleaner inbound-webhook DX when this gets built;
Resend's inbound is newer but the outbound API is already the simpler integration).
**No Twilio, no SMS, ever.** Two reasons, both non-negotiable:

1. **Cost.** SMS is billed per-segment forever; email is free at this scale and stays
   cheap at 10x this scale. AF WAR's whole economic thesis (§10c of the spec: sell
   agency, never dice) already runs thin margins on LLM narration — don't stack a
   second recurring cost that scales with engagement instead of shrinking with it.
2. **Spam poison.** SMS from an unknown sender reads as a scam text by default in
   2026. Email from a character, in that character's voice, with a real reply-to,
   reads as *mail*. This is the same instinct as the explicit ban below on
   LinkedIn-style contact scraping — the growth mechanic has to feel like the game,
   not like marketing wearing a game's face.

### Implementation notes tied to the actual repo

- Current schema has no `afwar_notifications` or email-delivery table. This is new
  surface area for schema-004+: a `afwar_email_log` table (id, user_id, character_id,
  kind, sent_at, opened_at nullable, replied_at nullable) gives the retention metrics
  in §3 something to query, and gives unsubscribe (§0c) a record to check against.
- Outbound triggers naturally off the existing GM cascade: `web/app/api/gm/resolve`
  and `web/app/api/gm/tick` (the cron GM, `vercel.json` → `0 15 * * *` daily) already
  compute a round's beat sheet + narration + judge verdict per character. The letter
  (§1) is a new render target off that same cascade output — not a new pipeline.
- Inbound parsing needs one new route: `web/app/api/email/inbound/route.ts`, the
  webhook target registered with Resend/Postmark. It authenticates by shared secret
  (same pattern as `CRON_SECRET` already gating `/api/gm/tick`), parses the reply
  body, resolves sender email → `auth.users` → `afwar_profiles` → owned
  `afwar_characters` row, and inserts an `afwar_directions` row (see §1b — this is
  the whole mechanic).

### 0c. Fallback + hygiene (do these from day one, not as a later polish pass)

- **Weekly digest fallback.** Not every character-owner replies to every letter (see
  activation math in §3 — most won't, and that's fine). A weekly digest email
  (`kind = 'digest'` in the log table) recaps: your characters' status, the Ledger
  delta, any war council or betrayal that touched your crew, and a single
  "reply to any character letter to direct them" nudge. This is the safety net that
  keeps lapsed directors from churning out entirely — the character keeps living
  (agents act on default policy per R2's Defense Policy table) even if the human
  never opens a letter, but the digest is the low-friction re-entry ramp.
- **Unsubscribe is per-character, not per-account.** A director may run multiple PCs
  (spec §2b) and want letters from the crew leader they're actively directing but not
  from a background character they're letting the Defense Policy run on autopilot.
  One-click unsubscribe link per email, scoped to `character_id`, writes to a new
  `afwar_profiles.muted_characters uuid[]` column (or a small join table if that gets
  unwieldy) — checked before any send, both letter and digest.
- **Plain-text aesthetic — letters, not newsletters.** No HTML template, no logo
  header, no "view in browser" bar. Plain text (or the barest markdown-to-text),
  monospace-friendly, signed by the character in voice. This is a tone-contract
  requirement as much as a growth one (README: "Never wink. Never explain the joke.")
  — a newsletter-styled email breaks character on contact. The existing narration
  prompts in `agents/narrate.ts` and the persona/voice fields on `afwar_characters`
  (`voice_notes`, `bio`) are the exact inputs the letter-composer prompt needs; no new
  voice infrastructure required, just a new prompt template alongside
  `agents/narrate.ts` and `agents/downtime.ts`.

---

## 1. CORE MECHANIC: THE CHARACTER LETTER

**After each round/tick, each character emails its owner IN VOICE.** Not a
notification. Not "Round 4 results are in." A letter from the character, written the
way that character talks (Canon Cast's `canon_notes` pattern from schema-002 — dated
behavior corrections injected into every prompt — is the proof this voice-consistency
approach already works in this codebase for NPCs; PCs get the same treatment off
their own `bio`/`voice_notes`/scars).

### 1a. Letter contents (every send)

1. **The recap** — what happened to *this character* this round, in their voice, at
   the emotional register their tone contract implies (comedy-surface, stakes
   underneath — spec §10.3). Pulls from the same beat-sheet + narration + judge
   verdict the feed post (`afwar_posts`) already renders from — this is a second
   render target off data that already exists per round, not new game logic.
2. **A question requiring Direction.** This is the load-bearing sentence in the whole
   growth spec: the letter doesn't just report, it asks. "Do I hit the Wormhole again
   or fall back to Greenpoint?" "Grumble Bee's crew burned my truce offer — do I let
   it go or do I make it a whole thing?" The question is generated from the SAME
   inputs the Directions UI (`afwar_directions`: `gambit`, `tone_note`, `vp_budget`,
   `ability_lane`) already structures — the letter is a second interface onto a
   mechanic the web app already has, reachable without opening a tab.

### 1b. REPLYING = submitting a Direction

This is the whole growth trick: **the reply-to address is the interface.** A director
hits reply in their normal email client — no login, no app open, no context-switch —
and that reply becomes a `afwar_directions` row for that character's next match/round.
Pipeline:

```
character letter sent (reply-to: a per-character or per-round token address)
  → director replies in Mail/Gmail/whatever
  → inbound webhook (Resend/Postmark) → web/app/api/email/inbound/route.ts
  → verify sender against auth.users email
  → parse reply body (strip quoted thread) → best-effort map to
    {gambit, tone_note, vp_budget, ability_lane} via a small LLM parse call
    (same OpenRouter client agents/llm.ts already wraps — no new provider)
  → insert afwar_directions row, service-role write (matches existing
    "directions: insert own" RLS pattern's INTENT even though this write
    comes from the server, not the user's session — use service_role like
    every other GM-cascade write)
  → confirmation is the NEXT letter's recap line ("got your note — here's
    what happened"), not a separate transactional email
```

This turns "directing IS the gameplay" (north-star §10b point 2) into something you
can do from a phone lock-screen notification. It is the single highest-leverage
retention mechanic in this spec because it collapses activation energy to zero:
replying to an email is a lower-friction action than most apps' entire onboarding.

---

## 2. VIRAL MECHANICS — all diegetic, never contact-scraping

**Hard rule, stated once so it governs everything below: AF WAR never auto-emails
anyone who hasn't opted in by an in-fiction action.** No "invite your contacts"
LinkedIn-style scrape-and-blast. That pattern is brand poison and spam-filter suicide,
and it breaks the tone contract on contact — nothing about it is in-world, it's an
app being an app. Every mechanic below routes virality through something a character
does, in the fiction, that a human then chooses to act on.

### 2a. Crew recruitment as an in-fiction ask

Crews are 2–6 PCs (spec §9a). A crew short of members isn't "the product asking you
to invite friends" — it's **the character requesting recruits**, same voice, same
letter channel as §1. "We're down a body since the Wormhole business. You know
anyone who'd want in?" This reuses the letter infrastructure entirely — it's a letter
variant (`kind = 'recruit'`), not a new system.

### 2b. THE PERSONALIZED INVITE COMIC

The highest-craft, highest-conversion mechanic in this spec, and it's the one piece
of genuinely new build work:

- **One NB2 panel** (the same render path `comic/render.ts` already uses for
  model-sheet-conditioned pages — see the sim's `sim/out/comic/` output,
  `sheet-sim.png` / `sheet-cobalt-fox.png` as the reference-image pattern already
  proven live) of your character **referencing the invitee by name** — "named in her
  will," or whatever the crew's fiction calls for. This is a single-panel generation,
  not a full page: cheap (the artifact ladder's "illustrated post" rung, spec §6 —
  cents, not the multi-page comic cost).
- **The invite artifact itself** is the panel + a short caption + a claim link. It is
  shareable on its own (text a friend a picture, don't text them a marketing link).
  The link resolves to a public-read page (§2d) — no login wall between "someone
  sent me this" and "I can see what this is."
- Build note: this is a new route, `web/app/api/invite/generate/route.ts`, that takes
  `{character_id, invitee_name, context}` and calls the existing fal/NB2 client with
  a one-panel prompt built from the character's `model_sheet_url` + `bio` +
  `canon_notes`-equivalent. Reuses `comic/render.ts`'s ref-locked generation pattern;
  does not need the multi-page self-check loop that full match comics use.

### 2c. Death → "avenge me" successor invites, inheriting a canon grudge

When a character dies (R14 finale deaths, Death Match stakes, R10 Blaze of Glory), the
death is already a `afwar_canon_events` row. The successor-invite mechanic: the dead
character's LAST letter is an invite — to a new director — carrying forward a
specific grudge (`event.killer_character_id` or equivalent from the canon event JSON)
that the new character starts play already owning. This is the rivalry-graph idea from
`north-star.md` Tier 3 wired directly into onboarding: your first letter as a new
player already has a villain named. It's the single most "wait, the GAME made this?"
onboarding moment available cheaply.

### 2d. PUBLIC-READ feed/match/ledger/map — gate actions only

**Non-negotiable UX law: shared links must never hit a login wall.** Someone clicking
an invite comic, a betting-arcade share, or a Ledger link should see the content
immediately. The existing route structure (`web/app/feed`, `web/app/map`,
`web/app/ledger`, `web/app/match/[id]`) needs an explicit audit against this rule —
today's RLS is `select to authenticated using (true)` on nearly every game table
(`afwar_posts`, `afwar_matches`, `afwar_canon_events`, `afwar_characters`), which
means the DATA is gated behind Supabase auth even though nothing in the design wants
it to be. **This is a real gap, not a hypothetical**: either (a) add an anonymous/
public Supabase role with the same read policies for these tables, or (b) render
public share pages server-side with the service-role key and skip client-side auth
entirely for `/match/[id]`, `/ledger`, `/map`, and a read-only `/feed` when accessed
without a session. Option (b) is less migration, ships faster, and matches how
`web/app/api/*` routes already use service-role reads elsewhere in the codebase.

This is the spectator→bettor→player funnel from north-star §10b point 4: you follow
the league (public read) before you roll a character (auth required only at
character-creation / Barracks / Direction-submission — i.e., anywhere a *write*
happens). Betting itself (`afwar_bets`) legitimately requires auth (it's a $BAMF
spend) — the rule is about *reads*, not every action.

### 2e. $BAMF referral both-sides + inviter cut of recruit's first-season tips

$BAMF already has a full ledger (`afwar_bamf_ledger`, schema-003: `delta`, `reason`,
`ref_id`) with a `faucet` reason already implemented (`web/app/api/bamf/faucet`) and a
`tip_sent`/`tip_received` pair already implemented (`web/app/api/bamf/tip`). Referral
adds two new `reason` values, no schema change needed:
- `referral_bonus` — both inviter and invitee get a faucet-sized $BAMF grant the
  moment the invitee creates their first character (ties to activation, §3).
- `referral_tip_cut` — a small percentage of the recruit's first-season tip income
  (`tip_total` on `afwar_posts`, schema-003) routes to the inviter as a
  `afwar_bamf_ledger` entry with `ref_id` pointing at the tipped post. This is
  economically the same shape as the anthology royalty split in spec §10c — creator
  economy logic the codebase already has the ledger primitive for.

Guardrail: this is a $BAMF-only mechanic (spectator currency, tips, betting stakes) —
it must never touch dice, stats, or territory, per the spec's NEVER-SELL list. A
referral bonus buys bragging rights and betting float, not a stronger character.

### 2f. Glome-radius scarcity = honest waitlists

R16's Glome mechanic (active map region scales with player count:
`max(8, 6 + ceil(players × 1.2))` zones) is already a real, mechanically-grounded
scarcity — not marketing copy pretending to be scarce. Growth copy should say exactly
that, because it's true: **"Season 2: 40 APE Passes remaining"** is honest when the
Glome's radius genuinely determines how many live PCs the map can support before
corruption/turf pressure gets silly. This is a copy/UX task on the signup surface
(`web/app/login` or a new landing surface), backed by a real query against
`count(afwar_characters where status = 'active' and season_id = current)` against the
current season's configured player cap — never a fake countdown.

---

## 3. METRICS

### 3a. K-factor components

```
K = (invites sent per activated director) × (invite → activation conversion rate)
```

Three invite surfaces feed K, tracked separately because they'll convert very
differently:
- **Crew recruitment letters** (§2a) — low-friction, low-conversion (asking a
  specific friend to join a specific crew is a real ask, not a link-share).
- **Personalized invite comics** (§2b) — the highest expected conversion: a
  named, illustrated, in-fiction artifact is qualitatively different from a
  generic invite link. This is the mechanic worth instrumenting first and best.
- **Successor/avenge-me invites** (§2c) — lower volume (gated by deaths) but likely
  the highest per-invite conversion, because the invitee inherits a ready-made
  story hook instead of a blank character sheet.

Instrumentation: every generated invite artifact gets a `ref_id` (reuse the
`afwar_bamf_ledger.ref_id` pattern, or a new lightweight `afwar_invites` table:
`id, inviter_character_id, kind, invitee_contact, claimed_by uuid nullable,
created_at`). K is computed as claimed/sent per kind per season.

### 3b. Activation

**Activation event: first character created** (`afwar_characters` insert with
`owner_id = auth.uid()`). This is the correct activation line, not signup/auth —
AF WAR's whole value prop (spec §0, "the game must be great FIRST") only exists once
someone has a PC in the world. A signed-up-but-characterless account is not yet a
player; measure funnel drop-off between auth (`auth.users` insert) and first
character specifically, since that gap is where onboarding friction (APE Pass,
tutorial match vs. Tricera-Cop per spec §10b) either works or doesn't.

### 3c. Retention

**Primary retention metric: letter open → direction reply rate.** This is the number
that validates or kills the whole growth spec, because it's the number that says
whether the letter mechanic is actually doing the directing-is-the-gameplay job or is
just a fancier notification. Formula:

```
reply_rate(round) = count(afwar_directions where round = N and character_id
                      in [characters whose owner got a letter for round N])
                    / count(letters sent for round N)
```

Requires the `afwar_email_log` table from §0's implementation notes (`opened_at`,
`replied_at`) joined against `afwar_directions.created_at` falling within the
following round's declaration window. Secondary retention signals worth watching
alongside it: digest-open rate (are lapsed directors coming back through the
low-friction path), and days-since-last-direction per character (a proxy for how
long a PC survives on default Defense Policy alone before its owner checks back in —
this number should be interesting either way: high means the autonomous-agent
premise works even when humans don't show up, low means humans are engaged, and
either failure mode is informative).

### 3d. Build order

**Public-read first. Letters second. Invite comic third.** This order is deliberate,
not arbitrary:

1. **Public-read (§2d)** ships first because every other viral mechanic terminates
   in a shared link, and if that link hits a login wall, every downstream mechanic's
   conversion is capped near zero regardless of how good the artifact is. This is
   also the cheapest of the three — it's an RLS/routing fix, not new generation
   pipeline, and it unblocks measuring whether spectator traffic exists at all
   before investing further.
2. **Letters (§1)** ship second because they're the retention engine and the
   infrastructure (inbound webhook, email log, digest) that every later viral
   mechanic (crew recruitment, avenge-me invites) reuses as its delivery channel.
   Building invites before letters means building the send/reply infra twice.
3. **The invite comic (§2b)** ships third because it's the only genuinely new
   generation-pipeline work in this spec (a new render route) and its ROI is
   highest once (a) public-read means the resulting link actually converts and
   (b) the letter/reply loop already proves people will act on an emailed
   in-fiction artifact. Building the most expensive artifact first, before either
   precondition is validated, risks polishing a mechanic nobody clicks through on.
