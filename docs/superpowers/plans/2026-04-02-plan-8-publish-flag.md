# Map Publish Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `published` flag to tiles so admins can freely edit the map without immediately affecting dreamers, then publish all drafts in one click.

**Architecture:** A single `published boolean` column on the `tiles` table controls visibility. The consumer map and story page filter to `published = true` only. The admin map shows all tiles — draft tiles render with an amber tint to distinguish them. A "Publish all" button (visible when drafts exist) calls a new `/api/admin/map-tiles/publish` endpoint that marks all tiles published at once. Existing tiles are migrated to `published = true` to preserve continuity; new tiles created via admin default to `false`.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS), react-three-fiber, TypeScript, Tailwind v4.

---

## Current State

- Consumer map: `app/(app)/map/page.tsx` — queries `supabase.from('tiles').select('*, story:stories(*)')` with no published filter
- Consumer story page: `app/(app)/story/[tileId]/page.tsx` — queries single tile with no published filter
- Admin map tiles API: `app/api/admin/map-tiles/route.ts` — GET selects fields without `published`; POST inserts without `published`
- `AdminTile` interface: lives in `components/admin/map/AdminHexTile.tsx`, has no `published` field
- No publish endpoint exists yet

---

## File Structure

**New files:**
- `supabase/migrations/008_published_flag.sql` — DB migration
- `app/api/admin/map-tiles/publish/route.ts` — POST endpoint to publish all draft tiles

**Modified files:**
- `components/admin/map/AdminHexTile.tsx` — add `published: boolean` to AdminTile; amber tint for draft tiles
- `app/api/admin/map-tiles/route.ts` — include `published` in GET select; explicit `published: false` in POST insert
- `app/(admin)/admin/map/page.tsx` — compute unpublished count; add "Publish all" button; handle publish action
- `app/(app)/map/page.tsx` — add `.eq('published', true)` to tiles query
- `app/(app)/story/[tileId]/page.tsx` — add `.eq('published', true)` to tile query; notFound() if filtered

---

## Task 1: DB migration

**Files:**
- Create: `supabase/migrations/008_published_flag.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================================
-- Migration 008: published flag on tiles
-- Existing tiles → published = true (continuity for live users)
-- New tiles will default to false (draft until published)
-- ============================================================

-- Add column with default true so existing tiles stay visible
ALTER TABLE public.tiles ADD COLUMN published boolean NOT NULL DEFAULT true;

-- Change default to false so new tiles created via admin are drafts
ALTER TABLE public.tiles ALTER COLUMN published SET DEFAULT false;
```

Save to `supabase/migrations/008_published_flag.sql`.

- [ ] **Step 2: Run the migration against the live DB**

```bash
source /root/.secrets/tokens.env
curl -s -X POST "https://api.supabase.com/v1/projects/tdoqdiyalenignhitxgj/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "ALTER TABLE public.tiles ADD COLUMN published boolean NOT NULL DEFAULT true; ALTER TABLE public.tiles ALTER COLUMN published SET DEFAULT false;"}'
```

Expected response: `{"results":[{"rows":[],...}]}` (no error key).

- [ ] **Step 3: Verify**

```bash
source /root/.secrets/tokens.env
curl -s -X POST "https://api.supabase.com/v1/projects/tdoqdiyalenignhitxgj/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name='"'"'tiles'"'"' AND column_name='"'"'published'"'"';"}'
```

Expected: `column_name: published`, `column_default: false`, `is_nullable: NO`.

- [ ] **Step 4: Commit**

```bash
cd /root/fo-dream-stories
git add supabase/migrations/008_published_flag.sql
git commit -m "feat: migration 008 — add published flag to tiles (existing tiles published, new tiles draft)"
```

---

## Task 2: Admin API — include published in GET, explicit false in POST, new publish endpoint

**Files:**
- Modify: `app/api/admin/map-tiles/route.ts`
- Create: `app/api/admin/map-tiles/publish/route.ts`

- [ ] **Step 1: Update GET select and POST insert in `app/api/admin/map-tiles/route.ts`**

In the GET handler, add `published` to the select string:

```typescript
  const { data, error } = await db
    .from('tiles')
    .select('id, type, name, position_q, position_r, terrain_type, model, rotation, story_id, published, story:stories(id, title)')
    .order('created_at', { ascending: true })
```

