---
title: Admin Map + Stories — Design Spec
date: 2026-03-21
status: approved
---

# Admin Map + Stories — Design Spec

## Goal

Replace the admin tile table view with a full visual hex map editor. Stories become independent entities with their own library page. Admins edit the map by clicking tiles and assigning types, story links, and unlock relationships through a side panel — without ever leaving the map view.

---

## Background

The current admin panel manages tiles in a list table. This is not useful: Kobe needs to see the actual hex map, place stories geographically, and define which tiles unlock others. The redesign has two independent parts:

1. **Stories library** — CRUD for story content (text, audio, images), decoupled from map position
2. **Admin map** — visual hex editor for tile types, story assignments, and unlock graph

---

## Schema Changes (Migration 006)

### New table: `stories`

```sql
create table public.stories (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null,
  story_text              text,
  audio_url               text,
  alex_tip                text,
  sensory_moment_text     text,
  default_token_image_url text,
  alex_dream_image_url    text,
  created_at              timestamptz not null default now()
);
```

RLS: readable by authenticated users; admin write access via service role.

### `tiles` table changes

1. **Add `story_id` FK** — `uuid REFERENCES public.stories(id) ON DELETE SET NULL`, nullable
2. **Extend type CHECK** — add `'undefined'` to the existing enum: `('undefined', 'mother_tree', 'story', 'terrain')`
3. **Make `name` nullable** — `undefined` tiles have no human name
4. **Drop story content columns** — `story_text`, `audio_url`, `alex_tip`, `sensory_moment_text`, `default_token_image_url`, `alex_dream_image_url` (all move to `stories`)

### Data migration (run in 006 before dropping columns)

For each existing tile where `type IN ('story', 'mother_tree')`:
1. Create a `stories` row from the tile's content columns, using tile's `name` as `title`
2. Set `tiles.story_id = stories.id`

Approach: use a WITH + UPDATE CTE in the migration SQL.

### Tile seeding (run in 006, after schema changes)

Insert all hex coordinates within axial radius 18 (1,027 tiles) as `type = 'undefined'`, `name = NULL`, `ON CONFLICT (position_q, position_r) DO NOTHING`. Existing tiles are untouched.

```sql
insert into public.tiles (type, position_q, position_r)
select 'undefined', q, r
from (
  select gs1.x as q, gs2.x as r
  from generate_series(-18, 18) gs1(x)
  cross join generate_series(-18, 18) gs2(x)
  where abs(gs1.x) <= 18
    and abs(gs2.x) <= 18
    and abs(gs1.x + gs2.x) <= 18
) coords
on conflict (position_q, position_r) do nothing;
```

---

## TypeScript Types (`lib/types.ts`)

### New type

```ts
export interface Story {
  id: string
  title: string
  story_text: string | null
  audio_url: string | null
  alex_tip: string | null
  sensory_moment_text: string | null
  default_token_image_url: string | null
  alex_dream_image_url: string | null
  created_at: string
}
```

### Updated `Tile` type

- Remove: `story_text`, `audio_url`, `alex_tip`, `sensory_moment_text`, `default_token_image_url`, `alex_dream_image_url`
- Add: `story_id: string | null`
- Add: `story?: Pick<Story, 'id' | 'title'>` (optional join, present on map endpoint)
- Change type field: `type: 'undefined' | 'mother_tree' | 'story' | 'terrain'`
- Make `name` nullable: `name: string | null`

**Tile name after migration:**
- `story`/`mother_tree` tiles: retain a non-null `name` (migration copies story title into `tile.name`). `tile.name` is the map display label; it stays editable independently from `story.title`.
- `terrain` tiles: retain existing non-null names.
- `undefined` tiles: `name = NULL`.

**Null-guard audit:** `undefined`-type tiles never appear in the consumer app (blocked by `getInitialState` returning `null`). Consumer components referencing `tile.name` (e.g. `TilePopup`, `HexTile`, `ReadingMode`) do not need null guards — they will never receive an `undefined` tile. Admin components must handle `name === null` for `undefined` tiles (show placeholder or omit).

---

## API Endpoints

### Admin map endpoints

**`GET /api/admin/map-tiles`**
Returns all tiles with `story` join (id + title only):
```ts
select tiles.*, stories(id, title)
```
Used by the admin map to render all 1,027 tiles.

**`PATCH /api/admin/map-tiles/[id]`**
Updates `type`, `story_id`, `name`, `terrain_type` for a single tile.
Body: `{ type?, story_id?, name?, terrain_type? }`

### Stories endpoints

