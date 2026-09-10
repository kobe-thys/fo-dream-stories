# Admin Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin/map` visual hex editor so Kobe can see the full hex grid, click an empty slot to place a new tile, click an existing tile to edit its type/story/terrain, and define unlock relationships — all without leaving the map view.

**Architecture:** A 2D CSS hex map (react-zoom-pan-pinch) renders all hex positions within radius 25 client-side — no pre-seeding. Positions that have a DB tile show colored; empty positions show as dim outlines and can be clicked to create a tile. A sticky right panel handles edits. Linked-tiles mode lets the admin toggle `tile_unlocks` entries.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind v4, `react-zoom-pan-pinch` (already installed), Supabase admin client, `axialToPixel` + `HEX_SIZE` from `lib/hex.ts`.

---

## Current State

Already done in prior plans:
- `stories` table, `Story` type, all `/api/admin/stories/*` routes, admin stories pages — **COMPLETE**
- `Tile` type updated (has `story_id`, no story content columns, `name` nullable, type includes `'undefined'`) — **COMPLETE**
- `MappedTile` has `story: Story | null`, consumer map + story pages use `story:stories(*)` join — **COMPLETE**
- Admin layout already has `Stories` nav; old `Tiles`/`Unlock Graph` nav items removed — **COMPLETE**
- DB: 54 existing tiles — **no seeding needed; grid positions are generated client-side**

**What this plan builds:**
1. API: `GET /api/admin/map-tiles`, `POST /api/admin/map-tiles`, `PATCH /api/admin/map-tiles/[id]`
2. API: `GET/PUT /api/admin/unlocks`
3. Components: `AdminHexGrid`, `AdminHexTile`, `TileSidePanel`, `LinkedTilesModeHeader`
4. Page: `/admin/map`
5. Nav: add "Map" link

---

## File Structure

**New files:**
- `app/api/admin/map-tiles/route.ts` — GET all DB tiles; POST create tile
- `app/api/admin/map-tiles/[id]/route.ts` — PATCH tile (type, story_id, name, terrain_type)
- `app/api/admin/unlocks/route.ts` — GET all unlocks; PUT replace by from_tile_id
- `components/admin/map/AdminHexTile.tsx` — single hex: DB tile (colored) or empty slot (dim)
- `components/admin/map/AdminHexGrid.tsx` — zoom/pan canvas; generates positions; renders tiles + empty slots
- `components/admin/map/TileSidePanel.tsx` — right panel: type/terrain/story/name/linked-tiles
- `components/admin/map/LinkedTilesModeHeader.tsx` — top overlay bar for linked-tiles mode
- `app/(admin)/admin/map/page.tsx` — assembles everything

**Modified files:**
- `app/(admin)/admin/layout.tsx` — add "Map" nav link
- `lib/hex.ts` — confirm `HEX_SIZE` is exported

---

## Task 1: Admin map-tiles API

**Files:**
- Create: `app/api/admin/map-tiles/route.ts`
- Create: `app/api/admin/map-tiles/[id]/route.ts`

- [ ] **Step 1: Create `app/api/admin/map-tiles/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db
    .from('tiles')
    .select('id, type, name, position_q, position_r, terrain_type, story_id, story:stories(id, title)')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { q, r } = await req.json()
  if (q === undefined || r === undefined) {
    return NextResponse.json({ error: 'q and r required' }, { status: 400 })
  }
  const { data, error } = await db
    .from('tiles')
    .insert({ type: 'undefined', position_q: q, position_r: r })
    .select('id, type, name, position_q, position_r, terrain_type, story_id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, story: null }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/admin/map-tiles/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const db = adminClient()
  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if ('type' in body)         patch.type = body.type
  if ('story_id' in body)     patch.story_id = body.story_id
  if ('name' in body)         patch.name = body.name
  if ('terrain_type' in body) patch.terrain_type = body.terrain_type
  const { error } = await db.from('tiles').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Test GET `/api/admin/map-tiles`**

Visit while logged in as admin. Should return 54 tiles as JSON. Each has `story: null` or `story: { id, title }`.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/map-tiles/
git commit -m "feat: admin map-tiles API — GET all, POST create, PATCH update"
```

