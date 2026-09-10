# Plan 5 — 3D Dreamer Map + Stories Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2D CSS hex map with a 3D Three.js canvas rendering real Kenney GLB tiles, extract story content into a dedicated `stories` table, seed 54 tiles from `new_world.json`, and add an admin stories library.

**Architecture:** Migration 006 alters `tiles` (add model/rotation/story_id, drop story content columns) and creates a `stories` table. A TypeScript seed script imports `new_world.json` into Supabase and builds the unlock graph. The dreamer map replaces `HexGrid`/`HexTile` with `DreamerMapCanvas`/`DreamerHexTile` — a React Three Fiber canvas with fixed isometric camera (MapControls: pan + zoom, no rotation) rendering Kenney GLBs with state-based material overrides. All consumer components are updated to read story content via `tile.story.*`. The admin drops the tiles/unlocks management pages and adds a stories CRUD library.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (PostgreSQL + Storage), `@react-three/fiber`, `@react-three/drei`, `three`, Tailwind v4, Vercel

---

## File Structure

**Created:**
- `supabase/migrations/006_3d_map.sql` — schema changes (stories table, tiles alterations, grants)
- `scripts/seed-world.ts` — imports new_world.json tiles + stories into Supabase
- `components/map/DreamerMapCanvas.tsx` — Three.js canvas: camera, controls, lights, renders all tiles
- `components/map/DreamerHexTile.tsx` — single tile: GLB load, material state override, click handler
- `components/admin/StoryForm.tsx` — reusable create/edit form for story content
- `app/(admin)/admin/stories/page.tsx` — stories list
- `app/(admin)/admin/stories/new/page.tsx` — new story form
- `app/(admin)/admin/stories/[id]/page.tsx` — edit story form
- `app/api/admin/stories/route.ts` — GET (list), POST (create)
- `app/api/admin/stories/[id]/route.ts` — GET, PATCH, DELETE
- `app/api/admin/stories/[id]/upload-fo-image/route.ts` — POST: upload FO mascot image

**Modified:**
- `lib/types.ts` — add `Story`, update `Tile` (remove story content fields, add model/rotation/story_id), update `MappedTile` (add `story: Story | null`)
- `lib/hex.ts` — add `axialToWorld(q, r): { x, z }`
- `app/(app)/map/page.tsx` — replace HexGrid, remove flippedTileId/FloatingTilePreview, update queries + getInitialState
- `app/(app)/story/[tileId]/page.tsx` — join stories in query, update cast
- `components/story/ListeningMode.tsx` — `tile.story.*` field paths, `tile.name ?? ''`
- `components/story/ReadingMode.tsx` — `tile.story.*` field paths, `tile.name ?? ''`
- `components/map/TilePopup.tsx` — `tile.story.*` field paths (3× alex_dream_image_url, 2× alex_tip)
- `components/fo/FOMascot.tsx` — `tile.story.*` field paths, swap image to `fo_image_url` when set
- `components/dream/ImageAcceptance.tsx` — `tile.story.*` field paths
- `components/admin/AlexImageSection.tsx` — accept `Story` instead of `Tile`
- `app/api/admin/regenerate-alex-image/route.ts` — use `storyId`, update storage path + DB update
- `app/(admin)/admin/layout.tsx` — update NAV (remove Tiles/Unlock Graph, add Stories)
- `package.json` — add Three.js dependencies
- `__tests__/components/story/ListeningMode.test.tsx` — update MappedTile fixture, fix broken assertion
- `__tests__/components/story/ReadingMode.test.tsx` — update MappedTile fixture
- `__tests__/components/map/TilePopup.test.tsx` — update MappedTile fixture, fix broken assertions
- `__tests__/components/dream/ImageAcceptance.test.tsx` — update MappedTile fixture
- `__tests__/lib/types.test.ts` — update for new Story type + updated Tile

**Deleted:**
- `components/map/HexGrid.tsx`
- `components/map/HexTile.tsx`
- `app/(admin)/admin/tiles/` (entire directory)
- `app/(admin)/admin/unlocks/` (entire directory)
- `app/api/admin/tiles/` (entire directory)
- `app/api/admin/unlocks/` (entire directory)
- `__tests__/components/map/HexGrid.test.tsx`
- `__tests__/components/map/HexTile.test.tsx`
- `__tests__/admin/tiles.test.ts`
- `__tests__/admin/unlocks.test.ts`

---

### Task 1: Export existing story content + copy GLB models

No code changes — data preservation and asset setup before migration.

**Files:**
- No file changes; creates `public/models/` directory in the app

- [ ] **Step 1: Export current story content from Supabase before wiping**