In the POST handler, add `published: false` explicitly to the insert:

```typescript
  const { data, error } = await db
    .from('tiles')
    .insert({ type: 'undefined', position_q: q, position_r: r, model: model ?? null, rotation: 0, published: false })
    .select('id, type, name, position_q, position_r, terrain_type, model, rotation, story_id, published')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, story: null }, { status: 201 })
```

- [ ] **Step 2: Create `app/api/admin/map-tiles/publish/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function POST() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { error } = await db
    .from('tiles')
    .update({ published: true })
    .eq('published', false)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: TypeScript check + commit**

```bash
cd /root/fo-dream-stories
npx tsc --noEmit 2>&1 | head -20
git add app/api/admin/map-tiles/route.ts app/api/admin/map-tiles/publish/route.ts
git commit -m "feat: map-tiles API — published in GET/POST; publish endpoint"
```

---

## Task 3: AdminHexTile — published field + draft visual

**Files:**
- Modify: `components/admin/map/AdminHexTile.tsx`

Draft tiles render with an amber tint at reduced opacity so admins can clearly distinguish unpublished tiles from live ones. The `published` field is added to `AdminTile` and read directly inside the model component — no prop interface changes needed since `tile` is already passed in full.

- [ ] **Step 1: Add `published` to `AdminTile` and update `PlaceholderTile`**

In `AdminTile` interface, add:
```typescript
  published: boolean
```

Full updated interface:
```typescript
export interface AdminTile {
  id: string
  type: TileType
  name: string | null
  position_q: number
  position_r: number
  terrain_type: TerrainType | null
  model: string | null
  rotation: number
  story_id: string | null
  story: { id: string; title: string } | null
  published: boolean
}
```

Update `PlaceholderProps` to accept `published`:
```typescript
interface PlaceholderProps {
  position: [number, number, number]
  isSelected: boolean
  published: boolean
  onClick: () => void
}
```

Update `PlaceholderTile` body:
```typescript
function PlaceholderTile({ position, isSelected, published, onClick }: PlaceholderProps) {
  return (
    <mesh position={position} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <cylinderGeometry args={[0.85, 0.85, 0.15, 6]} />
      <meshStandardMaterial
        color={isSelected ? '#a78bfa' : (published ? '#374151' : '#92400e')}
        transparent
        opacity={published ? 0.7 : 0.5}
      />
    </mesh>
  )
}
```

- [ ] **Step 2: Add draft tint to `AdminHexTileModel`**

In the `cloned` useMemo, add a draft branch after the `isMoving` check. The full material logic becomes:

```typescript
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone()
      mat.transparent = true
      if (isBlockedByOtherStory) {
        mat.color.setHex(0x444444)
        mat.opacity = 0.4
      } else if (isLinkedToSelected) {
        mat.emissive = new THREE.Color(0x00ffff)
        mat.emissiveIntensity = 0.4
        mat.opacity = 0.8
      } else if (!tile.published) {
        mat.color.setHex(0x92400e) // amber-800 — draft tint
        mat.opacity = 0.55
      } else {
        mat.opacity = isMoving ? 0.6 : 1
      }
      mesh.material = mat
    })
    return c
  }, [scene, isMoving, isBlockedByOtherStory, isLinkedToSelected, tile.published])
```

- [ ] **Step 3: Pass `published` to `PlaceholderTile` in the default export**

```typescript
export default function AdminHexTile(props: Props) {
  const { tile, isSelected, onClick } = props
  const { x, z } = axialToWorld(tile.position_q, tile.position_r)

  if (!tile.model) {
    return (
      <PlaceholderTile
        position={[x, 0, z]}
        isSelected={isSelected}
        published={tile.published}
        onClick={() => onClick(tile.id, false, false)}
      />
    )
  }

  return <AdminHexTileModel {...props} />
}
```

- [ ] **Step 4: TypeScript check + commit**

```bash
cd /root/fo-dream-stories
npx tsc --noEmit 2>&1 | head -20
git add components/admin/map/AdminHexTile.tsx
git commit -m "feat: AdminHexTile — published field, amber draft tint"
```

---

## Task 4: Admin map page — "Publish all" button

**Files:**
- Modify: `app/(admin)/admin/map/page.tsx`

The unpublished count is derived directly from the `tiles` state array (no extra state variable needed). The button is shown in the top-right corner next to "Reset all tiles", only when `unpublishedCount > 0`.

- [ ] **Step 1: Add `handlePublishAll` and the button**

After the `resetMap` function, add:

```typescript
  async function handlePublishAll() {
    const res = await fetch('/api/admin/map-tiles/publish', { method: 'POST' })
    if (!res.ok) { alert('Publish failed'); return }
    setTiles(prev => prev.map(t => ({ ...t, published: true })))
  }
