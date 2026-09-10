---
title: Plan 5 — 3D Dreamer Map + Stories Foundation
date: 2026-03-30
status: draft
---

# Plan 5 — 3D Dreamer Map + Stories Foundation

## Goal

Replace the 2D SVG hex map with a 3D Three.js map rendering real Kenney GLB tile models. Extract story content from the `tiles` table into a dedicated `stories` table. Seed the world from the existing `new_world.json` map built in Cursor/Gemini. Deliver a fully testable dream loop (Mother Tree → complete → unlock ring → next story) on the 3D map.

---

## Background

Plans 1–4 built a working app with a 2D CSS hex map. The product brief calls for actual Kenney Hexagon Kit tile models rendered in 3D, matching terrain visually (forest, water, river tiles, etc.) and matching the Architect editor (Plan 6). The Gemini/Cursor prototype proved the 3D approach works: React Three Fiber + Kenney GLBs + axial hex grid. That prototype stored map state in localStorage; this plan replaces localStorage with the existing Supabase project.

Plan 6 (Admin Architect) — the 3D editor for placing/rotating tiles and assigning stories — is out of scope here. The world map is seeded from `new_world.json` in the migration.

---

## Out of scope

- Admin architect / map editor (Plan 6)
- Tile rotation in the dreamer view (tiles are always oriented as seeded)
- Audio upload during migration (audio added via admin stories UI after deploy)
- Dream token / alex_dream_image on tile face (images shown in popup only)
- Mobile-specific 3D optimisations beyond basic Suspense loading
- Sensory moment text for terrain tiles (field kept on tiles table, not populated in seed)
- Cloud/particle fog overlay (material tint used instead)
- ElevenLabs TTS

---

## Schema Changes — Migration 006

### New table: `stories`

```sql
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
  on public.stories for select using (auth.uid() is not null);

grant select on public.stories to authenticated;
grant select, insert, update, delete on public.stories to service_role;
```

### `tiles` table changes

1. **Add `model text`** — GLB filename (e.g. `grass-forest.glb`). Nullable; `undefined`-type tiles have no model.
2. **Add `rotation int not null default 0`** — 0–5, each unit = 60° clockwise around Y axis.
3. **Add `story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL`** — nullable FK.
4. **Extend type CHECK** — add `'undefined'`: `check (type in ('undefined', 'mother_tree', 'story', 'terrain'))`.
5. **Make `name` nullable** — `undefined` tiles have no display name.
6. **Drop story content columns** — `story_text`, `audio_url`, `alex_tip`, `default_token_image_url`, `alex_dream_image_url`. Content moves to `stories`.
7. **Keep `sensory_moment_text`** — used by terrain tiles, stays on `tiles`.
8. **Keep `terrain_type`** — unchanged.

### Data reset

Before schema changes:
```sql
delete from public.child_tile_states;
delete from public.dream_submissions;
delete from public.tile_unlocks;
delete from public.tiles;
```

This is safe — beta-only data, no production users.

### Seed: stories library

Create stories rows with fixed UUIDs for stable referencing in the tile seed. Stories with content (text + alex_tip) pulled from existing tile data. Remaining known story names seeded as title-only placeholders.

```sql
insert into public.stories (id, title, story_text, alex_tip) values
  ('10000000-0000-0000-0000-000000000001',
   'Mother Tree',
   '<full story text from existing tile>',
   '<full alex_tip from existing tile>'),
  ('10000000-0000-0000-0000-000000000002',
   'The Tinkle Trunk',
   '<full story text from existing tile>',
   '<full alex_tip from existing tile>'),
  ('10000000-0000-0000-0000-000000000003',
   'The Upside-down Waterfall',
   '<full story text from existing tile>',
   '<full alex_tip from existing tile>'),
  ('10000000-0000-0000-0000-000000000004', 'Raindrop Castle', null, null),
  ('10000000-0000-0000-0000-000000000005', 'The Syrup Tree', null, null),
  ('10000000-0000-0000-0000-000000000006', 'Dragon Mountains', null, null),
  ('10000000-0000-0000-0000-000000000007', 'Elven Forest', null, null),
  ('10000000-0000-0000-0000-000000000008', 'Sun Cave', null, null),
  ('10000000-0000-0000-0000-000000000009', 'The Lighthouse', null, null);
```

### Seed: tiles from new_world.json

Import all 54 tiles from `/root/fo-dream-stories-gemini/public/maps/new_world.json`. Each JSON tile maps to:

