-- ============================================================
-- Migration 007: Rename alex_tip → alex_dream, fix tile type constraint
-- These changes were applied to the live DB in Plan 7.
-- This migration ensures a fresh DB setup is correct.
-- ============================================================

-- 1. Rename alex_tip column to alex_dream on stories table
alter table public.stories rename column alex_tip to alex_dream;

-- 2. Remove mother_tree from tile type constraint
alter table public.tiles drop constraint tiles_type_check;
alter table public.tiles add constraint tiles_type_check
  check (type in ('undefined', 'story', 'terrain'));

-- 3. Migrate any remaining mother_tree tiles to story type (safety net)
update public.tiles set type = 'story' where type = 'mother_tree';