Run in terminal (saves the content you'll need for the seed script):

```bash
source /root/.secrets/tokens.env
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT name, type, story_text, alex_tip FROM public.tiles WHERE story_text IS NOT NULL ORDER BY name"}' \
  | python3 -m json.tool > /tmp/story-export.json && cat /tmp/story-export.json
```

Expected: JSON with 3 rows — Mother Tree, The Tinkle Trunk, The Upside-down Waterfall — each with `story_text` and `alex_tip`.

- [ ] **Step 2: Copy Kenney GLB models + textures to the app**

```bash
cp -r /root/fo-dream-stories-gemini/public/models /root/fo-dream-stories/public/models
ls /root/fo-dream-stories/public/models/*.glb | wc -l
```

Expected: directory created with ~50+ `.glb` files including `0 - mother tree2.glb`, `grass-forest.glb`, `water.glb`, etc.

- [ ] **Step 3: Commit**

```bash
cd /root/fo-dream-stories
git add public/models/
git commit -m "feat: add Kenney GLB models for 3D map"
```

---

### Task 2: DB Migration 006 — schema changes

**Files:**
- Create: `supabase/migrations/006_3d_map.sql`

- [ ] **Step 1: Write migration**

Create `/root/fo-dream-stories/supabase/migrations/006_3d_map.sql`:

```sql
-- ============================================================
-- Migration 006: 3D map foundation
-- Creates stories table, alters tiles, resets tile data
-- ============================================================

-- 1. New stories table
create table public.stories (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null,
  story_text              text,
  audio_url               text,
  alex_tip                text,
  default_token_image_url text,
  alex_dream_image_url    text,
  fo_image_url            text,
  created_at              timestamptz not null default now()
);

alter table public.stories enable row level security;

create policy "Stories readable by authenticated users"
  on public.stories for select
  using (auth.uid() is not null);

grant select on public.stories to authenticated;
grant select, insert, update, delete on public.stories to service_role;

-- 2. Reset tile-related child data (beta only — safe to wipe)
delete from public.child_tile_states;
delete from public.dream_submissions;
delete from public.tile_unlocks;
delete from public.tiles;

-- 3. Alter tiles table
-- Add new columns
alter table public.tiles
  add column model      text,
  add column rotation   integer not null default 0,
  add column story_id   uuid references public.stories(id) on delete set null;

-- Extend type CHECK to include 'undefined'
alter table public.tiles
  drop constraint tiles_type_check;
alter table public.tiles
  add constraint tiles_type_check
  check (type in ('undefined', 'mother_tree', 'story', 'terrain'));

-- Make name nullable (undefined tiles have no display name)
alter table public.tiles
  alter column name drop not null;

-- Drop story content columns (content moves to stories table)
alter table public.tiles
  drop column story_text,
  drop column audio_url,
  drop column alex_tip,
  drop column alex_dream_image_url,
  drop column default_token_image_url;

-- 4. Ensure service_role has full access to all tables
grant select, insert, update, delete on all tables in schema public to service_role;
```

- [ ] **Step 2: Run in Supabase**

```bash
source /root/.secrets/tokens.env
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$(cat /root/fo-dream-stories/supabase/migrations/006_3d_map.sql | tr '\n' ' ' | sed 's/"/\\"/g')\"}"
```

Expected: `[null]` or empty array (no rows returned = success). If there's an error key in the response, read it and fix the SQL.

Verify:
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name FROM information_schema.columns WHERE table_name = '"'"'tiles'"'"' ORDER BY column_name"}' | python3 -m json.tool
```

Expected: columns include `model`, `rotation`, `story_id` but NOT `story_text`, `audio_url`, `alex_tip`, `alex_dream_image_url`, `default_token_image_url`.

- [ ] **Step 3: Commit**

```bash
cd /root/fo-dream-stories
git add supabase/migrations/006_3d_map.sql
git commit -m "feat: migration 006 — stories table, 3D tile schema"
```

---

### Task 3: Seed world from new_world.json

Imports 54 tiles + 9 stories + unlock graph into Supabase. Story content from `/tmp/story-export.json` (captured in Task 1).

**Files:**
- Create: `scripts/seed-world.ts`

- [ ] **Step 1: Write seed script**

Create `/root/fo-dream-stories/scripts/seed-world.ts`:

```typescript
/**
 * Seed script: imports new_world.json into Supabase.
 * Run with: npx ts-node --project tsconfig.json scripts/seed-world.ts
 *
 * Requires env vars from /root/.secrets/tokens.env:
 *   SUPABASE_SERVICE_ROLE, NEXT_PUBLIC_SUPABASE_URL
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!

const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
})

// Fixed UUIDs for stories — stable across re-runs
const STORY_IDS = {
  MOTHER_TREE:        '10000000-0000-0000-0000-000000000001',
  TINKLE_TRUNK:       '10000000-0000-0000-0000-000000000002',
  UPSIDE_DOWN_WFALL:  '10000000-0000-0000-0000-000000000003',
  RAINDROP_CASTLE:    '10000000-0000-0000-0000-000000000004',
  SYRUP_TREE:         '10000000-0000-0000-0000-000000000005',
  DRAGON_MOUNTAINS:   '10000000-0000-0000-0000-000000000006',
  ELVEN_FOREST:       '10000000-0000-0000-0000-000000000007',
  SUN_CAVE:           '10000000-0000-0000-0000-000000000008',
  THE_LIGHTHOUSE:     '10000000-0000-0000-0000-000000000009',
}

// Story content exported from old tiles (Task 1)
// Paste story_text and alex_tip values from /tmp/story-export.json here
const MOTHER_TREE_TEXT = `Let's take our first steps in this new world. Go and lie down in your favourite sleeping position, close your eyes and breathe deeply in and out through your nose.

You'll see a lot of colors, images and thoughts popping up in front of your eyes. Tell these thoughts "I'll take my time for you later, but not now" and you'll see that they will disappear. Keep doing this as long as new thoughts keep popping up, until it slows down.

When you feel calm and peaceful, imagine you are walking through a dense, lush forest. The trees are tall and ancient, their branches reaching toward the sky, filtering the sunlight into beautiful, dappled patterns on the ground. The air is crisp and fresh, filled with the sweet scent of earth and leaves.

As you walk deeper into the forest, you come across the most magnificent tree you've ever seen — the Mother Tree. Her trunk is wide and ancient, covered in soft moss. Her roots spread wide like welcoming arms. A warm golden light seems to glow from within her bark.

This is your home base in this dream world. From here, all adventures begin. What do you see around the Mother Tree? Keep your eyes closed and imagine... tomorrow you can tell us all about your discoveries.`

const MOTHER_TREE_TIP = `Swimming pool with diving board, cotton candy machine, monkey world, trampoline park, giant slide, gaming room, mirror-maze, cinema, bowling alley, costume room, nerf park with all the nerf guns you can imagine and also the ones you can't imagine...`

const TINKLE_TRUNK_TEXT = `As always, just lie down in your favourite sleeping position, close your eyes and breathe in and out through your nose. In... and out...

Before we begin, remember that we're going to your own magical world, where nothing can harm you, where you are completely safe and there is nothing to worry about. Just one fantastic adventure after another...

Okay, now that you're lying down and closed your eyes, breathe slowly. You'll see a lot of colors, images and thoughts popping up in front of your eyes. Tell these thoughts "I'll take my time for you later, but not now" and you'll see that they will disappear.

Not far from the Mother Tree, there's a very special tree called the Tinkle Trunk. When the wind blows through its leaves, they make the most magical tinkling sound, like tiny bells. Legend has it that anyone who hears the Tinkle Trunk's song will have the most wonderful dreams.

Follow the sound through the forest. Can you hear it? That soft, magical tinkling... Keep following it until you find the tree. When you reach it, sit down beneath it and listen. What does the music make you imagine? Where does it take you?

Keep your eyes closed and imagine... tomorrow you can tell us all about your discoveries.`

const TINKLE_TRUNK_TIP = `A pond with singing and dancing ducks`

const UPSIDE_DOWN_WFALL_TEXT = `As always, just lie down in your favourite sleeping position, close your eyes and breathe in and out through your nose. In... and out...

Before we begin, remember that we're going to your own magical world, where nothing can harm you, where you are completely safe and there is nothing to worry about. Just one fantastic adventure after another...

Okay, now that you're lying down and closed your eyes, remember to breathe in and out, slowly... You'll see a lot of colors, images and thoughts popping up in front of your eyes. Tell these thoughts "I'll take my time for you later, but not now" and you'll see that they will disappear. Keep doing this as long as new thoughts keep popping up, until it slows down.

Imagine you're standing at the foot of the mother tree. Have you noticed that there is a little creek flowing clear blue water to the west, where the sun is starting to set in a warm orange light. If you follow the stream and keep walking past the trees you get to a little meadow in the forest. The grass in the meadow is covered with daisies, white and yellow flowers sticking out their heads above the grass. Here in the meadow you can feel the warmth of the setting sun on your skin and it makes you feel so comfortable.

When you keep following the stream you see that there's a little lake in the middle of the meadow. And while you're walking closer you noticed that there is something very strange about this lake - something you hadn't seen earlier - but there's a waterfall not going into the lake but the water is streaming upwards. It's an upside down waterfall and the top of the waterfall disappears into the clouds. I have been told by other travelers that there is true magic at the top of this waterfall so let's plunge into the water and let ourselves be carried upwards the upside down waterfall to see what's at the top in the clouds. Keep your eyes closed and imagine... tomorrow you can tell us all about your discoveries.`

const UPSIDE_DOWN_WFALL_TIP = `Flying dolphins`

// Gemini storyId → our stories UUID
const GEMINI_STORY_ID_MAP: Record<string, string> = {
  'S1':               STORY_IDS.MOTHER_TREE,
  'S1774454970528':   STORY_IDS.TINKLE_TRUNK,
  'S1774454867487':   STORY_IDS.UPSIDE_DOWN_WFALL,
}

interface GeminiTile {
  id: string
  q: number
  r: number
  model: string
  type: string
  linkedToStoryId: string | null
  rotation: number
  storyId?: string
  name?: string
}

async function main() {
  const mapPath = path.join('/root/fo-dream-stories-gemini/public/maps/new_world.json')
  const tiles: GeminiTile[] = JSON.parse(fs.readFileSync(mapPath, 'utf8'))

  console.log(`Loaded ${tiles.length} tiles from new_world.json`)

  // ── 1. Insert stories ──────────────────────────────────────────────────
  console.log('Inserting stories...')
  const { error: storiesError } = await db.from('stories').upsert([
    { id: STORY_IDS.MOTHER_TREE,       title: 'Mother Tree',             story_text: MOTHER_TREE_TEXT,       alex_tip: MOTHER_TREE_TIP },
    { id: STORY_IDS.TINKLE_TRUNK,      title: 'The Tinkle Trunk',        story_text: TINKLE_TRUNK_TEXT,      alex_tip: TINKLE_TRUNK_TIP },
    { id: STORY_IDS.UPSIDE_DOWN_WFALL, title: 'The Upside-down Waterfall', story_text: UPSIDE_DOWN_WFALL_TEXT, alex_tip: UPSIDE_DOWN_WFALL_TIP },
    { id: STORY_IDS.RAINDROP_CASTLE,   title: 'Raindrop Castle' },
    { id: STORY_IDS.SYRUP_TREE,        title: 'The Syrup Tree' },
    { id: STORY_IDS.DRAGON_MOUNTAINS,  title: 'Dragon Mountains' },
    { id: STORY_IDS.ELVEN_FOREST,      title: 'Elven Forest' },
    { id: STORY_IDS.SUN_CAVE,          title: 'Sun Cave' },
    { id: STORY_IDS.THE_LIGHTHOUSE,    title: 'The Lighthouse' },
  ], { onConflict: 'id' })

  if (storiesError) { console.error('Stories error:', storiesError); process.exit(1) }
  console.log('Stories inserted ✓')

  // ── 2. Build a stable tile-UUID map keyed on "q,r" ─────────────────────
  // Use deterministic UUIDs so re-runs are idempotent
  function tileUuid(q: number, r: number): string {
    // Encode q,r into UUID namespace: 20000000-0000-0000-QQQQ-RRRRRRRRRRRR
    // q and r can be negative; offset by 100 to keep them positive 4-digit values
    const qHex = (q + 100).toString(16).padStart(4, '0')
    const rHex = (r + 100).toString(16).padStart(12, '0')
    return `20000000-0000-0000-${qHex}-${rHex}`
  }

  // Map from Gemini storyId → tile UUID (needed for building tile_unlocks)
  const geminiStoryToTileUuid: Record<string, string> = {}
  for (const tile of tiles) {
    if (tile.storyId) {
      geminiStoryToTileUuid[tile.storyId] = tileUuid(tile.q, tile.r)
    }
  }

  // ── 3. Insert tiles ────────────────────────────────────────────────────
  console.log('Inserting tiles...')
  const tileRows = tiles.map(tile => {
    // Mother tree detection: storyId === 'S1'
    const type = tile.storyId === 'S1' ? 'mother_tree' : tile.type
    const story_id = tile.storyId ? (GEMINI_STORY_ID_MAP[tile.storyId] ?? null) : null

    return {
      id:         tileUuid(tile.q, tile.r),
      type,
      name:       tile.name ?? null,
      position_q: tile.q,
      position_r: tile.r,
      model:      tile.model,
      rotation:   tile.rotation ?? 0,
      story_id,
      terrain_type: null,  // terrain_type not used in new map (model encodes terrain visually)
      sensory_moment_text: null,
    }
  })

  const { error: tilesError } = await db.from('tiles').upsert(tileRows, { onConflict: 'position_q,position_r' })
  if (tilesError) { console.error('Tiles error:', tilesError); process.exit(1) }
  console.log(`${tileRows.length} tiles inserted ✓`)

  // ── 4. Build tile_unlocks from linkedToStoryId ─────────────────────────
  console.log('Building tile_unlocks...')
  const unlockRows: { from_tile_id: string; to_tile_id: string }[] = []

  for (const tile of tiles) {
    if (!tile.linkedToStoryId) continue
    const fromTileUuid = geminiStoryToTileUuid[tile.linkedToStoryId]
    if (!fromTileUuid) {
      console.warn(`  No source tile found for linkedToStoryId=${tile.linkedToStoryId} on tile ${tile.id}`)
      continue
    }
    const toTileUuid = tileUuid(tile.q, tile.r)
    if (fromTileUuid === toTileUuid) continue  // skip self-links
    unlockRows.push({ from_tile_id: fromTileUuid, to_tile_id: toTileUuid })
  }

  const { error: unlocksError } = await db.from('tile_unlocks').upsert(unlockRows, { onConflict: 'from_tile_id,to_tile_id' })
  if (unlocksError) { console.error('Unlocks error:', unlocksError); process.exit(1) }
  console.log(`${unlockRows.length} tile_unlocks inserted ✓`)

  console.log('\n✅ Seed complete!')
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Add ts-node to devDependencies if not already present**

```bash
cd /root/fo-dream-stories
npm install --save-dev ts-node
```

- [ ] **Step 3: Load env vars and run seed**

```bash
source /root/.secrets/tokens.env
export NEXT_PUBLIC_SUPABASE_URL=https://tdoqdiyalenignhitxgj.supabase.co
cd /root/fo-dream-stories
npx ts-node --project tsconfig.json scripts/seed-world.ts
```

Expected output:
```
Loaded 54 tiles from new_world.json
Inserting stories...
Stories inserted ✓
54 tiles inserted ✓
Building tile_unlocks...
N tile_unlocks inserted ✓

✅ Seed complete!
```

Verify tile count:
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT type, count(*) FROM public.tiles GROUP BY type"}'
```

Expected: `mother_tree: 1`, `story: 2`, `terrain: 51`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-world.ts package.json package-lock.json
git commit -m "feat: seed world from new_world.json — 54 tiles + 9 stories + unlock graph"
```

---

### Task 4: Install Three.js dependencies + update TypeScript types

**Files:**
- Modify: `package.json`
- Modify: `lib/types.ts`
- Modify: `lib/hex.ts`

- [ ] **Step 1: Install Three.js packages**

```bash
cd /root/fo-dream-stories
npm install @react-three/fiber @react-three/drei three
npm install --save-dev @types/three
```

Verify install:
```bash
node -e "require('three'); console.log('three ok')"
```

- [ ] **Step 2: Update `lib/types.ts`**

Replace the entire file content with:

```typescript
export interface ChildProfile {
  id: string
  family_id: string
  name: string
  date_of_birth: string
  avatar_color: string
  created_at: string
}

export interface Family {
  id: string
  is_admin: boolean
  created_at: string
}

export function getAge(dateOfBirth: string): number {
  const today = new Date()
  const dob = new Date(dateOfBirth)
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--
  return age
}

// ── Story ────────────────────────────────────────────────────────────────

export interface Story {
  id: string
  title: string
  story_text: string | null
  audio_url: string | null
  alex_tip: string | null
  default_token_image_url: string | null
  alex_dream_image_url: string | null
  fo_image_url: string | null
  created_at: string
}

// ── Map types ────────────────────────────────────────────────────────────

export type TileType = 'undefined' | 'mother_tree' | 'story' | 'terrain'
export type TerrainType = 'forest' | 'land' | 'water' | 'mountain'
export type TileState = 'revealed' | 'unlocked' | 'listened' | 'completed'

export interface Tile {
  id: string
  type: TileType
  name: string | null
  position_q: number
  position_r: number
  terrain_type: TerrainType | null
  model: string | null
  rotation: number
  story_id: string | null
  sensory_moment_text: string | null
  created_at: string
}

export interface ChildTileState {
  id: string
  child_profile_id: string
  tile_id: string
  state: TileState
  listened_at: string | null
  completed_at: string | null
}

export interface MappedTile extends Tile {
  childState: TileState
  token_image_url: string | null
  story: Story | null
}

export interface DreamSubmission {
  id: string
  child_profile_id: string
  tile_id: string
  input_type: 'text' | 'voice' | 'drawing'
  raw_input_url: string | null
  transcribed_text: string | null
  generated_image_url: string | null
  token_image_url: string | null
  is_shared: boolean
  created_at: string
}

export interface AppSettings {
  id: 1
  beta_cap: number
  beta_open: boolean
}
```

- [ ] **Step 3: Add `axialToWorld` to `lib/hex.ts`**

Append to the end of `/root/fo-dream-stories/lib/hex.ts`:

```typescript
// 3D world-space coordinates for Three.js (x, z plane; y=0 is ground).
// Spacing matches Kenney Hexagon Kit GLB scale.
export const HEX_X_SPACING = 1.732  // ≈ √3
export const HEX_Z_SPACING = 1.5

export function axialToWorld(q: number, r: number): { x: number; z: number } {
  return {
    x: HEX_X_SPACING * (q + r / 2),
    z: HEX_Z_SPACING * r,
  }
}
```

- [ ] **Step 4: Run TypeScript compiler to check for errors**

```bash
cd /root/fo-dream-stories
npx tsc --noEmit 2>&1 | head -50
```

Expected: errors in files that still reference old `Tile` fields (`story_text`, `audio_url`, etc.). These are expected — they'll be fixed in Tasks 6–9. The types themselves should compile cleanly.

- [ ] **Step 5: Update `__tests__/lib/types.test.ts`**

Open `__tests__/lib/types.test.ts`. If it tests `Tile` fields that no longer exist, update the fixture:

Replace any `MappedTile` test fixture with:
```typescript
const baseTile: Tile = {
  id: 'test-id',
  type: 'story',
  name: 'Test Story',
  position_q: 0,
  position_r: 0,
  terrain_type: null,
  model: 'grass-forest.glb',
  rotation: 0,
  story_id: null,
  sensory_moment_text: null,
  created_at: new Date().toISOString(),
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/hex.ts package.json package-lock.json __tests__/lib/types.test.ts
git commit -m "feat: Story type, updated Tile/MappedTile, axialToWorld, Three.js deps"
```

---

### Task 5: Delete removed files

**Files:**
- Delete: all files listed in File Structure > Deleted section

- [ ] **Step 1: Delete 2D map components**

```bash
cd /root/fo-dream-stories
rm components/map/HexGrid.tsx
rm components/map/HexTile.tsx
```

- [ ] **Step 2: Delete admin tiles + unlocks pages and API routes**

```bash
rm -rf app/\(admin\)/admin/tiles/
rm -rf app/\(admin\)/admin/unlocks/
rm -rf app/api/admin/tiles/
rm -rf app/api/admin/unlocks/
```

- [ ] **Step 3: Delete corresponding test files**

```bash
rm __tests__/components/map/HexGrid.test.tsx
rm __tests__/components/map/HexTile.test.tsx
rm __tests__/admin/tiles.test.ts
rm __tests__/admin/unlocks.test.ts
```

- [ ] **Step 4: Run TypeScript to see remaining errors**

```bash
npx tsc --noEmit 2>&1 | head -80
```

Expected: errors in `map/page.tsx` (still imports HexGrid), `admin/layout.tsx` (links to deleted pages), and consumer components still referencing old `Tile` fields. These are expected and will be fixed in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete 2D map components + admin tiles/unlocks pages"
```

---

### Task 6: `DreamerHexTile` component

Single tile: loads GLB, clones scene, applies state-based material overrides, lifts on selection, renders selection ring.

**Files:**
- Create: `components/map/DreamerHexTile.tsx`

- [ ] **Step 1: Create `components/map/DreamerHexTile.tsx`**

```tsx
'use client'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { MappedTile } from '@/lib/types'
import { axialToWorld } from '@/lib/hex'

interface DreamerHexTileProps {
  tile: MappedTile
  isSelected: boolean
  onClick: (tile: MappedTile) => void
}

function applyStateToMaterial(mat: THREE.MeshStandardMaterial, tile: MappedTile, t: number) {
  mat.transparent = true

  if (tile.childState === 'revealed') {
    // Fogged: dark grey, semi-transparent
    mat.color.set(0x444444)
    mat.opacity = 0.5
    mat.emissive.set(0x000000)
    mat.emissiveIntensity = 0
    return
  }

  if (tile.childState === 'unlocked' && tile.type !== 'terrain') {
    // Story tile unlocked but not yet listened: greyscale
    const lum = mat.color.r * 0.299 + mat.color.g * 0.587 + mat.color.b * 0.114
    mat.color.set(new THREE.Color(lum, lum, lum))
    mat.opacity = 1
    mat.emissive.set(0x000000)
    mat.emissiveIntensity = 0
    return
  }

  if (tile.childState === 'listened') {
    // Slightly warm tint
    mat.opacity = 1
    mat.emissive.set(0xf59e0b)
    mat.emissiveIntensity = 0.1 + 0.05 * Math.sin(t * 2)
    return
  }

  if (tile.childState === 'completed') {
    // Full colour + amber pulse
    mat.opacity = 1
    mat.emissive.set(0xf59e0b)
    mat.emissiveIntensity = 0.2 + 0.15 * Math.sin(t * 2)
    return
  }

  // terrain unlocked: full colour, no override needed
  mat.opacity = 1
  mat.emissive.set(0x000000)
  mat.emissiveIntensity = 0
}

export default function DreamerHexTile({ tile, isSelected, onClick }: DreamerHexTileProps) {
  const modelPath = `/models/${tile.model}`
  const { scene } = useGLTF(modelPath)
  const groupRef = useRef<THREE.Group>(null!)
  const timeRef = useRef(0)

  const { x, z } = axialToWorld(tile.position_q, tile.position_r)
  const targetY = isSelected ? 0.5 : 0

  // Clone scene once per tile to avoid mutating the shared GLB cache
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => (m as THREE.MeshStandardMaterial).clone())
        } else {
          mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone()
        }
      }
    })
    return clone
  }, [scene])

  useFrame((_, delta) => {
    timeRef.current += delta

    // Smooth Y lerp for selection lift
    if (groupRef.current) {
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        targetY,
        0.1
      )
    }

    // Apply state-based material overrides every frame (for animations)
    clonedScene.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of materials) {
          applyStateToMaterial(mat as THREE.MeshStandardMaterial, tile, timeRef.current)
        }
      }
    })
  })

  const rotationY = (tile.rotation ?? 0) * (Math.PI / 3)

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      rotation={[0, rotationY, 0]}
      onClick={e => { e.stopPropagation(); onClick(tile) }}
    >
      <primitive object={clonedScene} />

      {/* Selection ring — hexagonal ring mesh under the tile */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.85, 0.95, 6]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/map/DreamerHexTile.tsx