**`GET /api/admin/stories`** — list all stories (id, title, has_story_text, has_audio_url, has_alex_dream_image_url). Boolean fields are derived as `IS NOT NULL AND != ''` checks on the corresponding columns (empty string = not set).

**`POST /api/admin/stories`** — create new story (title required)

**`GET /api/admin/stories/[id]`** — full story record

**`PATCH /api/admin/stories/[id]`** — update any story fields

**`DELETE /api/admin/stories/[id]`** — delete story (sets linked tiles.story_id to NULL via FK cascade)

### Existing endpoints to update

- `GET /api/admin/tiles/[id]` — update to remove dropped columns, add story_id
- `PATCH /api/admin/tiles/[id]` — same
- `GET/PUT /api/admin/unlocks` — unchanged; used in linked-tiles mode
- `POST /api/admin/regenerate-alex-image` — updated to operate on stories (not tiles):
  - Old request body: `{ tileId, alexTip }`
  - New request body: `{ storyId, alexTip }`
  - Old storage path: `alex-dreams/${tileId}/...`
  - New storage path: `alex-dreams/stories/${storyId}/...`
  - Updates `stories.alex_dream_image_url` instead of `tiles.alex_dream_image_url`
  - `AlexImageSection` component must be updated to pass `storyId` instead of `tile.id`; the component receives a `Story` (not `Tile`) in the new story detail page

### Consumer story experience

**`GET /api/story/[tileId]`** (or wherever tiles are fetched for the story reading page) — needs to join through `story_id` to get `stories.story_text`, `stories.audio_url`, etc. Update the fetch to include the stories join.

---

## Pages

### `/admin/map` — Visual hex map editor

**Layout:** Full main area. The page negates the admin layout's `p-8` padding with `-m-8` so the map fills the available space. The sidebar nav remains. Result: sidebar nav (left) + full-height map + side panel (right).

**Map rendering:**
- Uses the existing `react-zoom-pan-pinch` TransformWrapper/TransformComponent pattern
- New `AdminHexGrid` component wraps all tiles; new `AdminHexTile` component renders each tile
- All 1,027 tiles rendered; pan + zoom to navigate
- On initial load, map centers on (0,0) — the Mother Tree

**Tile visuals:**
- Scale: 95% of slot (creates a natural gap between tiles — achieved via `transform: scale(0.95)` on the hex shape)
- Colors by type:
  - `undefined`: `#6b7280` (medium gray)
  - `terrain` (forest): `#166534`
  - `terrain` (water): `#1e40af`
  - `terrain` (mountain): `#78716c`
  - `terrain` (land): `#374151`
  - `story`: `#7c3aed`
  - `mother_tree`: `#7c3aed` (same purple, distinct icon/label)
- Selected tile: brighter ring/glow, no fill change
- In linked-tiles mode: non-undefined tiles at full opacity; `undefined` tiles at 30% opacity and non-clickable; linked tiles pulsing

**Side panel (right, 320px, sticky):**
Appears at all times (not on click). Shows selected tile or placeholder when nothing selected.

Sections:
1. **Type selector** — buttons: `undefined | terrain | story | mother_tree`. Click updates tile immediately (PATCH).
2. **Terrain type** (only when type = terrain) — dropdown: forest / water / mountain / land
3. **Name** (only when type = terrain or mother_tree) — text input, debounced save
4. **Story** (only when type = story) — dropdown listing all stories by title + "— None —". Selecting assigns story_id. Link to story detail page. "+ New story" option navigates to /admin/stories/new.
5. **Linked tiles** — button, always visible when type ≠ undefined. Enters linked-tiles editing mode.

**Linked-tiles mode:**
- Overlay header: "Tiles unlocked when [tile name / story title] is completed"
- Map dims (all tiles opacity 40%)
- Non-undefined tiles return to full opacity and are clickable
- Currently linked tiles show in amber/gold
- Click to toggle (add/remove from tile_unlocks)
- Changes apply immediately (PUT /api/admin/unlocks with full updated graph)
- "Done" button (in side panel, or top bar) exits mode

**Performance note:** `react-zoom-pan-pinch` uses CSS transforms (not DOM virtualization) — all 1,027 tiles are mounted in the DOM simultaneously. In practice this is fine (1k simple DOM nodes render quickly), but the implementer should do a quick paint check on first load and consider `will-change: transform` on the map container if needed.

---

### `/admin/stories` — Story library

**Layout:** Standard admin padded layout.

**Content:**
- Page header: "Stories" + "New story" button
- Table/card list:
  - Title
  - Status indicators: text ✓/✗, audio ✓/✗, alex image ✓/✗
  - Assigned to: tile name or "Not assigned"
  - Edit link → `/admin/stories/[id]`