| JSON field | DB column |
|---|---|
| `q` | `position_q` |
| `r` | `position_r` |
| `model` | `model` |
| `type` | `type` (mother_tree special-cased: JSON has `type:"story"` for the mother tree; detect by `storyId === "S1"` and set `type = 'mother_tree'`) |
| `rotation` | `rotation` |
| `name` (if present) | `name` |

Story tile → `story_id` assignments:
- `storyId: "S1"` (q=-1, r=1) → `story_id = '10000000-0000-0000-0000-000000000001'` (Mother Tree)
- `storyId: "S1774454970528"` (q=-2, r=4, building-house.glb) → `story_id = '10000000-0000-0000-0000-000000000002'` (The Tinkle Trunk)
- `storyId: "S1774454867487"` (q=4, r=0, river-start.glb) → `story_id = '10000000-0000-0000-0000-000000000003'` (The Upside-down Waterfall)

### Seed: tile_unlocks graph

Derived from `linkedToStoryId` in new_world.json. For each tile with `linkedToStoryId = X`, find the tile whose `storyId = X` in the JSON — that is the `from_tile_id`. The tile with `linkedToStoryId` is the `to_tile_id`.

Resulting unlock edges:
- Mother Tree tile → all tiles with `linkedToStoryId: "S1"` (terrain ring + building-house + river-start)
- river-start tile → all tiles with `linkedToStoryId: "S1774454867487"` (4 dirt tiles)

### GLB models

Copy `public/models/` from `/root/fo-dream-stories-gemini/public/models/` to `/root/fo-dream-stories/public/models/`. This includes all Kenney GLBs + the custom `0 - mother tree2.glb`.

---

## TypeScript Types (`lib/types.ts`)

### New: `Story`

```ts
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
```

### Updated: `Tile`

Remove: `story_text`, `audio_url`, `alex_tip`, `default_token_image_url`, `alex_dream_image_url`

Add:
```ts
model: string | null
rotation: number
story_id: string | null
```

Change:
```ts
type: 'undefined' | 'mother_tree' | 'story' | 'terrain'
name: string | null
```

### Updated: `MappedTile`

Add:
```ts
story: Story | null  // joined from stories table via story_id FK
```

---

## 3D Dreamer Map

### New dependencies

```json
"@react-three/fiber": "^8",
"@react-three/drei": "^9",
"three": "^0.170"
```

Also add to `tsconfig.json` if needed: `"moduleResolution": "bundler"` (already set for Next.js 16).

### `app/(app)/map/page.tsx` changes

1. Replace `HexGrid` import with `DreamerMapCanvas`
2. Remove `FloatingTilePreview` inline component entirely (tile selection shown in 3D scene)
3. Remove `flippedTileId` state and all related flip logic — the 2D tile-flip for Alex's dream reveal is gone; Alex's dream image is shown only inside `TilePopup`
4. Update `tile.alex_dream_image_url` reference at `handleTileClick` (line ~162): `tile.alex_dream_image_url` → `tile.story?.alex_dream_image_url`
5. Update tiles query: `supabase.from('tiles').select('*, story:stories(*)')`
6. Add `if (tile.type === 'undefined') return null` as **first line** of `getInitialState`
7. Pass `selectedTile` to `DreamerMapCanvas` for highlight rendering
8. In `handleDreamComplete`, update the unlock-propagation fetch (currently `supabase.from('tiles').select('*').in('id', toIds)`) to `select('*, story:stories(*)')`, and update its cast from `(newTileRows as Tile[])` to `(newTileRows as (Tile & { story: Story | null })[])`. Everything else in `handleDreamComplete` is unchanged.
9. `DreamSubmissionDrawer`, `drawerTile` state, and `handleDreamComplete` are otherwise unchanged — confirm these are not inadvertently removed when clearing `flippedTileId`.

**Files deleted:** `components/map/HexGrid.tsx`, `components/map/HexTile.tsx` — these will cause compile errors once `Tile` drops its story content fields; delete them as the first step.

### New component: `components/map/DreamerMapCanvas.tsx`

Full-screen Three.js canvas. Props:
```ts
interface DreamerMapCanvasProps {
  tiles: MappedTile[]
  selectedTileId: string | null
  onTileClick: (tile: MappedTile) => void
}
```

Internals:
```tsx
<Canvas shadows>
  <Suspense fallback={null}>
    <PerspectiveCamera makeDefault position={[cameraX, 20, cameraZ + 15]} />
    <MapControls
      enableRotate={false}
      enablePan={true}
      enableZoom={true}
      minDistance={8}
      maxDistance={50}
    />
    <Environment preset="forest" />
    <ambientLight intensity={0.8} />
    <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
    {tiles.map(tile => (
      <DreamerHexTile
        key={tile.id}
        tile={tile}
        isSelected={selectedTileId === tile.id}
        onClick={onTileClick}
      />
    ))}
  </Suspense>
</Canvas>
```