---

## Task 2: Admin unlocks API

**Files:**
- Create: `app/api/admin/unlocks/route.ts`

- [ ] **Step 1: Create `app/api/admin/unlocks/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db.from('tile_unlocks').select('from_tile_id, to_tile_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Replaces all unlocks for a single from_tile_id
// Body: { from_tile_id: string; to_tile_ids: string[] }
export async function PUT(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { from_tile_id, to_tile_ids }: { from_tile_id: string; to_tile_ids: string[] } = await req.json()
  await db.from('tile_unlocks').delete().eq('from_tile_id', from_tile_id)
  if (to_tile_ids.length > 0) {
    const rows = to_tile_ids.map(to_tile_id => ({ from_tile_id, to_tile_id }))
    const { error } = await db.from('tile_unlocks').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Test GET `/api/admin/unlocks`**

Should return the existing unlock rows (all pointing from Mother Tree's UUID).

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/unlocks/route.ts
git commit -m "feat: admin unlocks API — GET all, PUT replace by from_tile_id"
```

---

## Task 3: Export HEX_SIZE from lib/hex.ts

**Files:**
- Modify: `lib/hex.ts`

- [ ] **Step 1: Check `lib/hex.ts` line 1**

Open `lib/hex.ts`. Line 2 should read `export const HEX_SIZE = 44`. If it says `const HEX_SIZE` (not exported), add `export`.

- [ ] **Step 2: Commit (only if changed)**

```bash
git add lib/hex.ts
git commit -m "fix: export HEX_SIZE from lib/hex.ts"
```

---

## Task 4: AdminHexTile component

**Files:**
- Create: `components/admin/map/AdminHexTile.tsx`

Renders either a DB tile (colored hex) or an empty slot (dim dashed hex). Both are clickable.

- [ ] **Step 1: Create `components/admin/map/AdminHexTile.tsx`**

```tsx
'use client'
import { axialToPixel, HEX_SIZE } from '@/lib/hex'
import { TileType, TerrainType } from '@/lib/types'

export const HEX_W = Math.sqrt(3) * HEX_SIZE   // ~76.2px
export const HEX_H = 2 * HEX_SIZE               // 88px
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

export function tileColor(type: TileType, terrainType: TerrainType | null): string {
  if (type === 'story' || type === 'mother_tree') return '#7c3aed'
  if (type === 'terrain') {
    if (terrainType === 'forest')   return '#166534'
    if (terrainType === 'water')    return '#1e40af'
    if (terrainType === 'mountain') return '#78716c'
    return '#374151'  // land or null
  }
  return '#6b7280'  // undefined
}

export interface AdminTile {
  id: string
  type: TileType
  name: string | null
  position_q: number
  position_r: number
  terrain_type: TerrainType | null
  story_id: string | null
  story: { id: string; title: string } | null
}

interface Props {
  tile: AdminTile | null    // null = empty slot (no DB row yet)
  q: number
  r: number
  offsetX: number
  offsetY: number
  isSelected: boolean
  isLinked: boolean
  linkedMode: boolean
  onClick: (q: number, r: number, tile: AdminTile | null) => void
}

export default function AdminHexTile({ tile, q, r, offsetX, offsetY, isSelected, isLinked, linkedMode, onClick }: Props) {
  const { x, y } = axialToPixel(q, r)
  const left = offsetX + x - HEX_W / 2
  const top  = offsetY + y - HEX_H / 2

  // In linked mode, empty slots and undefined tiles are non-clickable
  const isClickable = !linkedMode || (tile !== null && tile.type !== 'undefined')
  const opacity = linkedMode && (!tile || tile.type === 'undefined') ? 0.2 : 1

  let filter: string | undefined
  if (isSelected) filter = 'drop-shadow(0 0 8px #a78bfa) brightness(1.3)'
  else if (isLinked && linkedMode) filter = 'drop-shadow(0 0 6px #f59e0b) brightness(1.2)'

  return (
    <div
      onClick={() => isClickable && onClick(q, r, tile)}
      style={{
        position: 'absolute',
        left,
        top,
        width: HEX_W,
        height: HEX_H,
        opacity,
        cursor: isClickable ? 'pointer' : 'default',
        filter,
        userSelect: 'none',
      }}
    >
      {tile ? (
        // DB tile — filled colored hex
        <div
          style={{
            width: '100%',
            height: '100%',
            clipPath: HEX_CLIP,
            backgroundColor: tileColor(tile.type, tile.terrain_type),
            transform: 'scale(0.95)',
            transformOrigin: 'center',
          }}
        />
      ) : (
        // Empty slot — dim outline only
        <div
          style={{
            width: '100%',
            height: '100%',
            clipPath: HEX_CLIP,
            backgroundColor: 'transparent',
            border: '1px dashed rgba(255,255,255,0.08)',
            transform: 'scale(0.95)',
            transformOrigin: 'center',
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/map/AdminHexTile.tsx
git commit -m "feat: AdminHexTile — DB tile (colored) or empty slot (dim outline)"
```

