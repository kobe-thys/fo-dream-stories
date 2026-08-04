-- Migration 012: base colours + an adjust pass on a built tile
--
-- Two gaps the first version left:
--   1. The rebuilt prism takes its colour by SAMPLING the artwork's outer wall,
--      which gave pegasus a green base. There was no way to override it.
--   2. Once a tile was built you could only accept or discard it. Nudging the
--      artwork on its plate meant a full re-normalize (minutes) for a 2% tweak.
--
-- The adjust pass re-uses the already-built GLB, so it is seconds rather than
-- minutes: preview_ready -> adjust -> preview_ready, as many times as you like.

alter table public.tile_jobs
  add column if not exists base_top_color  text,
  add column if not exists base_side_color text,
  add column if not exists shift_x   double precision not null default 0,
  add column if not exists shift_z   double precision not null default 0,
  add column if not exists top_scale double precision not null default 1;

-- Hex colours only — these reach a CLI flag, so the shape is constrained here too.
alter table public.tile_jobs drop constraint if exists tile_jobs_base_top_color_hex;
alter table public.tile_jobs add constraint tile_jobs_base_top_color_hex
  check (base_top_color is null or base_top_color ~ '^#[0-9a-fA-F]{6}$');

alter table public.tile_jobs drop constraint if exists tile_jobs_base_side_color_hex;
alter table public.tile_jobs add constraint tile_jobs_base_side_color_hex
  check (base_side_color is null or base_side_color ~ '^#[0-9a-fA-F]{6}$');

-- Keep the nudge within sane bounds; the worker clamps too.
alter table public.tile_jobs drop constraint if exists tile_jobs_adjust_range;
alter table public.tile_jobs add constraint tile_jobs_adjust_range
  check (shift_x between -0.5 and 0.5
     and shift_z between -0.5 and 0.5
     and top_scale between 0.5 and 2.0);

alter table public.tile_jobs drop constraint if exists tile_jobs_status_check;
alter table public.tile_jobs add constraint tile_jobs_status_check
  check (status in ('queued','running','preview_ready','adjust','accepted','installed','failed'));