Initial camera target: Mother Tree world position (`axialToWorld(-1, 1)`). Camera starts at `[motherX, 20, motherZ + 15]` with target `[motherX, 0, motherZ]`.

### New component: `components/map/DreamerHexTile.tsx`

Loads and renders a single GLB tile with state-based material overrides.

```ts
interface DreamerHexTileProps {
  tile: MappedTile
  isSelected: boolean
  onClick: (tile: MappedTile) => void
}
```

**World position:**
```ts
const X_SPACING = 1.732
const Z_SPACING = 1.5
const worldX = X_SPACING * (tile.position_q + tile.position_r / 2)
const worldZ = Z_SPACING * tile.position_r
const worldY = isSelected ? 0.5 : 0  // selected tile lifts
```

**Rotation:** `tile.rotation * (Math.PI / 3)` around Y axis.

**Material overrides by state:**

| state | material change |
|---|---|
| `revealed` | `color = #444444`, `opacity = 0.5`, `transparent = true` |
| `unlocked` (terrain) | no override — full Kenney colors |
| `unlocked` (story/mother_tree) | desaturate: multiply color by 0.3 (greyscale) |
| `listened` | desaturate 0.6 + amber emissive `#f59e0b` intensity 0.15 |
| `completed` | full color + amber emissive `#f59e0b` intensity 0.3 (pulsed via `useFrame`) |

Amber pulse: `useFrame` increments a time ref; emissive intensity = `0.2 + 0.15 * Math.sin(t * 2)`.

**Selection ring:** when `isSelected`, render a `<mesh>` with `ringGeometry` (inner=0.85, outer=0.92, 6 segments) at y=0.05, `meshBasicMaterial color="#a78bfa"`.

**Click:** `onClick` on the `<group>`. Stop propagation with `e.stopPropagation()`.

**GLB cloning:** clone scene with `scene.clone()` and traverse to override materials, to avoid mutating shared GLB cache.

### `lib/hex.ts` addition

Add `axialToWorld` alongside existing `axialToPixel`:
```ts
export const HEX_X_SPACING = 1.732
export const HEX_Z_SPACING = 1.5

export function axialToWorld(q: number, r: number): { x: number; z: number } {
  return {
    x: HEX_X_SPACING * (q + r / 2),
    z: HEX_Z_SPACING * r,
  }
}
```

---

## Consumer Component Updates

All components that read story content fields must use the `story` join:

### `components/map/TilePopup.tsx`
- `tile.alex_dream_image_url` → `tile.story?.alex_dream_image_url` — **3 occurrences** (inside `AlexDreamModal` + two conditional renders in the main component)
- `tile.alex_tip` → `tile.story?.alex_tip` — **2 occurrences** (inside `AlexDreamModal` + one fallback text block)
- `tile.name` — unchanged (map label stays on tile)

### `components/fo/FOMascot.tsx`
- `tile.alex_dream_image_url` → `tile.story?.alex_dream_image_url`
- When `selectedTile?.story?.fo_image_url` is set, FOMascot renders that image instead of the default `/fo-reading.png`. This makes FO appear story-specific: e.g. selecting the Upside-down Waterfall tile shows a custom FO-at-the-waterfall illustration. Falls back to default image when `fo_image_url` is null.

### `components/dream/ImageAcceptance.tsx`
- `tile.default_token_image_url` → `tile.story?.default_token_image_url`
- `tile.alex_tip` → `tile.story?.alex_tip`

### `app/(app)/story/[tileId]/page.tsx`
- Query: `supabase.from('tiles').select('*, story:stories(*)')`
- The result must be typed as `Tile & { story: Story | null }` (not plain `Tile`) before spreading into the page's tile state. The existing `tileData as Tile` cast must become `tileData as Tile & { story: Story | null }`.

### `components/story/ListeningMode.tsx`
- `tile.story_text` → `tile.story?.story_text`
- `tile.audio_url` → `tile.story?.audio_url`
- `tile.name` (rendered directly, e.g. as heading) → `tile.name ?? ''` — `name` is now `string | null`

### `components/story/ReadingMode.tsx`
- `tile.story_text` → `tile.story?.story_text`
- `tile.alex_tip` → `tile.story?.alex_tip`
- `tile.name` (rendered directly) → `tile.name ?? ''`

---

## Admin Changes

### Remove pages
- `app/(admin)/admin/tiles/` (all routes)
- `app/(admin)/admin/unlocks/`
- `app/api/admin/tiles/` (all routes)
- `app/api/admin/unlocks/`

