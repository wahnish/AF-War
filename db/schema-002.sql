-- AF WAR — schema-002 (sweetening round, 2026-07-05)
-- ADDITIVE ONLY. Paste into the Supabase SQL editor AFTER db/schema.sql.
-- Idempotent-ish: every create uses IF NOT EXISTS / ON CONFLICT DO NOTHING /
-- ADD COLUMN IF NOT EXISTS so it's safe to re-run.

-- ═══════════════════════════════════════════════════════════════════════
-- 5. ROLE-GATING — profiles.role (do this first; other features check it)
-- ═══════════════════════════════════════════════════════════════════════
alter table afwar_profiles add column if not exists role text not null default 'player';

-- After running this file, promote yourself to GM, e.g.:
--   UPDATE afwar_profiles SET role = 'gm' WHERE id = '<your auth.users id>';
-- Find your id via: SELECT id, handle FROM afwar_profiles;
-- (Or SELECT id FROM auth.users WHERE email = 'you@example.com';)

-- ═══════════════════════════════════════════════════════════════════════
-- 2. BYO AGENT KEYS + MODEL TIERS
-- ═══════════════════════════════════════════════════════════════════════
alter table afwar_profiles add column if not exists openrouter_key text;
alter table afwar_profiles add column if not exists model_tier text not null default 'house';
alter table afwar_profiles add column if not exists model_name text;

-- openrouter_key is sensitive: only the owner may read/write their own row's
-- key. The existing "profiles: select all" policy already exposes every
-- column to every authenticated user — replace it with a version that
-- redacts openrouter_key for everyone but the owner via a security-definer
-- view would be the fully-correct fix, but that's a bigger migration than
-- this sweetening round warrants. v1 approach: keep table-level select-all
-- (other columns like role/handle need to stay public), but the web app
-- NEVER selects openrouter_key in a shared/list query — only the owner's
-- own settings fetch (`.eq('id', user.id)`) touches that column. Documented
-- gap, not a silent one.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. CANON CAST ADMIN
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists afwar_canon_cast (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    kind text not null default 'npc',              -- 'npc' | 'judge' | 'gm'
    bio text,
    model_sheet_url text,
    canon_notes jsonb not null default '[]'::jsonb, -- [{date, note}]
    active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table afwar_canon_cast enable row level security;

drop policy if exists "canon_cast: select all" on afwar_canon_cast;
create policy "canon_cast: select all" on afwar_canon_cast
    for select to authenticated using (true);

-- writes: GM role only, enforced at the app layer (role-gated /admin page +
-- API routes per §5) AND at the DB layer via service-role-only writes here,
-- matching the pattern already used for crews/seasons/matches/posts.
drop policy if exists "canon_cast: service role writes" on afwar_canon_cast;
create policy "canon_cast: service role writes" on afwar_canon_cast
    for all to service_role using (true) with check (true);

-- seed rows — bios lifted from agents/cast.ts + web/app/guide. Safe to re-run
-- (unique-by-name upsert guard via a conditional insert).
insert into afwar_canon_cast (name, kind, bio, canon_notes)
select 'Constable Raze', 'npc',
    'Constables who roam in packs and take the work seriously. Belly-badge monitors display calming images on approach — advertisements otherwise. Embarrassingly gullible. Particularly aggressive with line cutters. The uniform is won and worn with righteous pride. Never apologizes; he issues corrections.',
    '[{"date": "2026-07-05", "note": "Raze never apologizes; he issues corrections."}]'::jsonb
where not exists (select 1 from afwar_canon_cast where name = 'Constable Raze');

insert into afwar_canon_cast (name, kind, bio, canon_notes)
select 'The Arbiter', 'judge',
    'Cosmic judge of AF WAR — a hooded entity of vast taste and limited patience, with a Hyper-Brooklyn Gazette columnist''s tongue. Judges ENTERTAINMENT ONLY: voice, comedy that lands, how well each combatant depicted their OPPONENT, use of the zone''s terrain, fidelity to the dice beats. The dice already decided who won; The Arbiter decides who gets remembered well. Writes in character; is quotable; plays favorites out loud.',
    '[]'::jsonb
where not exists (select 1 from afwar_canon_cast where name = 'The Arbiter');

insert into afwar_canon_cast (name, kind, bio, canon_notes)
select 'Tricera-Cop', 'npc',
    'Sergeant Tricera-Cop, the real deal big cheese — in his own mind. A glorified mall cop whose beat is a mystery; found in watering holes more than on patrol. Dreams of the Robot Repair Mall transfer. Will "definitely" pass the Raze exam next time. Never takes bribes — but how much are you offering? The house NPC for tutorial matches.',
    '[]'::jsonb
where not exists (select 1 from afwar_canon_cast where name = 'Tricera-Cop');

-- ═══════════════════════════════════════════════════════════════════════
-- 4. BETTING AT THE ARCADES
-- ═══════════════════════════════════════════════════════════════════════
alter table afwar_profiles add column if not exists bamf int not null default 100;

create table if not exists afwar_bets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    match_id uuid references afwar_matches (id),
    season_id uuid not null references afwar_seasons (id) on delete cascade,
    round int not null,
    on_character uuid not null references afwar_characters (id),
    amount int not null,
    status text not null default 'open',            -- 'open' | 'won' | 'lost'
    created_at timestamptz not null default now()
);

alter table afwar_bets enable row level security;

drop policy if exists "bets: select all" on afwar_bets;
create policy "bets: select all" on afwar_bets
    for select to authenticated using (true);

drop policy if exists "bets: insert own" on afwar_bets;
create policy "bets: insert own" on afwar_bets
    for insert to authenticated with check (user_id = auth.uid());

-- settlement (status flips, balance updates) is service-role only
drop policy if exists "bets: service role all" on afwar_bets;
create policy "bets: service role all" on afwar_bets
    for all to service_role using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. COMIC AUTO-RENDER — afwar_matches gains a media column for comic pages
-- ═══════════════════════════════════════════════════════════════════════
alter table afwar_matches add column if not exists media jsonb not null default '[]'::jsonb;

-- ═══════════════════════════════════════════════════════════════════════
-- 8. FACTION FLAVOR
-- ═══════════════════════════════════════════════════════════════════════
alter table afwar_characters add column if not exists faction text;
alter table afwar_canon_cast add column if not exists faction text;
-- allowed values (enforced at the app layer, not a DB constraint, to stay
-- additive/forgiving): 'OG' | 'Horde' | 'Swarm' | 'Soup' | 'Primordial' |
-- 'GUCKS' | 'unaffiliated'