git commit -m "feat: DreamerHexTile — 3D GLB tile with state materials"
```

---

### Task 7: `DreamerMapCanvas` component

Three.js canvas: fixed isometric camera, MapControls (pan + zoom), lights, renders all tiles.

**Files:**
- Create: `components/map/DreamerMapCanvas.tsx`

- [ ] **Step 1: Create `components/map/DreamerMapCanvas.tsx`**

```tsx
'use client'
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { MapControls, Environment } from '@react-three/drei'
import { MappedTile } from '@/lib/types'
import { axialToWorld } from '@/lib/hex'
import DreamerHexTile from './DreamerHexTile'

interface DreamerMapCanvasProps {
  tiles: MappedTile[]
  selectedTileId: string | null
  onTileClick: (tile: MappedTile) => void
}

export default function DreamerMapCanvas({ tiles, selectedTileId, onTileClick }: DreamerMapCanvasProps) {
  // Centre camera on Mother Tree
  const motherTile = tiles.find(t => t.type === 'mother_tree')
  const { x: mx, z: mz } = motherTile
    ? axialToWorld(motherTile.position_q, motherTile.position_r)
    : { x: 0, z: 0 }

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      <Canvas
        shadows
        camera={{ position: [mx, 20, mz + 15], fov: 50 }}
        onPointerMissed={() => onTileClick(null as unknown as MappedTile)}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.8} />
          <directionalLight
            position={[10, 20, 10]}
            intensity={1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />

          {/* Environment for ambient reflections */}
          <Environment preset="forest" />

          {/* Controls: pan + zoom only, no rotation */}
          <MapControls
            target={[mx, 0, mz]}
            enableRotate={false}
            enablePan={true}
            enableZoom={true}
            minDistance={8}
            maxDistance={50}
            screenSpacePanning={false}
          />

          {/* Tiles */}
          {tiles
            .filter(t => t.type !== 'undefined')
            .map(tile => (
              <DreamerHexTile
                key={tile.id}
                tile={tile}
                isSelected={selectedTileId === tile.id}
                onClick={onTileClick}
              />
            ))
          }
        </Suspense>
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/map/DreamerMapCanvas.tsx
git commit -m "feat: DreamerMapCanvas — Three.js canvas with isometric camera"
```

---

### Task 8: Update `map/page.tsx`

Replace HexGrid with DreamerMapCanvas, remove flippedTileId/FloatingTilePreview, update queries and getInitialState, fix handleDreamComplete story join.

**Files:**
- Modify: `app/(app)/map/page.tsx`

- [ ] **Step 1: Replace `app/(app)/map/page.tsx` with updated version**

```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tile, ChildTileState, MappedTile, Story, TileState, DreamSubmission } from '@/lib/types'
import { hexDistance } from '@/lib/hex'
import DreamerMapCanvas from '@/components/map/DreamerMapCanvas'
import TilePopup from '@/components/map/TilePopup'
import DreamSubmissionDrawer from '@/components/dream/DreamSubmissionDrawer'
import FOMascot from '@/components/fo/FOMascot'

