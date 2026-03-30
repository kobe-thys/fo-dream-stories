-- ============================================================
-- Migration 006: 3D map foundation
-- Creates stories table, alters tiles, resets tile data
-- ============================================================

-- 1. New stories table
create table public.stories (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null,
  story_text              text,
  audio_url               text,
  alex_tip                text,
  default_token_image_url text,
  alex_dream_image_url    text,
  fo_image_url            text,
  created_at              timestamptz not null default now()
);

alter table public.stories enable row level security;

create policy "Stories readable by authenticated users"
  on public.stories for select
  using (auth.uid() is not null);

grant select on public.stories to authenticated;
grant select, insert, update, delete on public.stories to service_role;

-- 2. Reset tile-related child data (beta only — safe to wipe)
delete from public.child_tile_states;
delete from public.dream_submissions;
delete from public.tile_unlocks;
delete from public.tiles;

-- 3. Alter tiles table
-- Add new columns
alter table public.tiles
  add column model      text,
  add column rotation   integer not null default 0,
  add column story_id   uuid references public.stories(id) on delete set null;

-- Extend type CHECK to include 'undefined'
alter table public.tiles
  drop constraint tiles_type_check;
alter table public.tiles
  add constraint tiles_type_check
  check (type in ('undefined', 'mother_tree', 'story', 'terrain'));

-- Make name nullable (undefined tiles have no display name)
alter table public.tiles
  alter column name drop not null;

-- Drop story content columns (content moves to stories table)
alter table public.tiles
  drop column story_text,
  drop column audio_url,
  drop column alex_tip,
  drop column alex_dream_image_url,
  drop column default_token_image_url;

-- 4. Ensure service_role has full access to all tables
grant select, insert, update, delete on all tables in schema public to service_role;
