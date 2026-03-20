-- Families (one per household — maps to Supabase auth.users)
create table public.families (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.families enable row level security;
create policy "Families can only see their own record"
  on public.families for all
  using (auth.uid() = id);

-- Child profiles (up to 4 per family — cap enforced at application layer)
create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  date_of_birth date not null,
  avatar_color text not null default '#7c3aed',
  created_at timestamptz not null default now()
);
alter table public.child_profiles enable row level security;
create policy "Families can manage their own child profiles"
  on public.child_profiles for all
  using (auth.uid() = family_id);

-- Auto-create family record when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.families (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
