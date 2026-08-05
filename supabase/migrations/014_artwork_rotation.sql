-- Migration 014: artwork rotation and cut-plane alignment
--
-- The normalizer corrects the rotation of the GENERATED HEX BASE, which it can
-- measure. It cannot know which way the artwork should face on that base, so that
-- needs to be a human decision.
alter table public.tile_jobs
  add column if not exists artwork_rot double precision not null default 0,
  add column if not exists align_cut   boolean not null default false;

alter table public.tile_jobs drop constraint if exists tile_jobs_artwork_rot_range;
alter table public.tile_jobs add constraint tile_jobs_artwork_rot_range
  check (artwork_rot between -180 and 180);
