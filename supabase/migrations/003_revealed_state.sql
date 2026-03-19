-- Plan 3: Add 'revealed' state, retire 'locked'
-- Tiles with no child_tile_states row are invisible (not rendered).
-- Existing 'locked' rows are deleted — those tiles become invisible.

-- 1. Delete all locked tile states
-- Note: child_tile_states.state is a text column with a CHECK constraint (not a Postgres ENUM).
-- See migration 002 — it uses: state text NOT NULL CHECK (state IN ('locked', 'unlocked', ...))
delete from public.child_tile_states where state = 'locked';

-- 2. Rebuild the CHECK constraint to exclude 'locked' and add 'revealed'
alter table public.child_tile_states
  drop constraint child_tile_states_state_check;
alter table public.child_tile_states
  add constraint child_tile_states_state_check
  check (state in ('revealed', 'unlocked', 'listened', 'completed'));
