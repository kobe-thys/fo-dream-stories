-- Plan 3: dream_submissions table + alex_dream_image_url on tiles

-- Add alex_dream_image_url to tiles (nullable — flip mechanic disabled when null)
alter table public.tiles add column if not exists alex_dream_image_url text;

-- dream_submissions table
create table public.dream_submissions (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  tile_id uuid not null references public.tiles(id) on delete cascade,
  input_type text not null check (input_type in ('text', 'voice', 'drawing')),
  raw_input_url text,
  transcribed_text text,
  generated_image_url text,
  token_image_url text,
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.dream_submissions enable row level security;

create policy "Families can manage their children dream submissions"
  on public.dream_submissions for all
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

grant all on public.dream_submissions to authenticated;

-- Note: Create these two Storage buckets in Supabase Dashboard → Storage:
--   'dream-inputs'  (private)  — raw voice recordings and drawings
--   'dream-images'  (public)   — DALL-E generated images
