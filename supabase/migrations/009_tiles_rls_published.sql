-- ============================================================
-- Migration 009: enforce published=true in tiles RLS
-- The service_role (admin client) bypasses RLS — unaffected.
-- ============================================================
drop policy if exists "Tiles readable by authenticated users" on public.tiles;
create policy "Tiles readable by authenticated users"
  on public.tiles for select
  using (auth.uid() is not null and published = true);