### Keep unchanged
- `/admin` (dashboard/stats)
- `/admin/moderation`
- `/admin/settings`
- All corresponding API routes

### Add: `/admin/stories`

**`GET /api/admin/stories`** — list all stories:
```ts
select id, title,
  (story_text is not null and story_text != '') as has_story_text,
  (audio_url is not null) as has_audio,
  (alex_tip is not null) as has_alex_tip
from stories order by created_at
```

**`POST /api/admin/stories`** — create (title required)

**`GET /api/admin/stories/[id]`** — full story record

**`PATCH /api/admin/stories/[id]`** — update any fields

**`POST /api/admin/stories/[id]/upload-fo-image`** — upload FO mascot image for this story to Supabase Storage (`story-images/fo/${storyId}/...`), update `stories.fo_image_url`

**`DELETE /api/admin/stories/[id]`** — delete (tiles.story_id set to NULL via FK cascade)

### Admin stories pages

**`app/(admin)/admin/stories/page.tsx`** — list with status indicators (text ✓/✗, audio ✓/✗, alex_tip ✓/✗) + "New story" button.

**`app/(admin)/admin/stories/new/page.tsx`** and **`app/(admin)/admin/stories/[id]/page.tsx`** — form with: title, story_text (textarea), alex_tip (textarea), audio upload (`AudioUpload` component reused), FO mascot image upload (image file input — uploads to `story-images/fo/${storyId}/`, stores URL in `stories.fo_image_url`; shows current image if set), alex_dream_image regen (`AlexImageSection` updated to receive `Story` and pass `storyId` to `/api/admin/regenerate-alex-image`).

### Updated: `POST /api/admin/regenerate-alex-image`
- Old body: `{ tileId, alexTip }`
- New body: `{ storyId, alexTip }`
- Old storage path: `alex-dreams/${tileId}/...`
- New storage path: `alex-dreams/stories/${storyId}/...`
- Updates `stories.alex_dream_image_url` instead of `tiles.alex_dream_image_url`

### Updated nav (`app/(admin)/admin/layout.tsx`)

```ts
const NAV = [
  { href: '/admin',            label: 'Dashboard' },
  { href: '/admin/stories',    label: 'Stories' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/settings',   label: 'Settings' },
]
```

---

## Existing tests

New 3D components (`DreamerMapCanvas`, `DreamerHexTile`) are canvas-based — Three.js does not render in jsdom. Do not create unit test files for them.

**Delete these test files** (their subjects are being removed):
- `__tests__/components/map/HexGrid.test.tsx`
- `__tests__/components/map/HexTile.test.tsx`
- `__tests__/admin/tiles.test.ts`
- `__tests__/admin/unlocks.test.ts`

**Update these test files** (their `MappedTile` fixtures reference fields being removed — `story_text`, `audio_url`, `alex_tip`, `default_token_image_url`, `alex_dream_image_url` — which must be removed from fixtures and replaced with `story: null` or an appropriate `Story` object):
- `__tests__/components/map/TilePopup.test.tsx` — remove old story content fields from tile fixture; add `story: null`. Also fix two pre-existing broken text assertions that do not match current component output: `/heart of the dream world/i` (no such string in component) and `/peek at Alex/i` (component renders "See Alex's dream"). Update or remove these assertions to match actual rendered text.
- `__tests__/components/dream/ImageAcceptance.test.tsx` — remove `default_token_image_url` from tile fixture; add `story: { default_token_image_url: '/default.png', alex_tip: null, ... }`
- `__tests__/components/story/ListeningMode.test.tsx` — remove `story_text`, `audio_url`; add `story: { story_text: '...', audio_url: null, ... }`. Also fix pre-existing broken assertion `/Preparing/i` (component does not render this text); update to match actual rendered content.
- `__tests__/components/story/ReadingMode.test.tsx` — remove `story_text`, `alex_tip`; add `story: { story_text: '...', alex_tip: null, ... }`; also update any assertion on `tile.name` (now nullable)
- `__tests__/components/fo/FOMascot.test.tsx` — no tile fixture in this test file; no fixture changes needed. The component source file (`FOMascot.tsx`) still needs its `tile.alex_dream_image_url` reference updated to `tile.story?.alex_dream_image_url` as noted in the consumer updates section above.

---

## Deployment notes

- Supabase project: `tdoqdiyalenignhitxgj` (original, not the Gemini project)
- Vercel auto-deploys from `main` branch — no manual deploy needed
- `public/models/` GLB files are large; committed to git and served as static assets from Vercel CDN
- `next.config.ts`: no changes needed — GLBs are served from `public/` directly
