-- AF WAR — schema-004 (growth round, 2026-07-06)
-- ADDITIVE ONLY. Paste into the Supabase SQL editor AFTER db/schema.sql,
-- db/schema-002.sql, and db/schema-003.sql. Idempotent: every create uses
-- IF NOT EXISTS / ON CONFLICT DO NOTHING / ADD COLUMN IF NOT EXISTS /
-- DROP POLICY IF EXISTS so it's safe to re-run.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. OPEN THE FRONT DOOR — public-read (anon) SELECT policies, ADDITIVE to
--    the existing "select to authenticated" policies (those stay as-is).
--    afwar_profiles, afwar_bamf_ledger, afwar_directions, afwar_bets are
--    DELIBERATELY EXCLUDED — those stay authenticated-only.
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "posts: select anon" on afwar_posts;
create policy "posts: select anon" on afwar_posts
    for select to anon using (true);

drop policy if exists "matches: select anon" on afwar_matches;
create policy "matches: select anon" on afwar_matches
    for select to anon using (true);

drop policy if exists "seasons: select anon" on afwar_seasons;
create policy "seasons: select anon" on afwar_seasons
    for select to anon using (true);

drop policy if exists "canon_events: select anon" on afwar_canon_events;
create policy "canon_events: select anon" on afwar_canon_events
    for select to anon using (true);

drop policy if exists "crews: select anon" on afwar_crews;
create policy "crews: select anon" on afwar_crews
    for select to anon using (true);

drop policy if exists "characters: select anon" on afwar_characters;
create policy "characters: select anon" on afwar_characters
    for select to anon using (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. CREW DIRECTORY + SLOTS
-- ═══════════════════════════════════════════════════════════════════════
alter table afwar_crews add column if not exists max_size int not null default 6;
alter table afwar_crews add column if not exists founder_id uuid references auth.users (id);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. INVITES AS IN-FICTION ARTIFACTS + $BAMF REFERRAL
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists afwar_invites (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    inviter_id uuid not null references auth.users (id) on delete cascade,
    crew_id uuid references afwar_crews (id),
    kind text not null default 'general', -- 'crew' | 'avenge' | 'general'
    invitee_name text,
    comic_url text,
    grudge jsonb,
    character_id uuid references afwar_characters (id),
    uses int not null default 0,
    max_uses int not null default 5,
    created_at timestamptz not null default now()
);

alter table afwar_invites enable row level security;

-- public-read (shared invite links must never hit a login wall, growth-spec
-- §2d). Split authenticated/anon rather than the combined `to authenticated,
-- anon` role-list syntax, to match the two-policies-per-table style already
-- used everywhere else in this repo (schema.sql/002/003 never combine roles
-- in one policy) — purely a style choice, both are valid Postgres.
drop policy if exists "invites: select authenticated" on afwar_invites;
create policy "invites: select authenticated" on afwar_invites
    for select to authenticated using (true);

drop policy if exists "invites: select anon" on afwar_invites;
create policy "invites: select anon" on afwar_invites
    for select to anon using (true);

drop policy if exists "invites: insert own" on afwar_invites;
create policy "invites: insert own" on afwar_invites
    for insert to authenticated with check (inviter_id = auth.uid());

drop policy if exists "invites: service role writes" on afwar_invites;
create policy "invites: service role writes" on afwar_invites
    for all to service_role using (true) with check (true);

create index if not exists afwar_invites_code_idx on afwar_invites (code);
create index if not exists afwar_invites_inviter_idx on afwar_invites (inviter_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. CHARACTER LETTERS — per-character opt-out
-- ═══════════════════════════════════════════════════════════════════════
alter table afwar_characters add column if not exists letters_enabled boolean not null default true;