function getInitialState(tile: Tile, allTiles: Tile[]): TileState | null {
  if (tile.type === 'undefined') return null  // undefined tiles never visible
  if (tile.type === 'mother_tree') return 'unlocked'
  const motherTree = allTiles.find(t => t.type === 'mother_tree')
  if (motherTree) {
    const dist = hexDistance(tile.position_q, tile.position_r, motherTree.position_q, motherTree.position_r)
    if (dist === 1) return 'revealed'
  }
  return null
}

export default function MapPage() {
  const router = useRouter()
  const [profileName, setProfileName] = useState('Dreamer')
  const [childId, setChildId] = useState<string | null>(null)
  const [tiles, setTiles] = useState<MappedTile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTile, setSelectedTile] = useState<MappedTile | null>(null)
  const [drawerTile, setDrawerTile] = useState<MappedTile | null>(null)
  const [sensoryTile, setSensoryTile] = useState<MappedTile | null>(null)
  const [fogMessage, setFogMessage] = useState<string | null>(null)

  const loadMap = useCallback(async (cId: string) => {
    const supabase = createClient()

    const { data: tileRows, error: tilesError } = await supabase
      .from('tiles')
      .select('*, story:stories(*)')
      .order('created_at', { ascending: true })
    if (tilesError || !tileRows) { setError('Could not load the map.'); setLoading(false); return }

    const allTiles = tileRows as (Tile & { story: Story | null })[]

    const { data: stateRows } = await supabase
      .from('child_tile_states').select('*').eq('child_profile_id', cId)

    let stateMap: Record<string, TileState> = {}

    if (!stateRows || stateRows.length === 0) {
      const initialStates = allTiles
        .map(tile => ({ tile, state: getInitialState(tile, allTiles) }))
        .filter(({ state }) => state !== null) as { tile: typeof allTiles[0]; state: TileState }[]

      await supabase.from('child_tile_states').upsert(
        initialStates.map(({ tile, state }) => ({ child_profile_id: cId, tile_id: tile.id, state })),
        { onConflict: 'child_profile_id,tile_id' }
      )
      initialStates.forEach(({ tile, state }) => { stateMap[tile.id] = state })
    } else {
      ;(stateRows as ChildTileState[]).forEach(s => { stateMap[s.tile_id] = s.state })
    }

    const { data: submissionRows } = await supabase
      .from('dream_submissions').select('tile_id, token_image_url, created_at').eq('child_profile_id', cId)
    const tokenMap: Record<string, string | null> = {}
    if (submissionRows) {
      ;(submissionRows as Pick<DreamSubmission, 'tile_id' | 'token_image_url' | 'created_at'>[])
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .forEach(s => { tokenMap[s.tile_id] = s.token_image_url })
    }

    const mappedTiles: MappedTile[] = allTiles
      .filter(tile => stateMap[tile.id] !== undefined)
      .map(tile => ({
        ...tile,
        childState: stateMap[tile.id],
        token_image_url: tokenMap[tile.id] ?? null,
        story: tile.story ?? null,
      }))

    setTiles(mappedTiles)
    setLoading(false)
  }, [])

  useEffect(() => {
    const name = sessionStorage.getItem('activeProfileName') ?? 'Dreamer'
    const cId = sessionStorage.getItem('activeProfileId')
    setProfileName(name)
    setChildId(cId)
    if (!cId) { router.push('/select-profile'); return }
    loadMap(cId)
  }, [router, loadMap])

  async function handleTileClick(tile: MappedTile | null) {
    if (!tile) { setSelectedTile(null); return }

    if (tile.childState === 'revealed') {
      const motherTree = tiles.find(t => t.type === 'mother_tree')
      if (motherTree) {
        const dist = hexDistance(tile.position_q, tile.position_r, motherTree.position_q, motherTree.position_r)
        if (dist === 1 && motherTree.childState !== 'completed') {
          setFogMessage('Complete the Mother Tree story first!')
          setTimeout(() => setFogMessage(null), 3000)
          return
        }
      }
      if (childId) {
        const supabase = createClient()
        await supabase.from('child_tile_states').upsert(
          { child_profile_id: childId, tile_id: tile.id, state: 'unlocked' },
          { onConflict: 'child_profile_id,tile_id' }
        )
        const unlocked = { ...tile, childState: 'unlocked' as TileState }
        setTiles(prev => prev.map(t => t.id === tile.id ? unlocked : t))
        setSelectedTile(unlocked)
      }
      return
    }

    if (tile.type === 'terrain') {
      if (tile.sensory_moment_text) {
        setSensoryTile(tile)
        setTimeout(() => setSensoryTile(null), 4000)
      }
      return
    }

    setSelectedTile(tile)
  }

  async function handleDreamComplete({ tokenImageUrl }: { tokenImageUrl: string }) {
    if (!drawerTile || !childId) return
    const tileId = drawerTile.id

    setTiles(prev => prev.map(t =>
      t.id === tileId ? { ...t, childState: 'completed', token_image_url: tokenImageUrl } : t
    ))

    const supabase = createClient()
    const { data: unlockRows } = await supabase
      .from('tile_unlocks').select('to_tile_id').eq('from_tile_id', tileId)

    if (unlockRows && unlockRows.length > 0) {
      const toIds = unlockRows.map((r: { to_tile_id: string }) => r.to_tile_id)

      const { data: currentStates } = await supabase
        .from('child_tile_states').select('tile_id, state')
        .eq('child_profile_id', childId).in('tile_id', toIds)
      const currentStateMap: Record<string, TileState> = {}
      ;(currentStates ?? []).forEach((s: { tile_id: string; state: TileState }) => {
        currentStateMap[s.tile_id] = s.state
      })

      const upsertRows = toIds.map((id: string) => ({
        child_profile_id: childId,
        tile_id: id,
        state: currentStateMap[id] === 'revealed' ? 'unlocked' : 'revealed',
      }))

      await supabase.from('child_tile_states').upsert(upsertRows, { onConflict: 'child_profile_id,tile_id' })

      // Fetch newly-unlocked tiles including story join
      const { data: newTileRows } = await supabase
        .from('tiles')
        .select('*, story:stories(*)')
        .in('id', toIds)
      if (newTileRows) {
        const newMapped: MappedTile[] = (newTileRows as (Tile & { story: Story | null })[]).map(t => ({
          ...t,
          childState: (upsertRows.find(r => r.tile_id === t.id)?.state ?? 'revealed') as TileState,
          token_image_url: null,
          story: t.story ?? null,
        }))
        setTiles(prev => {
          const existingIds = new Set(prev.map(t => t.id))
          return [
            ...prev.map(t => { const u = newMapped.find(m => m.id === t.id); return u ?? t }),
            ...newMapped.filter(t => !existingIds.has(t.id)),
          ]
        })
      }
    }

    setDrawerTile(null)
    setSelectedTile(null)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading your dream world...</p>
    </main>
  )

  if (error) return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <p className="text-red-400 text-center">{error}</p>
    </main>
  )

  return (
    <main className="min-h-screen flex flex-col bg-background" style={{ position: 'relative' }}>
      <div className="flex items-center justify-between px-4 pt-6 pb-2" style={{ position: 'relative', zIndex: 10 }}>
        <h1 className="text-xl font-bold text-foreground">{profileName}&apos;s Dream World</h1>
        <button onClick={() => router.push('/select-profile')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Switch dreamer
        </button>
      </div>

      {/* 3D map — fills remaining space */}
      <div className="flex-1 w-full" style={{ position: 'relative', minHeight: 400 }}>
        <DreamerMapCanvas
          tiles={tiles}
          selectedTileId={selectedTile?.id ?? null}
          onTileClick={handleTileClick}
        />
      </div>

      {selectedTile && selectedTile.childState !== 'revealed' && (
        <TilePopup
          tile={selectedTile}
          onClose={() => setSelectedTile(null)}
          onListeningMode={() => { router.push(`/story/${selectedTile.id}?mode=listening`); setSelectedTile(null) }}
          onReadingMode={() => { router.push(`/story/${selectedTile.id}?mode=reading`); setSelectedTile(null) }}
          onSubmitDream={() => { setDrawerTile(selectedTile); setSelectedTile(null) }}
          onReadAgain={() => { router.push(`/story/${selectedTile.id}?mode=reading`); setSelectedTile(null) }}
        />
      )}

      {sensoryTile?.sensory_moment_text && (
        <>
          <div onClick={() => setSensoryTile(null)} className="fixed inset-0 z-30" />
          <div onClick={() => setSensoryTile(null)} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-72 bg-white rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-slate-700 text-base leading-relaxed">{sensoryTile.sensory_moment_text}</p>
            <p className="text-slate-400 text-xs mt-3">Tap to close</p>
          </div>
        </>
      )}

      {fogMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-slate-800 text-white text-sm rounded-2xl shadow-lg pointer-events-none">
          {fogMessage}
        </div>
      )}

      {drawerTile && childId && (
        <DreamSubmissionDrawer
          tile={drawerTile}
          childProfileId={childId}
          onClose={() => setDrawerTile(null)}
          onComplete={handleDreamComplete}
        />
      )}

      <FOMascot
        message={`Welcome, ${profileName}! Tap the Mother Tree to begin.`}
        selectedTile={selectedTile}
      />
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/map/page.tsx
git commit -m "feat: replace 2D HexGrid with DreamerMapCanvas in map page"
```

---

### Task 9: Update story page + consumer components

Update field paths from `tile.*` to `tile.story?.*` in all consumer components, fix name nullable.

**Files:**
- Modify: `app/(app)/story/[tileId]/page.tsx`
- Modify: `components/story/ListeningMode.tsx`
- Modify: `components/story/ReadingMode.tsx`
- Modify: `components/map/TilePopup.tsx`
- Modify: `components/fo/FOMascot.tsx`
- Modify: `components/dream/ImageAcceptance.tsx`

- [ ] **Step 1: Update `app/(app)/story/[tileId]/page.tsx`**

Change the tile query from:
```typescript
supabase.from('tiles').select('*').eq('id', tileId).single()
```
To:
```typescript
supabase.from('tiles').select('*, story:stories(*)').eq('id', tileId).single()
```

Update the cast from:
```typescript
setTile({
  ...(tileData as Tile),
  childState: (stateRow?.state as TileState) ?? 'unlocked',
  token_image_url: null,
})
```
To:
```typescript
setTile({
  ...(tileData as Tile & { story: Story | null }),
  childState: (stateRow?.state as TileState) ?? 'unlocked',
  token_image_url: null,
  story: (tileData as Tile & { story: Story | null }).story ?? null,
})
```

Add `Story` to the import:
```typescript
import { Tile, MappedTile, Story, TileState } from '@/lib/types'
```

- [ ] **Step 2: Update `components/story/ListeningMode.tsx`**

Find and replace all references:
- `tile.story_text` → `tile.story?.story_text`
- `tile.audio_url` → `tile.story?.audio_url`
- `tile.name` (any direct render) → `tile.name ?? ''`

- [ ] **Step 3: Update `components/story/ReadingMode.tsx`**

Find and replace:
- `tile.story_text` → `tile.story?.story_text`
- `tile.alex_tip` → `tile.story?.alex_tip`
- `tile.name` (any direct render) → `tile.name ?? ''`

- [ ] **Step 4: Update `components/map/TilePopup.tsx`**

Find and replace **all occurrences** (3× `alex_dream_image_url`, 2× `alex_tip`):
- `tile.alex_dream_image_url` → `tile.story?.alex_dream_image_url`
- `tile.alex_tip` → `tile.story?.alex_tip`

- [ ] **Step 5: Update `components/fo/FOMascot.tsx`**

a) In `getContextualMessage`, change:
```typescript
return tile.alex_dream_image_url
  ? 'Wonderful! Tap "See Alex\'s dream"...'
  : 'Wonderful! Your dream has been captured...'
```
To:
```typescript
return tile.story?.alex_dream_image_url
  ? 'Wonderful! Tap "See Alex\'s dream" to find out what he imagined! ✨'
  : 'Wonderful! Your dream has been captured. Read it again whenever you like! ⭐'
```

b) In the `<Image>` element, replace the static `src="/fo-reading.png"` with a dynamic source:
```tsx
<Image
  src={selectedTile?.story?.fo_image_url ?? '/fo-reading.png'}
  alt="Friendly Onion"
  width={hasPopup ? 120 : 160}
  height={hasPopup ? 120 : 160}
  className="object-contain drop-shadow-lg flex-shrink-0"
  priority
/>
```

Note: `next/image` works fine for `/fo-reading.png` (local asset). For Supabase Storage URLs use plain `<img>` instead. Since `fo_image_url` will be a Supabase URL, update to use `<img>` tag when `fo_image_url` is set:

```tsx
{selectedTile?.story?.fo_image_url ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={selectedTile.story.fo_image_url}
    alt="Friendly Onion"
    width={hasPopup ? 120 : 160}
    height={hasPopup ? 120 : 160}
    className="object-contain drop-shadow-lg flex-shrink-0"
  />
) : (
  <Image
    src="/fo-reading.png"
    alt="Friendly Onion"
    width={hasPopup ? 120 : 160}
    height={hasPopup ? 120 : 160}
    className="object-contain drop-shadow-lg flex-shrink-0"
    priority
  />
)}
```

- [ ] **Step 6: Update `components/dream/ImageAcceptance.tsx`**

Find and replace:
- `tile.default_token_image_url` → `tile.story?.default_token_image_url`
- `tile.alex_tip` → `tile.story?.alex_tip`

- [ ] **Step 7: Run TypeScript check**

```bash
cd /root/fo-dream-stories
npx tsc --noEmit 2>&1 | grep -v node_modules | head -40
```

Expected: errors only in admin components (AlexImageSection, regenerate-alex-image) — fixed in next task.

- [ ] **Step 8: Commit**

```bash
git add app/\(app\)/story/ components/story/ components/map/TilePopup.tsx components/fo/FOMascot.tsx components/dream/ImageAcceptance.tsx
git commit -m "feat: update consumer components to tile.story.* field paths + fo_image_url"
```

---

### Task 10: Update admin — AlexImageSection + regenerate-alex-image

**Files:**
- Modify: `components/admin/AlexImageSection.tsx`
- Modify: `app/api/admin/regenerate-alex-image/route.ts`

- [ ] **Step 1: Rewrite `components/admin/AlexImageSection.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Story } from '@/lib/types'

