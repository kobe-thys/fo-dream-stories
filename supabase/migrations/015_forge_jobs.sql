-- Migration 015: forge jobs — a tile from a written idea
--
-- The forge adds two stages in front of the existing pipeline:
--
--   idea -> concept drawing -> (revise)* -> APPROVED -> Meshy -> normalize ->
--   kenney-flatten -> preview -> accept -> install
--
-- Only the last half is worker work. Drawing a concept is one API call of a few
-- seconds, so it runs on Vercel and never touches this table: the admin page
-- iterates on the drawing, and a row is written only when a drawing is approved.
-- That keeps the queue free of abandoned drafts and the loop feeling interactive.
--
-- SECURITY -- the important line in this file.
-- `idea` is FREE-FORM TEXT written on a public-internet admin page, and this table
-- is consumed by a process on a personal machine that builds argv from it. `idea`
-- must therefore NEVER reach the worker's argv or any command. It is stored for
-- display only. What the worker consumes is `concept_path` -- an object key it
-- downloads -- plus numbers. That is why the drawing is generated on Vercel rather
-- than by passing the prompt through to the worker.

alter table public.tile_jobs
  add column if not exists idea          text,
  add column if not exists concept_path  text,
  add column if not exists polycount     integer not null default 10000,
  add column if not exists skirt         double precision;

alter table public.tile_jobs drop constraint if exists tile_jobs_kind_check;
alter table public.tile_jobs add constraint tile_jobs_kind_check
  check (kind in ('normalize','compose','forge'));

-- The object key reaches a storage download, so keep its shape tight here too.
alter table public.tile_jobs drop constraint if exists tile_jobs_concept_path_safe;
alter table public.tile_jobs add constraint tile_jobs_concept_path_safe
  check (concept_path is null or concept_path ~ '^concepts/[A-Za-z0-9._-]{1,120}\.png$');

alter table public.tile_jobs drop constraint if exists tile_jobs_polycount_range;
alter table public.tile_jobs add constraint tile_jobs_polycount_range
  check (polycount between 1000 and 100000);

-- --skirt=Y forces faces below Y onto Kenney dirt. Null means "leave the base".
alter table public.tile_jobs drop constraint if exists tile_jobs_skirt_range;
alter table public.tile_jobs add constraint tile_jobs_skirt_range
  check (skirt is null or skirt between 0 and 2);

-- Keep the idea short enough to display and to bound the row.
alter table public.tile_jobs drop constraint if exists tile_jobs_idea_len;
alter table public.tile_jobs add constraint tile_jobs_idea_len
  check (idea is null or char_length(idea) <= 2000);
