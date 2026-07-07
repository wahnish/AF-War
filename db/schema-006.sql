-- AF WAR — schema-006 (tutorial match, 2026-07-07)
-- ADDITIVE ONLY. Paste into the Supabase SQL editor AFTER db/schema.sql,
-- db/schema-002.sql, db/schema-003.sql, db/schema-004.sql, and db/schema-005.sql.
-- Idempotent: every change uses ALTER ... IF (NOT) EXISTS / ADD COLUMN IF NOT
-- EXISTS so it's safe to re-run.

-- ═══════════════════════════════════════════════════════════════════════
-- TUTORIAL MATCHES — every new director gets a free, no-stakes match vs the
-- house NPC Tricera-Cop (agents/cast.ts / afwar_canon_cast) before their
-- first real season match. Two schema gaps to close:
--
--   1. season_id is NOT NULL on afwar_matches (schema.sql) — a tutorial
--      match has no season, so this must relax to nullable.
--   2. b_character is `references afwar_characters (id)` with no row for
--      Tricera-Cop — he's a hardcoded NPC (agents/cast.ts), never inserted
--      into afwar_characters. b_character is ALREADY nullable (no NOT NULL
--      in schema.sql), so the FK itself doesn't need to change — we just
--      leave b_character NULL for NPC opponents and add a plain text
--      column to hold the opponent's display name for matches where there
--      is no afwar_characters row to join against. This is the minimal
--      option: no new table, no relaxed FK, just one nullable text column.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. season has no meaning for a tutorial match
alter table afwar_matches alter column season_id drop not null;

-- 2. is_tutorial flag + opponent display name for NPC (non-FK) opponents
alter table afwar_matches add column if not exists is_tutorial boolean not null default false;
alter table afwar_matches add column if not exists b_character_name text;

create index if not exists afwar_matches_tutorial_a_character_idx
    on afwar_matches (a_character) where is_tutorial;