interface Props {
  story: Story
  onUpdated: (story: Story) => void
}

export default function AlexImageSection({ story, onUpdated }: Props) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  async function handleRegenerate() {
    if (!story.alex_tip) { setError("Add Alex's tip text first — it's used as the image prompt."); return }
    setGenerating(true)
    setError('')
    const res = await fetch('/api/admin/regenerate-alex-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: story.id, alexTip: story.alex_tip }),
    })
    const json = await res.json()
    setGenerating(false)
    if (!res.ok) { setError(json.error); return }
    onUpdated({ ...story, alex_dream_image_url: json.imageUrl })
  }

  return (
    <div className="flex flex-col gap-4">
      {story.alex_dream_image_url ? (
        <div className="flex gap-6 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={story.alex_dream_image_url} alt="Alex's dream" className="w-48 h-48 rounded-xl object-cover" />
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-400">Current Alex dream image</p>
            <button onClick={handleRegenerate} disabled={generating}
              className="px-4 py-2 bg-amber-600/30 text-amber-400 rounded-lg text-sm hover:bg-amber-600/50 disabled:opacity-50 w-fit">
              {generating ? 'Generating…' : 'Regenerate image'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">No Alex dream image yet. Add Alex&apos;s tip above and generate one.</p>
          <button onClick={handleRegenerate} disabled={generating || !story.alex_tip}
            className="px-4 py-2 bg-amber-600/30 text-amber-400 rounded-lg text-sm hover:bg-amber-600/50 disabled:opacity-50 w-fit">
            {generating ? 'Generating…' : 'Generate Alex dream image'}
          </button>
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `app/api/admin/regenerate-alex-image/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { isAdmin, adminClient } from '@/lib/admin'

const ALEX_STYLE = "A child's dream illustration, watercolour and ink, soft magical light, storybook style, warm palette, child-safe, wonder-filled"

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const { storyId, alexTip } = await request.json()
  if (!storyId || !alexTip) return NextResponse.json({ error: 'storyId and alexTip required' }, { status: 400 })

  const prompt = `${alexTip}. ${ALEX_STYLE}`
  const result = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    size: '1024x1024',
    response_format: 'url',
  })
  const openAiUrl = result.data?.[0]?.url
  if (!openAiUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

  const imageResponse = await fetch(openAiUrl)
  const buffer = await imageResponse.arrayBuffer()
  const db = adminClient()
  const path = `alex-dreams/stories/${storyId}/${crypto.randomUUID()}.png`
  const { error: uploadError } = await db.storage
    .from('dream-images')
    .upload(path, new Blob([buffer], { type: 'image/png' }), { contentType: 'image/png', upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data } = db.storage.from('dream-images').getPublicUrl(path)

  const { error: updateError } = await db
    .from('stories')
    .update({ alex_dream_image_url: data.publicUrl })
    .eq('id', storyId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ imageUrl: data.publicUrl })
}
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/AlexImageSection.tsx app/api/admin/regenerate-alex-image/route.ts
git commit -m "feat: AlexImageSection + regenerate-alex-image now operate on Story"
```

---

### Task 11: Admin stories API routes

**Files:**
- Create: `app/api/admin/stories/route.ts`
- Create: `app/api/admin/stories/[id]/route.ts`
- Create: `app/api/admin/stories/[id]/upload-fo-image/route.ts`

- [ ] **Step 1: Create `app/api/admin/stories/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db
    .from('stories')
    .select(`
      id, title, created_at,
      has_story_text:story_text,
      has_audio:audio_url,
      has_alex_tip:alex_tip,
      has_fo_image:fo_image_url
    `)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Map to boolean indicators
  const result = (data ?? []).map((s: Record<string, unknown>) => ({
    id: s.id,
    title: s.title,
    created_at: s.created_at,
    has_story_text: Boolean(s.has_story_text),
    has_audio: Boolean(s.has_audio),
    has_alex_tip: Boolean(s.has_alex_tip),
    has_fo_image: Boolean(s.has_fo_image),
  }))
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const body = await request.json()
  if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const { data, error } = await db.from('stories').insert({ title: body.title }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/admin/stories/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const db = adminClient()
  const { data, error } = await db.from('stories').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const db = adminClient()
  const body = await request.json()
  const { data, error } = await db.from('stories').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const db = adminClient()
  const { error } = await db.from('stories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Create `app/api/admin/stories/[id]/upload-fo-image/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id: storyId } = await params
  const formData = await request.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'image file required' }, { status: 400 })

  const db = adminClient()
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `story-images/fo/${storyId}/${crypto.randomUUID()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await db.storage
    .from('dream-images')
    .upload(path, new Blob([buffer], { type: file.type }), { contentType: file.type, upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data } = db.storage.from('dream-images').getPublicUrl(path)

  const { error: updateError } = await db
    .from('stories').update({ fo_image_url: data.publicUrl }).eq('id', storyId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url: data.publicUrl })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/stories/
git commit -m "feat: admin stories API routes — CRUD + FO image upload"
```

---

### Task 12: Admin stories pages + updated nav

**Files:**
- Create: `components/admin/StoryForm.tsx`
- Create: `app/(admin)/admin/stories/page.tsx`
- Create: `app/(admin)/admin/stories/new/page.tsx`
- Create: `app/(admin)/admin/stories/[id]/page.tsx`
- Modify: `app/(admin)/admin/layout.tsx`

- [ ] **Step 1: Create `components/admin/StoryForm.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Story } from '@/lib/types'
import AudioUpload from './AudioUpload'
import AlexImageSection from './AlexImageSection'

interface StoryFormProps {
  story: Story
  isNew?: boolean
}

export default function StoryForm({ story: initialStory, isNew = false }: StoryFormProps) {
  const router = useRouter()
  const [story, setStory] = useState<Story>(initialStory)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [uploadingFo, setUploadingFo] = useState(false)

  function set(field: keyof Story, value: string | null) {
    setStory(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const url = isNew ? '/api/admin/stories' : `/api/admin/stories/${story.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body = isNew
      ? { title: story.title }
      : { title: story.title, story_text: story.story_text, alex_tip: story.alex_tip }
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error); return }
    if (isNew) router.push(`/admin/stories/${json.id}`)
    else router.refresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${story.title}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/admin/stories/${story.id}`, { method: 'DELETE' })
    router.push('/admin/stories')
  }

  async function handleFoImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFo(true)
    const fd = new FormData()
    fd.append('image', file)
    const res = await fetch(`/api/admin/stories/${story.id}/upload-fo-image`, { method: 'POST', body: fd })
    const json = await res.json()
    setUploadingFo(false)
    if (!res.ok) { setError(json.error); return }
    set('fo_image_url', json.url)
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-400 uppercase tracking-wider">Title</label>
        <input
          value={story.title}
          onChange={e => set('title', e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
        />
      </div>

      {!isNew && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Story Text</label>
            <textarea
              value={story.story_text ?? ''}
              onChange={e => set('story_text', e.target.value || null)}
              rows={10}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white resize-y font-mono text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Alex&apos;s Tip</label>
            <textarea
              value={story.alex_tip ?? ''}
              onChange={e => set('alex_tip', e.target.value || null)}
              rows={3}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white resize-y"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Audio</label>
            <AudioUpload
              currentUrl={story.audio_url}
              onUploaded={url => set('audio_url', url)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">FO Mascot Image</label>
            {story.fo_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.fo_image_url} alt="FO mascot" className="w-32 h-32 object-contain rounded-lg mb-2" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFoImageUpload}
              disabled={uploadingFo}
              className="text-sm text-gray-400"
            />
            {uploadingFo && <p className="text-xs text-gray-500">Uploading…</p>}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Alex&apos;s Dream Image</label>
            <AlexImageSection story={story} onUpdated={setStory} />
          </div>
        </>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-4 items-center">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : isNew ? 'Create story' : 'Save changes'}
        </button>
        {!isNew && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-red-400 hover:text-red-300 text-sm disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete story'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(admin)/admin/stories/page.tsx`**

