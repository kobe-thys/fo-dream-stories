-- Migration 011: tile normalization jobs
--
-- The admin normalizer tab cannot run the normalizer itself: heavy tiles need
-- minutes and ~8 GB of RAM, far past Vercel's serverless limits, and public/ is
-- not writable in production. So the admin page only ENQUEUES work here, and a
-- worker on Kobe's box polls this table, does the job, and reports back.
--
-- Security note: this row is written from a public-internet admin page and then
-- acted on by a process on a personal machine. It therefore carries only a
-- CONSTRAINED job description -- numbers and an enum -- never a command string
-- or free-form flags. The worker must never execute anything derived from here
-- beyond these typed fields.

create table if not exists public.tile_jobs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- input
  source_path   text not null,                   -- object key in the tile-sources bucket
  output_name   text not null,                   -- "syrup-tree.glb"
  surface       double precision not null,       -- target plate top: 0.200 land, 0.100 water
  base_top      double precision,                -- optional --base-top override
  budget        integer not null default 8000,
  match_water   boolean not null default false,
  palette_lock  boolean not null default true,
  rebuild_base  boolean not null default true,

  -- lifecycle: queued -> running -> preview_ready -> accepted -> installed
  --                              \-> failed
  status        text not null default 'queued'
                check (status in ('queued','running','preview_ready','accepted','installed','failed')),

  -- output
  preview_url   text,
  log           text,
  measured_r          double precision,
  measured_plate_top  double precision,
  triangles     integer,
  bytes         integer
);

create index if not exists tile_jobs_status_idx on public.tile_jobs (status, created_at);

alter table public.tile_jobs enable row level security;

-- Admins only. The worker uses the service role, which bypasses RLS.
drop policy if exists "admins manage tile jobs" on public.tile_jobs;
create policy "admins manage tile jobs" on public.tile_jobs
  for all
  using (exists (select 1 from public.families where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.families where id = auth.uid() and is_admin = true));

grant all on public.tile_jobs to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

create or replace function public.touch_tile_jobs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists tile_jobs_touch on public.tile_jobs;
create trigger tile_jobs_touch before update on public.tile_jobs
  for each row execute function public.touch_tile_jobs_updated_at();
