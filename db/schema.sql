-- AF WAR — Supabase schema (paste into the SQL editor)
-- All game tables prefixed afwar_. RLS on for everything.
-- Writes to game-state tables (seasons/matches/posts/canon_events/crews) are
-- restricted to service_role — that's the GM engine's seam (web/app/api/gm/resolve).

create extension if not exists "pgcrypto";

-- ── profiles ─────────────────────────────────────────────────────────────
create table if not exists afwar_profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    handle text unique,
    created_at timestamptz not null default now()
);

alter table afwar_profiles enable row level security;

create policy "profiles: select all" on afwar_profiles
    for select to authenticated using (true);

create policy "profiles: insert self" on afwar_profiles
    for insert to authenticated with check (id = auth.uid());

create policy "profiles: update self" on afwar_profiles
    for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ── crews ────────────────────────────────────────────────────────────────
create table if not exists afwar_crews (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    motto text,
    created_at timestamptz not null default now()
);

alter table afwar_crews enable row level security;

create policy "crews: select all" on afwar_crews
    for select to authenticated using (true);

-- writes: GM engine only
create policy "crews: service role writes" on afwar_crews
    for all to service_role using (true) with check (true);

-- ── characters ───────────────────────────────────────────────────────────
create table if not exists afwar_characters (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    archetype text,
    stats jsonb not null default '{}'::jsonb,          -- {STR,END,DEX,CHA,INT} die sizes
    attack_ability text,
    power jsonb not null default '{}'::jsonb,           -- {name, level}
    policy jsonb not null default '{}'::jsonb,          -- {resistVs[], counterWhenHpAbove, spendVpAtMatchPoint, blazeOfGloryIfDying}
    bio text,
    voice_notes text,
    model_sheet_url text,
    status text not null default 'active',
    scars jsonb not null default '[]'::jsonb,
    kills int not null default 0,
    clout int not null default 0,
    crew_id uuid references afwar_crews (id),
    created_at timestamptz not null default now()
);

alter table afwar_characters enable row level security;

create policy "characters: select all" on afwar_characters
    for select to authenticated using (true);

create policy "characters: insert own" on afwar_characters
    for insert to authenticated with check (owner_id = auth.uid());

create policy "characters: update own" on afwar_characters
    for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "characters: delete own" on afwar_characters
    for delete to authenticated using (owner_id = auth.uid());

-- ── seasons ──────────────────────────────────────────────────────────────
create table if not exists afwar_seasons (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    config jsonb not null default '{}'::jsonb,
    state jsonb,                                        -- serialized SeasonState (web/lib/engine/serialize.ts)
    status text not null default 'setup',
    created_at timestamptz not null default now()
);

alter table afwar_seasons enable row level security;

create policy "seasons: select all" on afwar_seasons
    for select to authenticated using (true);

create policy "seasons: service role writes" on afwar_seasons
    for all to service_role using (true) with check (true);

-- ── matches ──────────────────────────────────────────────────────────────
create table if not exists afwar_matches (
    id uuid primary key default gen_random_uuid(),
    season_id uuid not null references afwar_seasons (id) on delete cascade,
    round int not null,
    zone_id text not null,
    stakes text not null,
    a_character uuid references afwar_characters (id),
    b_character uuid references afwar_characters (id),
    dice_transcript jsonb,
    tellings jsonb not null default '[]'::jsonb,
    verdict jsonb,
    winner uuid,
    created_at timestamptz not null default now()
);

alter table afwar_matches enable row level security;

create policy "matches: select all" on afwar_matches
    for select to authenticated using (true);

create policy "matches: service role writes" on afwar_matches
    for all to service_role using (true) with check (true);

-- ── posts (the Feed) ────────────────────────────────────────────────────
create table if not exists afwar_posts (
    id uuid primary key default gen_random_uuid(),
    season_id uuid references afwar_seasons (id) on delete cascade,
    author_character uuid references afwar_characters (id),
    kind text not null,                                 -- 'gazette' | 'match' | 'downtime' | 'system'
    title text not null,
    body text not null,
    media jsonb not null default '[]'::jsonb,
    round int,
    created_at timestamptz not null default now()
);

alter table afwar_posts enable row level security;

create policy "posts: select all" on afwar_posts
    for select to authenticated using (true);

create policy "posts: service role writes" on afwar_posts
    for all to service_role using (true) with check (true);

-- ── canon_events ─────────────────────────────────────────────────────────
create table if not exists afwar_canon_events (
    id uuid primary key default gen_random_uuid(),
    season_id uuid not null references afwar_seasons (id) on delete cascade,
    round int not null,
    event jsonb not null,
    created_at timestamptz not null default now()
);

alter table afwar_canon_events enable row level security;

create policy "canon_events: select all" on afwar_canon_events
    for select to authenticated using (true);

create policy "canon_events: service role writes" on afwar_canon_events
    for all to service_role using (true) with check (true);

-- ── directions (director influence on their PC's next match) ───────────
create table if not exists afwar_directions (
    id uuid primary key default gen_random_uuid(),
    match_id uuid references afwar_matches (id),
    season_id uuid not null references afwar_seasons (id) on delete cascade,
    round int not null,
    character_id uuid not null references afwar_characters (id),
    director_id uuid not null references auth.users (id),
    gambit text,
    tone_note text,
    vp_budget int,
    ability_lane text,
    created_at timestamptz not null default now()
);

alter table afwar_directions enable row level security;

create policy "directions: select all" on afwar_directions
    for select to authenticated using (true);

create policy "directions: insert own" on afwar_directions
    for insert to authenticated with check (director_id = auth.uid());

create policy "directions: update own" on afwar_directions
    for update to authenticated using (director_id = auth.uid()) with check (director_id = auth.uid());

-- ── storage: model sheets bucket ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('sheets', 'sheets', true)
on conflict (id) do nothing;

create policy "sheets: public read"
    on storage.objects for select
    using (bucket_id = 'sheets');

create policy "sheets: authenticated upload"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'sheets');

create policy "sheets: authenticated update own"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'sheets' and owner = auth.uid())
    with check (bucket_id = 'sheets' and owner = auth.uid());