```tsx
import Link from 'next/link'
import { adminClient, isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'

export default async function StoriesPage() {
  if (!await isAdmin()) redirect('/map')
  const db = adminClient()
  const { data: stories } = await db
    .from('stories')
    .select('id, title, story_text, audio_url, alex_tip, fo_image_url')
    .order('created_at', { ascending: true })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stories</h1>
        <Link href="/admin/stories/new" className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 text-sm">
          + New story
        </Link>
      </div>

      {!stories?.length && (
        <p className="text-gray-500">No stories yet. Create your first story.</p>
      )}

      <div className="flex flex-col gap-2">
        {(stories ?? []).map(s => (
          <Link
            key={s.id}
            href={`/admin/stories/${s.id}`}
            className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 hover:border-gray-700 transition-colors"
          >
            <span className="font-medium">{s.title}</span>
            <div className="flex gap-3 text-xs">
              <span className={s.story_text ? 'text-green-400' : 'text-gray-600'}>text {s.story_text ? '✓' : '✗'}</span>
              <span className={s.audio_url ? 'text-green-400' : 'text-gray-600'}>audio {s.audio_url ? '✓' : '✗'}</span>
              <span className={s.alex_tip ? 'text-green-400' : 'text-gray-600'}>alex tip {s.alex_tip ? '✓' : '✗'}</span>
              <span className={s.fo_image_url ? 'text-green-400' : 'text-gray-600'}>FO image {s.fo_image_url ? '✓' : '✗'}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(admin)/admin/stories/new/page.tsx`**

