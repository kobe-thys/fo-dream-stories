-- Tiles: the hex grid nodes (story tiles, terrain tiles, Mother Tree)
create table public.tiles (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('mother_tree', 'story', 'terrain')),
  name text not null,
  position_q integer not null,
  position_r integer not null,
  terrain_type text check (terrain_type in ('forest', 'land', 'water', 'mountain')),
  story_text text,
  audio_url text,
  alex_tip text,
  sensory_moment_text text,
  default_token_image_url text,
  created_at timestamptz not null default now(),
  unique (position_q, position_r)
);
alter table public.tiles enable row level security;
create policy "Tiles readable by authenticated users"
  on public.tiles for select
  using (auth.uid() is not null);

-- Tile unlocks: the directed graph of story progression
create table public.tile_unlocks (
  id uuid primary key default gen_random_uuid(),
  from_tile_id uuid not null references public.tiles(id) on delete cascade,
  to_tile_id uuid not null references public.tiles(id) on delete cascade,
  unique (from_tile_id, to_tile_id)
);
alter table public.tile_unlocks enable row level security;
create policy "Tile unlocks readable by authenticated users"
  on public.tile_unlocks for select
  using (auth.uid() is not null);

-- Child tile states: per-child progress on every tile
create table public.child_tile_states (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  tile_id uuid not null references public.tiles(id) on delete cascade,
  state text not null check (state in ('locked', 'unlocked', 'listened', 'completed')),
  listened_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (child_profile_id, tile_id)
);
alter table public.child_tile_states enable row level security;
create policy "Families can manage their children tile states"
  on public.child_tile_states for all
  using (
    auth.uid() = (
      select family_id from public.child_profiles where id = child_profile_id
    )
  )
  with check (
    auth.uid() = (
      select family_id from public.child_profiles where id = child_profile_id
    )
  );

-- Grants (Supabase does not auto-grant for tables created via SQL editor)
grant select on public.tiles to authenticated;
grant select on public.tile_unlocks to authenticated;
grant all on public.child_tile_states to authenticated;