```

Derive the count just before the `return` (after the loading check):

```typescript
  const unpublishedCount = tiles.filter(t => !t.published).length
```

- [ ] **Step 2: Add the button to the JSX**

Replace the existing top-right button container:

```tsx
        {!linkedMode && (
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            {unpublishedCount > 0 && (
              <button
                onClick={handlePublishAll}
                className="px-3 py-1.5 bg-amber-600 text-white border border-amber-500 rounded-lg text-xs hover:bg-amber-500 transition-colors"
              >
                Publish all ({unpublishedCount} draft{unpublishedCount !== 1 ? 's' : ''})
              </button>
            )}
            <button
              onClick={resetMap}
              className="px-3 py-1.5 bg-red-950 text-red-400 border border-red-900 rounded-lg text-xs hover:bg-red-900 transition-colors"
            >
              Reset all tiles
            </button>
          </div>
        )}
```

- [ ] **Step 3: TypeScript check + commit**

```bash
cd /root/fo-dream-stories
npx tsc --noEmit 2>&1 | head -20
git add "app/(admin)/admin/map/page.tsx"
git commit -m "feat: admin map — Publish all button for draft tiles"
```

---

## Task 5: Consumer filter — only published tiles visible to dreamers

**Files:**
- Modify: `app/(app)/map/page.tsx`
- Modify: `app/(app)/story/[tileId]/page.tsx`

- [ ] **Step 1: Add published filter to the consumer map page**

In `app/(app)/map/page.tsx`, find the tiles query (line ~49):

```typescript
      supabase.from('tiles').select('*, story:stories(*)').order('created_at', { ascending: true }),
```

Change to:

```typescript
      supabase.from('tiles').select('*, story:stories(*)').eq('published', true).order('created_at', { ascending: true }),
```

- [ ] **Step 2: Add published filter to the story page**

In `app/(app)/story/[tileId]/page.tsx`, find the tile query (line ~26):

```typescript
        supabase.from('tiles').select('*, story:stories(*)').eq('id', tileId).single(),
```

Change to:

```typescript
        supabase.from('tiles').select('*, story:stories(*)').eq('id', tileId).eq('published', true).single(),
```

The existing `if (!tile) { notFound() }` guard below already handles the case where the tile is not found (because it's unpublished or doesn't exist). No additional changes needed.

- [ ] **Step 3: Run tests**

```bash
cd /root/fo-dream-stories
npm test 2>&1 | tail -15
```

Expected: all tests pass (these changes don't affect the test suite since tests don't hit Supabase).

- [ ] **Step 4: TypeScript check + commit**

```bash
cd /root/fo-dream-stories
npx tsc --noEmit 2>&1 | head -20
git add "app/(app)/map/page.tsx" "app/(app)/story/[tileId]/page.tsx"
git commit -m "feat: consumer map — only published tiles visible to dreamers"
```

---

## Self-Review

**Spec coverage:**
- ✅ `published` column added with correct defaults (existing = true, new = false)
- ✅ Consumer map filters to published only
- ✅ Story page filters to published only (notFound gracefully)
- ✅ Admin sees all tiles; draft tiles visually distinct (amber tint)
- ✅ "Publish all" button with draft count, hidden when no drafts
- ✅ New tiles created via admin POST default to `published: false`
- ✅ Publish endpoint is admin-gated

**Placeholder scan:** No TBDs, no vague steps. All code blocks are complete.

**Type consistency:**
- `AdminTile.published: boolean` defined in Task 3, used in Task 4 (`t.published`)
- `published` in GET select (Task 2) matches what AdminTile expects
- POST explicitly inserts `published: false` (Task 2), consistent with DB default