```tsx
import StoryForm from '@/components/admin/StoryForm'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import { Story } from '@/lib/types'

const EMPTY_STORY: Story = {
  id: '',
  title: '',
  story_text: null,
  audio_url: null,
  alex_tip: null,
  default_token_image_url: null,
  alex_dream_image_url: null,
  fo_image_url: null,
  created_at: '',
}

export default async function NewStoryPage() {
  if (!await isAdmin()) redirect('/map')
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">New Story</h1>
      <StoryForm story={EMPTY_STORY} isNew />
    </div>
  )
}
```

- [ ] **Step 4: Create `app/(admin)/admin/stories/[id]/page.tsx`**

```tsx
import { adminClient, isAdmin } from '@/lib/admin'
import { redirect, notFound } from 'next/navigation'
import StoryForm from '@/components/admin/StoryForm'
import { Story } from '@/lib/types'

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) redirect('/map')
  const { id } = await params
  const db = adminClient()
  const { data, error } = await db.from('stories').select('*').eq('id', id).single()
  if (error || !data) notFound()
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{(data as Story).title}</h1>
      <StoryForm story={data as Story} />
    </div>
  )
}
```

- [ ] **Step 5: Update `app/(admin)/admin/layout.tsx`**

Replace the `NAV` array:

```typescript
const NAV = [
  { href: '/admin',            label: 'Dashboard' },
  { href: '/admin/stories',    label: 'Stories' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/settings',   label: 'Settings' },
]
```