- Empty state: "No stories yet. Create your first story."

---

### `/admin/stories/[id]` and `/admin/stories/new` — Story detail/edit

**Layout:** Standard admin padded layout.

**Content:**
- Text fields: Title, Story text (textarea), Alex's tip, Sensory moment text
- Audio: AudioUpload component (same as current tile form)
- Default token image: upload field
- Alex's dream image: AlexImageSection component (regenerate via DALL-E 3)
- Assigned tile: read-only display (e.g., "Assigned to: Mother Tree (0,0)")
- Save button, Delete button (with confirmation for stories assigned to tiles)

---

## Navigation changes (`app/(admin)/admin/layout.tsx`)

Remove: `Tiles`, `Unlock Graph`
Add: `Map` (→ `/admin/map`), `Stories` (→ `/admin/stories`)

New NAV:
```ts
const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/map', label: 'Map' },
  { href: '/admin/stories', label: 'Stories' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/settings', label: 'Settings' },
]
```

The old `/admin/tiles`, `/admin/tiles/new`, `/admin/tiles/[id]`, `/admin/unlocks` pages are deleted.

---

## Component breakdown

| Component | Location | Purpose |
|---|---|---|
| `AdminHexGrid` | `components/admin/map/AdminHexGrid.tsx` | Wrapper with react-zoom-pan-pinch, renders all admin tiles |
| `AdminHexTile` | `components/admin/map/AdminHexTile.tsx` | Single hex tile for admin map; type-colored, 95% scale, click handler |
| `TileSidePanel` | `components/admin/map/TileSidePanel.tsx` | Right panel: type selector, story picker, linked tiles button |
| `LinkedTilesMode` | `components/admin/map/LinkedTilesMode.tsx` | Overlay mode for editing tile_unlocks on the map |
| `StoryForm` | `components/admin/StoryForm.tsx` | Create/edit story (replaces TileForm for story content) |

Reused with updates: `AlexImageSection` — currently receives a `Tile` and passes `tileId`; must be updated to receive a `Story` and pass `storyId` to `/api/admin/regenerate-alex-image`

Reused unchanged: `AudioUpload`

---

## Consumer app changes

**Strategy: `stories: Story | null` nested join on `MappedTile`**

Add `stories: Story | null` to `MappedTile`. Update all Supabase selects to `select('*, stories(*)')`. Update every consumer component that reads story content fields to use `tile.stories?.field`. Story tiles retain a non-null `tile.name` (set during migration from story title) — map display label code (`tile.name`) is unchanged.

#### `lib/types.ts`

- `Tile` type: remove `story_text`, `audio_url`, `alex_tip`, `sensory_moment_text`, `default_token_image_url`, `alex_dream_image_url`
- `MappedTile` (extends `Tile` + state): add `stories: Story | null`

#### `app/(app)/map/page.tsx`

1. Update tiles query: `select('*, stories(*)')` instead of `select('*')`
2. Update `getInitialState`: add `if (tile.type === 'undefined') return null` as the **first check** — prevents any undefined tile (including those adjacent to Mother Tree) from appearing on the consumer map
3. Existing `filter(tile => stateMap[tile.id] !== undefined)` already removes null-state tiles — undefined-type tiles are fully invisible after step 2

#### `components/map/TilePopup.tsx`

- `tile.alex_dream_image_url` → `tile.stories?.alex_dream_image_url`
- `tile.alex_tip` → `tile.stories?.alex_tip`
- `tile.name` — unchanged (map label, stays on tiles row)

#### `components/map/HexTile.tsx`

- `tile.alex_dream_image_url` → `tile.stories?.alex_dream_image_url`
- `tile.name` — unchanged

#### `components/fo/FOMascot.tsx`

- `tile.alex_dream_image_url` → `tile.stories?.alex_dream_image_url`

#### `components/dream/ImageAcceptance.tsx`

- `tile.default_token_image_url` → `tile.stories?.default_token_image_url`
- `tile.alex_tip` → `tile.stories?.alex_tip`

#### `app/(app)/story/[tileId]/page.tsx` + `ListeningMode` + `ReadingMode`

- Story page query: `select('*, stories(*)')`
- `ListeningMode`: `tile.story_text` → `tile.stories?.story_text`, `tile.audio_url` → `tile.stories?.audio_url`
- `ReadingMode`: same replacements; also `tile.alex_tip` → `tile.stories?.alex_tip`

---

## Out of scope

- Story ordering / sequence (stories are a library, map defines adjacency)
- Multi-language support
- Story versioning
- Image upload for stories (other than Alex's dream image and token image) — future
- Mobile admin map editing — desktop-only for now