---

## Task 5: AdminHexGrid component

**Files:**
- Create: `components/admin/map/AdminHexGrid.tsx`

Generates all positions within `GRID_RADIUS = 25` client-side. Looks up each position in the tile map. Canvas is 4400×3600px with the origin (Mother Tree) at the center.

- [ ] **Step 1: Create `components/admin/map/AdminHexGrid.tsx`**

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import AdminHexTile, { AdminTile } from './AdminHexTile'

const GRID_RADIUS = 25
const CANVAS_W = 4400
const CANVAS_H = 3600
export const OFFSET_X = CANVAS_W / 2  // 2200
export const OFFSET_Y = CANVAS_H / 2  // 1800

// Generate all valid axial positions within radius R
function generatePositions(radius: number): { q: number; r: number }[] {
  const positions: { q: number; r: number }[] = []
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) <= radius) {
        positions.push({ q, r })
      }
    }
  }
  return positions
}

const ALL_POSITIONS = generatePositions(GRID_RADIUS)

interface Props {
  tiles: AdminTile[]
  selectedTileId: string | null
  linkedTileIds: Set<string>
  linkedMode: boolean
  onTileClick: (q: number, r: number, tile: AdminTile | null) => void
}

export default function AdminHexGrid({ tiles, selectedTileId, linkedTileIds, linkedMode, onTileClick }: Props) {
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Build lookup map: "q,r" → AdminTile
  const tileMap = new Map<string, AdminTile>()
  for (const tile of tiles) {
    tileMap.set(`${tile.position_q},${tile.position_r}`, tile)
  }

  useEffect(() => {
    if (!transformRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = rect.width / 2 - OFFSET_X
    const y = rect.height / 2 - OFFSET_Y
    transformRef.current.setTransform(x, y, 1, 0)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#111827' }}
    >
      <TransformWrapper
        ref={transformRef}
        minScale={0.1}
        maxScale={4}
        limitToBounds={false}
        panning={{ velocityDisabled: true }}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: CANVAS_W, height: CANVAS_H, position: 'relative', willChange: 'transform' }}
        >
          {ALL_POSITIONS.map(({ q, r }) => {
            const tile = tileMap.get(`${q},${r}`) ?? null
            const key = `${q},${r}`
            return (
              <AdminHexTile
                key={key}
                tile={tile}
                q={q}
                r={r}
                offsetX={OFFSET_X}
                offsetY={OFFSET_Y}
                isSelected={tile !== null && tile.id === selectedTileId}
                isLinked={tile !== null && linkedTileIds.has(tile.id)}
                linkedMode={linkedMode}
                onClick={onTileClick}
              />
            )
          })}
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/map/AdminHexGrid.tsx
git commit -m "feat: AdminHexGrid — zoom/pan canvas with client-generated grid (radius 25)"
```

---

## Task 6: TileSidePanel component

**Files:**
- Create: `components/admin/map/TileSidePanel.tsx`

Calls `PATCH /api/admin/map-tiles/[id]` directly. Debounces name input (300ms). Calls `onTileUpdated` after a successful save.

- [ ] **Step 1: Create `components/admin/map/TileSidePanel.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { TileType, TerrainType } from '@/lib/types'
import { AdminTile } from './AdminHexTile'

interface StoryOption { id: string; title: string }

interface Props {
  tile: AdminTile | null
  stories: StoryOption[]
  onTileUpdated: (updated: AdminTile) => void
  onLinkedTilesClick: () => void
}

async function patchTile(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`/api/admin/map-tiles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return res.ok
}

const TERRAIN_OPTIONS: { value: TerrainType; label: string }[] = [
  { value: 'forest',   label: 'Forest' },
  { value: 'water',    label: 'Water' },
  { value: 'mountain', label: 'Mountain' },
  { value: 'land',     label: 'Land' },
]

export default function TileSidePanel({ tile, stories, onTileUpdated, onLinkedTilesClick }: Props) {
  const [name, setName] = useState(tile?.name ?? '')
  const nameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setName(tile?.name ?? '')
  }, [tile?.id, tile?.name])

  async function handleTypeChange(type: TileType) {
    if (!tile) return
    const ok = await patchTile(tile.id, { type })
    if (ok) onTileUpdated({ ...tile, type })
  }

  async function handleTerrainTypeChange(terrainType: TerrainType | null) {
    if (!tile) return
    const ok = await patchTile(tile.id, { terrain_type: terrainType })
    if (ok) onTileUpdated({ ...tile, terrain_type: terrainType })
  }

  function handleNameInput(value: string) {
    setName(value)
    if (nameTimerRef.current) clearTimeout(nameTimerRef.current)
    nameTimerRef.current = setTimeout(async () => {
      if (!tile) return
      const ok = await patchTile(tile.id, { name: value || null })
      if (ok) onTileUpdated({ ...tile, name: value || null })
    }, 300)
  }

  async function handleStoryChange(storyId: string | null) {
    if (!tile) return
    const story = storyId ? (stories.find(s => s.id === storyId) ?? null) : null
    const ok = await patchTile(tile.id, { story_id: storyId })
    if (ok) onTileUpdated({ ...tile, story_id: storyId, story })
  }

  const typeButtons: TileType[] = ['undefined', 'terrain', 'story', 'mother_tree']

  if (!tile) {
    return (
      <aside style={{ width: 320, minWidth: 320 }} className="bg-gray-900 border-l border-gray-800 p-5 flex flex-col gap-4">
        <p className="text-gray-500 text-sm">Click a tile to edit it, or click an empty hex to place a new tile.</p>
      </aside>
    )
  }

  return (
    <aside style={{ width: 320, minWidth: 320 }} className="bg-gray-900 border-l border-gray-800 p-5 flex flex-col gap-5 overflow-y-auto">

      {/* Coordinates */}
      <p className="text-xs text-gray-600 font-mono">
        ({tile.position_q}, {tile.position_r})
        {tile.name ? ` · ${tile.name}` : ''}
      </p>

      {/* Type selector */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Type</p>
        <div className="flex flex-wrap gap-2">
          {typeButtons.map(t => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tile.type === t
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Terrain type dropdown — terrain only */}
      {tile.type === 'terrain' && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Terrain type</p>
          <select
            value={tile.terrain_type ?? ''}
            onChange={e => handleTerrainTypeChange((e.target.value as TerrainType) || null)}
            className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-700"
          >
            <option value="">— None —</option>
            {TERRAIN_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Name — terrain and mother_tree only */}
      {(tile.type === 'terrain' || tile.type === 'mother_tree') && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Name</p>
          <input
            type="text"
            value={name}
            onChange={e => handleNameInput(e.target.value)}
            placeholder="Tile name"
            className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-700 placeholder-gray-600"
          />
        </div>
      )}

      {/* Story picker — story type only */}
      {tile.type === 'story' && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Story</p>
          <select
            value={tile.story_id ?? ''}
            onChange={e => handleStoryChange(e.target.value || null)}
            className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-700"
          >
            <option value="">— None —</option>
            {stories.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          {tile.story_id && (
            <Link
              href={`/admin/stories/${tile.story_id}`}
              className="text-xs text-violet-400 hover:text-violet-300 mt-1 block"
            >
              Edit story →
            </Link>
          )}
          <Link href="/admin/stories/new" className="text-xs text-gray-500 hover:text-gray-300 mt-1 block">
            + New story
          </Link>
        </div>
      )}

      {/* Linked tiles — all non-undefined tiles */}
      {tile.type !== 'undefined' && (
        <div className="pt-2 border-t border-gray-800">
          <button
            onClick={onLinkedTilesClick}
            className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors text-left"
          >
            Linked tiles (unlocks when completed) →
          </button>
        </div>
      )}
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/map/TileSidePanel.tsx
git commit -m "feat: TileSidePanel — type/terrain/story editor with debounced name save"
```

---

## Task 7: LinkedTilesModeHeader component

**Files:**
- Create: `components/admin/map/LinkedTilesModeHeader.tsx`

The overlay bar shown when editing unlock links. State (which tiles are linked) lives in the page — this component just shows the label and Done button.

- [ ] **Step 1: Create `components/admin/map/LinkedTilesModeHeader.tsx`**

```tsx
'use client'
import { AdminTile } from './AdminHexTile'

interface Props {
  fromTile: AdminTile
  onDone: () => void
}

export default function LinkedTilesModeHeader({ fromTile, onDone }: Props) {
  const label = fromTile.name ?? fromTile.story?.title ?? `(${fromTile.position_q}, ${fromTile.position_r})`
  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-4 px-5 py-3 bg-gray-950 border-b border-amber-800 shadow-lg">
      <span className="text-amber-400 text-sm font-semibold">
        Tiles unlocked when &quot;{label}&quot; is completed
      </span>
      <span className="text-gray-500 text-xs">Click non-undefined tiles to toggle</span>
      <button
        onClick={onDone}
        className="ml-auto px-4 py-1.5 bg-amber-700 text-amber-100 rounded-lg text-sm hover:bg-amber-600 transition-colors"
      >
        Done
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/map/LinkedTilesModeHeader.tsx
git commit -m "feat: LinkedTilesModeHeader — overlay for tile unlock editing mode"
```

---

## Task 8: /admin/map page

**Files:**
- Create: `app/(admin)/admin/map/page.tsx`

Client component: fetches tiles + stories + unlocks, manages selected tile, linked mode state, and tile creation.

- [ ] **Step 1: Create `app/(admin)/admin/map/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { AdminTile } from '@/components/admin/map/AdminHexTile'
import TileSidePanel from '@/components/admin/map/TileSidePanel'
import LinkedTilesModeHeader from '@/components/admin/map/LinkedTilesModeHeader'

// react-zoom-pan-pinch accesses the DOM on import — SSR off
const AdminHexGrid = dynamic(() => import('@/components/admin/map/AdminHexGrid'), { ssr: false })

interface StoryOption { id: string; title: string }

export default function AdminMapPage() {
  const [tiles, setTiles]           = useState<AdminTile[]>([])
  const [stories, setStories]       = useState<StoryOption[]>([])
  const [allUnlocks, setAllUnlocks] = useState<{ from_tile_id: string; to_tile_id: string }[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedTile, setSelectedTile] = useState<AdminTile | null>(null)
  const [linkedMode, setLinkedMode] = useState(false)
  const [linkedIds, setLinkedIds]   = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/map-tiles').then(r => r.json()),
      fetch('/api/admin/stories').then(r => r.json()),
      fetch('/api/admin/unlocks').then(r => r.json()),
    ]).then(([tileData, storyData, unlockData]) => {
      setTiles(tileData)
      setStories(storyData.map((s: { id: string; title: string }) => ({ id: s.id, title: s.title })))
      setAllUnlocks(unlockData)
      setLoading(false)
    })
  }, [])

  async function handleTileClick(q: number, r: number, tile: AdminTile | null) {
    if (linkedMode) {
      // Toggle linked tile (only non-undefined DB tiles are clickable in linked mode)
      if (!selectedTile || !tile) return
      const next = linkedIds.includes(tile.id)
        ? linkedIds.filter(id => id !== tile.id)
        : [...linkedIds, tile.id]
      setLinkedIds(next)
      setAllUnlocks(prev => {
        const filtered = prev.filter(u => u.from_tile_id !== selectedTile.id || u.to_tile_id !== tile.id)
        return next.includes(tile.id)
          ? [...filtered, { from_tile_id: selectedTile.id, to_tile_id: tile.id }]
          : filtered
      })
      await fetch('/api/admin/unlocks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_tile_id: selectedTile.id, to_tile_ids: next }),
      })
      return
    }

    if (tile) {
      // Select existing tile
      setSelectedTile(tile)
    } else {
      // Create tile at empty position
      const res = await fetch('/api/admin/map-tiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, r }),
      })
      if (!res.ok) return
      const newTile: AdminTile = await res.json()
      setTiles(prev => [...prev, newTile])
      setSelectedTile(newTile)
    }
  }

  function handleTileUpdated(updated: AdminTile) {
    setTiles(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelectedTile(updated)
  }

  function enterLinkedMode() {
    if (!selectedTile) return
    const current = allUnlocks
      .filter(u => u.from_tile_id === selectedTile.id)
      .map(u => u.to_tile_id)
    setLinkedIds(current)
    setLinkedMode(true)
  }

  function exitLinkedMode() {
    setLinkedMode(false)
    setLinkedIds([])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading map...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative' }} className="-m-8">

      {/* Map area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {linkedMode && selectedTile && (
          <LinkedTilesModeHeader fromTile={selectedTile} onDone={exitLinkedMode} />
        )}
        <AdminHexGrid
          tiles={tiles}
          selectedTileId={selectedTile?.id ?? null}
          linkedTileIds={new Set(linkedIds)}
          linkedMode={linkedMode}
          onTileClick={handleTileClick}
        />
      </div>

      {/* Side panel */}
      <TileSidePanel
        tile={selectedTile}
        stories={stories}
        onTileUpdated={handleTileUpdated}
        onLinkedTilesClick={enterLinkedMode}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(admin\)/admin/map/
git commit -m "feat: /admin/map page — visual hex editor, create tiles on click, linked-tiles mode"
```

---

## Task 9: Add Map to admin nav + push

**Files:**
- Modify: `app/(admin)/admin/layout.tsx`

- [ ] **Step 1: Update NAV in `app/(admin)/admin/layout.tsx`**

Change:
```typescript
const NAV = [
  { href: '/admin',            label: 'Dashboard' },
  { href: '/admin/stories',    label: 'Stories' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/settings',   label: 'Settings' },
]
```

To:
```typescript
const NAV = [
  { href: '/admin',            label: 'Dashboard' },
  { href: '/admin/map',        label: 'Map' },
  { href: '/admin/stories',    label: 'Stories' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/settings',   label: 'Settings' },
]
```

- [ ] **Step 2: Commit and push**

```bash
git add app/\(admin\)/admin/layout.tsx
git commit -m "feat: add Map to admin nav"
git push
```

- [ ] **Step 3: Verify on Vercel**

After deploy, visit `https://fo-dream-stories.vercel.app/admin/map`. Confirm:
- Map loads with all 54 existing tiles colored + ~1927 dim empty slots
- Mother Tree is at center on initial load
- Click an empty hex → tile appears in side panel as 'undefined', gets added to DB
- Click existing tile → side panel shows type/terrain/story controls
- Type buttons update tile color immediately
- Story picker dropdown shows all stories
- "Linked tiles" button enters amber overlay mode; clicking a non-undefined tile toggles the unlock and saves immediately
- "Done" exits linked mode

---

## Task 10: Full map reset (delete all tiles)

**Files:**
- Modify: `app/api/admin/map-tiles/route.ts` — add DELETE handler
- Modify: `app/(admin)/admin/map/page.tsx` — add Reset button

The reset deletes all tiles, tile_unlocks, and child_tile_states (orphaned user progress for deleted tiles). Dream submissions are left intact (they contain the kids' submitted dreams which are precious). The button requires typing "RESET" to confirm.

- [ ] **Step 1: Add DELETE handler to `app/api/admin/map-tiles/route.ts`**

Add this function at the bottom of the file (after the existing POST):

```typescript
export async function DELETE() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  // Delete child_tile_states first (FK to tiles)
  await db.from('child_tile_states').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  // Delete tile_unlocks (FK to tiles)
  await db.from('tile_unlocks').delete().neq('from_tile_id', '00000000-0000-0000-0000-000000000000')
  // Delete all tiles
  const { error } = await db.from('tiles').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

Note: Supabase requires a filter on delete — `.neq('id', '00000000-...')` is a safe "match all" filter that will never exclude real rows (Supabase UUIDs use `gen_random_uuid()`).

- [ ] **Step 2: Add Reset button to `/admin/map` page**

In `app/(admin)/admin/map/page.tsx`, add a `resetMap` function and a danger button. Add just below the `exitLinkedMode` function:

```typescript
async function resetMap() {
  const input = window.prompt('Type RESET to delete all tiles and start over:')
  if (input !== 'RESET') return
  const res = await fetch('/api/admin/map-tiles', { method: 'DELETE' })
  if (!res.ok) { alert('Reset failed'); return }
  setTiles([])
  setSelectedTile(null)
  setAllUnlocks([])
  setLinkedMode(false)
}
```

And add a button in the map area div (above the LinkedTilesModeHeader), visible only when not in linked mode:

```tsx
{/* Map area */}
<div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
  {linkedMode && selectedTile && (
    <LinkedTilesModeHeader fromTile={selectedTile} onDone={exitLinkedMode} />
  )}
  {!linkedMode && (
    <div className="absolute top-3 right-3 z-10">
      <button
        onClick={resetMap}
        className="px-3 py-1.5 bg-red-950 text-red-400 border border-red-900 rounded-lg text-xs hover:bg-red-900 transition-colors"
      >
        Reset all tiles
      </button>
    </div>
  )}
  <AdminHexGrid ... />
</div>
```

- [ ] **Step 3: Commit and push**

```bash
git add app/api/admin/map-tiles/route.ts app/\(admin\)/admin/map/page.tsx
git commit -m "feat: admin map reset — DELETE all tiles with double-confirm prompt"
git push
```

- [ ] **Step 4: Test reset**

On the live admin map, click "Reset all tiles", type `RESET`, confirm. Map should clear to all dim empty slots. Visiting `/map` as a consumer should show the empty initial map (no tiles).

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| No pre-seeded tiles — build organically | Design decision: grid generated client-side |
| `GET /api/admin/map-tiles` with story join | Task 1 |
| `POST /api/admin/map-tiles` — create tile at q,r | Task 1 |
| `PATCH /api/admin/map-tiles/[id]` | Task 1 |
| `GET /api/admin/unlocks` | Task 2 |
| `PUT /api/admin/unlocks` (replace by from_tile_id) | Task 2 |
| `HEX_SIZE` exported from lib/hex.ts | Task 3 |
| AdminHexTile — DB tile colored, empty slot dim | Task 4 |
| AdminHexGrid — radius 25, zoom/pan, center on (0,0) | Task 5 |
| TileSidePanel — type/terrain/story/name/linked-tiles | Task 6 |
| LinkedTilesModeHeader — overlay with Done button | Task 7 |
| `/admin/map` page with tile creation on click | Task 8 |
| Nav: add Map | Task 9 |
| Full map reset with double-confirm | Task 10 |

### Notes

- `GET /api/admin/stories` already exists and returns `{ id, title, ... }` — the page fetches it and extracts `id` + `title` for the side panel dropdown.
- `AdminHexGrid` uses `dynamic(..., { ssr: false })` to avoid react-zoom-pan-pinch DOM access at build time — same pattern as the consumer `DreamerMapCanvas`.
- The tileMap in AdminHexGrid rebuilds on every render. For 54→hundreds of tiles this is negligible; React will only re-render if `tiles` prop actually changes.
- `GRID_RADIUS = 25` gives ~1981 positions. All are rendered as DOM nodes (following the spec's note that 1k simple DOM nodes is fine). The `willChange: 'transform'` hint on the canvas helps the browser optimize the zoom/pan.
- Empty slot rendering uses `backgroundColor: 'transparent'` — the dashed border won't render through clip-path. Adjust to use a subtle fill if the outline isn't visible enough in practice (e.g., `backgroundColor: 'rgba(255,255,255,0.03)'`).