- [ ] **Step 6: Commit**

```bash
git add components/admin/StoryForm.tsx app/\(admin\)/admin/stories/ app/\(admin\)/admin/layout.tsx
git commit -m "feat: admin stories library — list, create, edit, FO image upload"
```

---

### Task 13: Fix remaining TypeScript errors + update tests

**Files:**
- Modify: `__tests__/components/map/TilePopup.test.tsx`
- Modify: `__tests__/components/dream/ImageAcceptance.test.tsx`
- Modify: `__tests__/components/story/ListeningMode.test.tsx`
- Modify: `__tests__/components/story/ReadingMode.test.tsx`

- [ ] **Step 1: Run full TypeScript check**

```bash
cd /root/fo-dream-stories
npx tsc --noEmit 2>&1 | grep -v node_modules
```

Fix any remaining type errors not already addressed. Common remaining errors will be in test files using old `MappedTile` fixtures.

- [ ] **Step 2: Create a shared test fixture helper**

In each test file that uses a `MappedTile` fixture, update the tile object to the new shape. The new base fixture (add `story: null` or a story object as needed):

```typescript
// Standard MappedTile fixture — no story content
const baseTile: MappedTile = {
  id: 'tile-1',
  type: 'story',
  name: 'Test Story',
  position_q: 0,
  position_r: 0,
  terrain_type: null,
  model: 'grass-forest.glb',
  rotation: 0,
  story_id: 'story-1',
  sensory_moment_text: null,
  created_at: '2024-01-01T00:00:00Z',
  childState: 'unlocked',
  token_image_url: null,
  story: null,
}

// With story content
const tileWithStory: MappedTile = {
  ...baseTile,
  story: {
    id: 'story-1',
    title: 'Test Story',
    story_text: 'Once upon a time...',
    audio_url: null,
    alex_tip: 'A magical tip',
    default_token_image_url: '/default.png',
    alex_dream_image_url: null,
    fo_image_url: null,
    created_at: '2024-01-01T00:00:00Z',
  },
}
```

- [ ] **Step 3: Update `__tests__/components/map/TilePopup.test.tsx`**

a) Replace all `MappedTile` fixtures with the new shape (remove `story_text`, `audio_url`, `alex_tip`, `alex_dream_image_url`, `default_token_image_url`; add `model`, `rotation`, `story_id`, `sensory_moment_text`, `story: null`).

b) Fix broken text assertions:
- Remove or update any `expect(screen.getByText(/heart of the dream world/i))` — this text does not exist in the component
- Replace `expect(screen.getByText(/peek at Alex/i))` with `expect(screen.getByText(/See Alex's dream/i))`

- [ ] **Step 4: Update `__tests__/components/dream/ImageAcceptance.test.tsx`**

Replace fixture with `story: { default_token_image_url: '/default.png', alex_tip: 'A tip', ... }` instead of direct `default_token_image_url` on the tile.

- [ ] **Step 5: Update `__tests__/components/story/ListeningMode.test.tsx`**

a) Update fixture: remove `story_text`, `audio_url`; add `story: { story_text: 'Once upon a time...', audio_url: null, ... }`.

b) Fix broken assertion: `/Preparing/i` does not appear in the component. Remove this assertion or replace with actual rendered text (check what `ListeningMode` renders for the `ready` state — typically the first few words of story text or a "Listen" button).

- [ ] **Step 6: Update `__tests__/components/story/ReadingMode.test.tsx`**

Update fixture: remove `story_text`, `alex_tip`; add `story: { story_text: '...', alex_tip: null, ... }`.

- [ ] **Step 7: Run tests**

```bash
cd /root/fo-dream-stories
npm test 2>&1 | tail -30
```

Expected: all tests pass. If failures remain, read the error output and fix.

- [ ] **Step 8: Commit**

```bash
git add __tests__/
git commit -m "fix: update test fixtures for new Story/Tile types, fix broken assertions"
```

---

### Task 14: Build verification + deploy

- [ ] **Step 1: Full TypeScript check — must be clean**

```bash
cd /root/fo-dream-stories
npx tsc --noEmit 2>&1 | grep -v node_modules
```

Expected: no errors.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass (or failures are pre-existing unrelated tests).

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -30
```

Expected: build succeeds. If Three.js causes SSR errors during build (e.g. `ReferenceError: window is not defined`), the fix is a `dynamic` import with `ssr: false` in `map/page.tsx`:

```typescript
// Replace the static import at the top of app/(app)/map/page.tsx:
// import DreamerMapCanvas from '@/components/map/DreamerMapCanvas'
// With a dynamic import:
import dynamic from 'next/dynamic'
const DreamerMapCanvas = dynamic(() => import('@/components/map/DreamerMapCanvas'), { ssr: false })
```

This is the correct approach for any React Three Fiber canvas in Next.js — Three.js accesses `window` at module level, which breaks SSR. The `'use client'` directive alone is not sufficient to prevent the error during build.

- [ ] **Step 4: Push to main and verify Vercel deploy**

```bash
git push origin master:main
```

Watch the Vercel dashboard at https://vercel.com/dashboard or check build status:

```bash
source /root/.secrets/tokens.env
gh run list --repo kobe-thys/fo-dream-stories --limit 3
```

Expected: deployment succeeds in ~60–90 seconds.

- [ ] **Step 5: Smoke test the live app**

Open https://fo-dream-stories.vercel.app and verify:
1. Map loads — 3D Kenney tiles visible
2. Mother Tree tile is highlighted/central
3. Tap Mother Tree → TilePopup appears
4. Tap "Read it" → story text visible (The Mother Tree story)
5. Admin at `/admin/stories` → shows 9 stories with content indicators
6. Edit a story → form loads with existing text

---

## Notes for implementer

- **GLB model names are case-sensitive** — `0 - mother tree2.glb` has spaces and a dash; confirm the exact filename from `public/models/` matches `new_world.json` values before running the seed.
- **Three.js in Next.js 16**: all Three.js code must be in `'use client'` components. Never import `@react-three/fiber` or `three` in server components or API routes.
- **`useGLTF` caching**: `@react-three/drei` caches GLBs by URL. Multiple tiles using the same model file share one GLB load — efficient. The `scene.clone()` in `DreamerHexTile` ensures each tile gets independent materials without re-fetching.
- **MapControls target**: set to Mother Tree world position so initial pan/zoom feels centred. The `target` prop on `MapControls` is the point the camera orbits around — with rotation disabled this acts as the initial focus point.
- **Supabase Storage bucket for FO images**: the FO image upload route uses the existing `dream-images` bucket. No new bucket needed.
