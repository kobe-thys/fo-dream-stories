-- Migration 013: compose jobs
--
-- A compose job pairs two models already in public/models instead of an upload:
-- base + overlay, positioned. It reuses the whole normalize pipeline -- worker,
-- preview, adjust, accept, install -- so the only new inputs are which two models
-- and where the overlay goes.
alter table public.tile_jobs
  add column if not exists kind          text not null default 'normalize',
  add column if not exists base_model    text,
  add column if not exists overlay_model text,
  add column if not exists overlay_rot   integer not null default 0;

alter table public.tile_jobs alter column source_path drop not null;
alter table public.tile_jobs alter column surface drop not null;

alter table public.tile_jobs drop constraint if exists tile_jobs_kind_check;
alter table public.tile_jobs add constraint tile_jobs_kind_check
  check (kind in ('normalize','compose'));

-- Model names reach the filesystem, so constrain them here as well as in the API.
alter table public.tile_jobs drop constraint if exists tile_jobs_models_safe;
alter table public.tile_jobs add constraint tile_jobs_models_safe
  check ((base_model    is null or base_model    ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{0,60}\.glb$')
     and (overlay_model is null or overlay_model ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{0,60}\.glb$'));

alter table public.tile_jobs drop constraint if exists tile_jobs_rot_range;
alter table public.tile_jobs add constraint tile_jobs_rot_range
  check (overlay_rot between 0 and 5);
