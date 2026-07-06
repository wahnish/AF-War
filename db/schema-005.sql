-- AF WAR — schema-005 (security fix, 2026-07-06)
-- ADDITIVE + ONE SAFE DROP. Paste into the Supabase SQL editor AFTER
-- db/schema.sql, db/schema-002.sql, db/schema-003.sql, and db/schema-004.sql.
-- Idempotent: every create uses IF NOT EXISTS / ON CONFLICT DO NOTHING /
-- DROP POLICY IF EXISTS so it's safe to re-run.
--
-- THE ISSUE (schema-002 §2's "documented gap"): afwar_profiles carries
-- openrouter_key, but "profiles: select all" (schema.sql) grants every
-- authenticated user SELECT on every column of every profile row — so any
-- logged-in player can read any other player's OpenRouter key straight off
-- the table, app-layer discipline notwithstanding. This closes that hole by
-- moving the secret to its own owner-only table.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. afwar_secrets — owner-only secret storage
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists afwar_secrets (
    user_id uuid primary key references auth.users (id) on delete cascade,
    openrouter_key text,
    updated_at timestamptz not null default now()
);

alter table afwar_secrets enable row level security;

drop policy if exists "secrets: select own" on afwar_secrets;
create policy "secrets: select own" on afwar_secrets
    for select to authenticated using (user_id = auth.uid());

drop policy if exists "secrets: insert own" on afwar_secrets;
create policy "secrets: insert own" on afwar_secrets
    for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "secrets: update own" on afwar_secrets;
create policy "secrets: update own" on afwar_secrets
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "secrets: service role all" on afwar_secrets;
create policy "secrets: service role all" on afwar_secrets
    for all to service_role using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. MIGRATE existing keys off afwar_profiles, then drop the leaking column
-- ═══════════════════════════════════════════════════════════════════════
insert into afwar_secrets (user_id, openrouter_key)
select id, openrouter_key from afwar_profiles
where openrouter_key is not null
on conflict (user_id) do nothing;

alter table afwar_profiles drop column if exists openrouter_key;

-- model_tier / model_name stay on afwar_profiles — not secrets, and other
-- players/the GM engine's crew-listing UIs are fine seeing "byo" vs "house"
-- and a model name. Only the raw API key needed to move.
