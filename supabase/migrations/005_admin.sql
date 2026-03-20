-- Add is_admin flag to families
alter table public.families
  add column if not exists is_admin boolean not null default false;

-- App-wide settings (single row, id = 1)
create table if not exists public.app_settings (
  id        integer primary key default 1 check (id = 1),
  beta_cap  integer not null default 100,
  beta_open boolean not null default true
);
insert into public.app_settings (id, beta_cap, beta_open)
  values (1, 100, true)
  on conflict (id) do nothing;

-- Admin can read/write app_settings; public cannot
alter table public.app_settings enable row level security;
create policy "Admin full access to app_settings"
  on public.app_settings for all
  using (
    exists (select 1 from public.families where id = auth.uid() and is_admin = true)
  );

grant select, insert, update, delete on public.app_settings to authenticated;
