-- AF WAR — schema-003 (final polish round, 2026-07-06)
-- ADDITIVE ONLY. Paste into the Supabase SQL editor AFTER db/schema.sql and
-- db/schema-002.sql. Idempotent: every create uses IF NOT EXISTS / ON CONFLICT
-- DO NOTHING / ADD COLUMN IF NOT EXISTS so it's safe to re-run.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. $BAMF LEDGER — every $BAMF mutation is recorded here (web/lib/bamf.ts
--    is the only writer; profiles.bamf is the cached running balance).
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists afwar_bamf_ledger (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    delta int not null,
    reason text not null,        -- 'faucet' | 'tip_sent' | 'tip_received' | 'comic_render' |
                                  -- 'sheet_gen' | 'bet_stake' | 'bet_payout' | 'admin_adjust' | ...
    ref_id uuid,                 -- optional: post id, match id, character id, etc.
    created_at timestamptz not null default now()
);

alter table afwar_bamf_ledger enable row level security;

drop policy if exists "bamf_ledger: select own" on afwar_bamf_ledger;
create policy "bamf_ledger: select own" on afwar_bamf_ledger
    for select to authenticated using (user_id = auth.uid());

drop policy if exists "bamf_ledger: service role writes" on afwar_bamf_ledger;
create policy "bamf_ledger: service role writes" on afwar_bamf_ledger
    for all to service_role using (true) with check (true);

create index if not exists afwar_bamf_ledger_user_created_idx
    on afwar_bamf_ledger (user_id, created_at desc);

create index if not exists afwar_bamf_ledger_user_reason_created_idx
    on afwar_bamf_ledger (user_id, reason, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. TIPS — tip count per post. Stored as a dedicated column (simpler +
--    indexable than reaching into media jsonb; documented here per the brief).
-- ═══════════════════════════════════════════════════════════════════════
alter table afwar_posts add column if not exists tip_count int not null default 0;
alter table afwar_posts add column if not exists tip_total int not null default 0;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. SEASON LOOT — the display+lore layer over engine ITEMS (engine/match.ts
--    ITEMS remain the mechanical source of truth; afwar_items is generated
--    flavor + a map-visible drop. KNOWN SEAM (see web/lib/loot.ts): the two
--    tracks are not unified — an engine item drop (season state
--    zones[zid].itemOnGround) and an afwar_items row are separate records
--    that happen to reference the same effect_template/zone in the common
--    case. Unify post-v1 if this doubles up confusingly for players.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists afwar_items (
    id uuid primary key default gen_random_uuid(),
    season_id uuid not null references afwar_seasons (id) on delete cascade,
    name text not null,
    lore text,
    art_url text,
    effect_template text not null,   -- 'forces_death' | 'forces_corruption' | 'landwaster'
    zone_id text not null,
    holder_character uuid references afwar_characters (id),
    status text not null default 'ground',  -- 'ground' | 'held' | 'lost'
    created_at timestamptz not null default now()
);

alter table afwar_items enable row level security;

drop policy if exists "items: select all" on afwar_items;
create policy "items: select all" on afwar_items
    for select to authenticated using (true);

drop policy if exists "items: service role writes" on afwar_items;
create policy "items: service role writes" on afwar_items
    for all to service_role using (true) with check (true);

create index if not exists afwar_items_season_status_idx
    on afwar_items (season_id, status);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. CRON GM — season.config gains lastTick/cadenceHours (read/written as
--    plain jsonb keys, no migration needed beyond the season already having
--    a config column — noted here for discoverability):
--    config.lastTick: ISO timestamp of the last cron-driven resolve
--    config.cadenceHours: number, default 24 if absent
-- ═══════════════════════════════════════════════════════════════════════
-- (no DDL needed — config is already jsonb on afwar_seasons per schema.sql)
