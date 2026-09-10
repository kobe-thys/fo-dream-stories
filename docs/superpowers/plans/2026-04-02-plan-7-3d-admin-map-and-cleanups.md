# Plan 7: 3D Admin Map + Renames + UI Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the admin map as a 3D hex editor (matching the dreamer's view), rename alex_tip → alex_dream throughout, remove mother_tree tile type, and fix several UI issues in admin stories and moderation.

**Architecture:** The 3D admin map replaces the 2D CSS grid with react-three-fiber + OrbitControls + Kenney GLB tiles — identical stack to DreamerMapCanvas. Tiles are only DB-backed (no pre-generated grid); clicking empty ground creates a new tile. A right panel handles model selection, type, story linking, rotation, grab/move, and delete. DB column rename (`alex_tip` → `alex_dream`) is a prerequisite and must land first.

**Tech Stack:** Next.js 16 App Router, React Three Fiber (`@react-three/fiber`), `@react-three/drei`, Three.js, Supabase admin client, TypeScript, Tailwind v4.

---

## Current State

- Consumer map: 3D, react-three-fiber, MapControls (pan/zoom, no rotate)
- Admin map: 2D CSS hex grid (react-zoom-pan-pinch) — to be replaced
- DB: `stories.alex_tip` column, `tiles.type` includes `'mother_tree'`
- `lib/hex.ts` exports: `HEX_X_SPACING = 1.732`, `HEX_Z_SPACING = 1.5`, `axialToWorld(q, r): { x, z }`
- Three.js packages already installed (used by consumer map)

---

## File Structure

**Modified files:**
- `lib/types.ts` — remove `mother_tree` from TileType, rename `alex_tip` → `alex_dream` on Story
- `components/admin/StoryForm.tsx` — rename alex_tip refs, rename label
- `components/admin/AlexImageSection.tsx` — rename refs; add upload button
- `components/admin/ModerationCard.tsx` — add lightbox for drawing thumbnail
- `components/dream/ImageAcceptance.tsx` — rename + show alex_dream image
- `components/map/DreamerMapCanvas.tsx` — MapControls → OrbitControls; remove mother_tree centering
- `components/fo/FOMascot.tsx` — remove mother_tree reference
- `app/(app)/map/page.tsx` — remove mother_tree type checks
- `app/(admin)/admin/stories/page.tsx` — rename alex_tip → alex_dream in select + display
- `app/api/admin/stories/route.ts` — rename in select
- `app/(admin)/admin/stories/new/page.tsx` — rename initial value
- `app/api/admin/regenerate-alex-image/route.ts` — rename body param alexTip → alexDream
- `app/api/admin/map-tiles/route.ts` — GET adds model/rotation to select
- `app/api/admin/map-tiles/[id]/route.ts` — PATCH adds model, rotation, position_q, position_r
- `components/admin/map/AdminHexTile.tsx` — complete rewrite: AdminTile adds model/rotation; 3D component
- `components/admin/map/AdminHexGrid.tsx` — complete rewrite: 3D canvas with OrbitControls
- `components/admin/map/TileSidePanel.tsx` — complete rewrite: model picker, rotation, grab, delete
- `app/(admin)/admin/map/page.tsx` — update state: add isMoving, modelFiles, selectedModel

**New files:**
- `app/api/admin/stories/[id]/upload-alex-dream-image/route.ts` — upload image to storage, set alex_dream_image_url
- `app/api/admin/models/route.ts` — returns list of .glb filenames from public/models/

**Test files to update (fixtures only, no logic changes):**
- `__tests__/components/map/TilePopup.test.tsx`
- `__tests__/components/story/ReadingMode.test.tsx`
- `__tests__/components/story/ListeningMode.test.tsx`
- `__tests__/components/dream/ImageAcceptance.test.tsx`

---

## Task 1: DB migration

**Files:** none (SQL run via curl)

- [ ] **Step 1: Run the migration**

```bash
source /root/.secrets/tokens.env
curl -s -X POST "https://api.supabase.com/v1/projects/tdoqdiyalenignhitxgj/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "ALTER TABLE stories RENAME COLUMN alex_tip TO alex_dream; UPDATE tiles SET type = '"'"'story'"'"' WHERE type = '"'"'mother_tree'"'"';"}'
```

Expected response: `{"results":[{"rows":[],...},...]}` (no error key).

- [ ] **Step 2: Verify**

```bash
source /root/.secrets/tokens.env
curl -s -X POST "https://api.supabase.com/v1/projects/tdoqdiyalenignhitxgj/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT column_name FROM information_schema.columns WHERE table_name='"'"'stories'"'"' AND column_name IN ('"'"'alex_tip'"'"','"'"'alex_dream'"'"'); SELECT DISTINCT type FROM tiles;"}'
```

Expected: `alex_dream` column present, no `alex_tip`, no `mother_tree` in tile types.

---

## Task 2: Types, code renames, and remove mother_tree

**Files:**
- Modify: `lib/types.ts`
- Modify: `components/admin/StoryForm.tsx`
- Modify: `components/admin/AlexImageSection.tsx`
- Modify: `components/dream/ImageAcceptance.tsx`
- Modify: `components/map/DreamerMapCanvas.tsx`
- Modify: `components/fo/FOMascot.tsx`
- Modify: `app/(app)/map/page.tsx`
- Modify: `app/(admin)/admin/stories/page.tsx`
- Modify: `app/api/admin/stories/route.ts`
- Modify: `app/(admin)/admin/stories/new/page.tsx`
- Modify: `app/api/admin/regenerate-alex-image/route.ts`
- Modify: `components/admin/map/TileSidePanel.tsx` (only the typeButtons line)
- Modify: `components/admin/map/AdminHexTile.tsx` (only the tileColor line)
- Modify: `__tests__/components/map/TilePopup.test.tsx`
- Modify: `__tests__/components/story/ReadingMode.test.tsx`
- Modify: `__tests__/components/story/ListeningMode.test.tsx`
- Modify: `__tests__/components/dream/ImageAcceptance.test.tsx`

- [ ] **Step 1: Update `lib/types.ts`**

Change line with TileType to remove `mother_tree`:
```typescript
export type TileType = 'undefined' | 'story' | 'terrain'
```

Change Story interface field:
```typescript
  alex_dream: string | null    // was: alex_tip
```

- [ ] **Step 2: Update `components/admin/StoryForm.tsx`**

Line 33 — change body object:
```typescript
      : { title: story.title, story_text: story.story_text, alex_dream: story.alex_dream }
```

Line 99 — change textarea value and label:
```tsx
          <label className="text-xs text-gray-400 uppercase tracking-wider">Alex&apos;s Dream</label>
          <textarea
            value={story.alex_dream ?? ''}
            onChange={e => set('alex_dream', e.target.value || null)}
```

- [ ] **Step 3: Update `components/admin/AlexImageSection.tsx`**

Replace all `alex_tip` with `alex_dream`, and update the guard message:
```typescript
  async function handleRegenerate() {
    if (!story.alex_dream) { setError("Add Alex's Dream text first — it's used as the image prompt."); return }
    setGenerating(true)
    setError('')
    const res = await fetch('/api/admin/regenerate-alex-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: story.id, alexDream: story.alex_dream }),
    })
```

Also update the disabled condition:
```tsx
            disabled={generating || !story.alex_dream}
```

Also update the placeholder text:
```tsx
          <p className="text-sm text-gray-500">No Alex&apos;s Dream image yet. Add Alex&apos;s Dream text above and generate one.</p>
```

- [ ] **Step 4: Update `app/api/admin/regenerate-alex-image/route.ts`**

Change the destructure and validation:
```typescript
  const { storyId, alexDream } = await request.json()
  if (!storyId || !alexDream) return NextResponse.json({ error: 'storyId and alexDream required' }, { status: 400 })

  const prompt = `${alexDream}. ${ALEX_STYLE}`
```

- [ ] **Step 5: Update `components/dream/ImageAcceptance.tsx`**

Find the alex card block (around line 129) and update it to show the image too:
```tsx
        {tile.story?.alex_dream && (
          <div className="bg-muted rounded-2xl p-4 max-w-sm flex flex-col gap-3">
            <p className="text-sm text-foreground font-medium">Alex&apos;s Dream:</p>
            {tile.story.alex_dream_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tile.story.alex_dream_image_url}
                alt="Alex's Dream"
                style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }}
              />
            )}
            <p className="text-sm text-muted-foreground">{tile.story.alex_dream}</p>
          </div>
        )}
```

- [ ] **Step 6: Update `components/map/DreamerMapCanvas.tsx`**

Remove mother_tree centering, use origin. Change imports to use OrbitControls. Replace camera centering and controls:

```typescript
import { OrbitControls, Environment } from '@react-three/drei'
```

Remove the motherTile lookup and replace with:
```typescript
  // Centre on origin (tile at q=0, r=0 is always there)
  const cx = 0
  const cz = 0
```

Replace MapControls with:
```tsx
          <OrbitControls
            target={[cx, 0, cz]}
            enableRotate={true}
            enablePan={true}
            enableZoom={true}
            minDistance={8}
            maxDistance={50}
            screenSpacePanning={false}
          />
```

Update camera position:
```tsx
        camera={{ position: [cx, 18, cz + 18], fov: 50 }}
```

- [ ] **Step 7: Update `components/fo/FOMascot.tsx`**

Read the file first. Find the `mother_tree` check. Replace `tile.type === 'mother_tree'` with a false condition or remove that branch entirely (since mother_tree tiles no longer exist). If the check was returning a special message for the mother tree, remove that branch.

- [ ] **Step 8: Update `app/(app)/map/page.tsx`**

Find line ~116: `t.type === 'story' || t.type === 'mother_tree'` → change to `t.type === 'story'`
Find line ~152: comment or code referencing `mother_tree` — remove or simplify to just `story`.

- [ ] **Step 9: Update admin stories list page**

`app/(admin)/admin/stories/page.tsx` line 10: change select string to include `alex_dream` instead of `alex_tip`.

Line 37: change display from `s.alex_tip` to `s.alex_dream` and update label text to `alex dream`.

- [ ] **Step 10: Update admin stories API**

`app/api/admin/stories/route.ts` line 9: change `.select(...)` to include `alex_dream` instead of `alex_tip`.

Line 18: change `has_alex_tip: Boolean(s.alex_tip)` to `has_alex_dream: Boolean(s.alex_dream)`.

- [ ] **Step 11: Update stories new page**

`app/(admin)/admin/stories/new/page.tsx` line 11: change `alex_tip: null` to `alex_dream: null`.

- [ ] **Step 12: Update TileSidePanel typeButtons**

`components/admin/map/TileSidePanel.tsx` line 70: remove `'mother_tree'` from the array:
```typescript
  const typeButtons: TileType[] = ['undefined', 'terrain', 'story']
```

Also remove the name section that was `mother_tree`-specific (line 127):
```tsx
      {/* Name — terrain only */}
      {tile.type === 'terrain' && (
```

- [ ] **Step 13: Update AdminHexTile tileColor**

`components/admin/map/AdminHexTile.tsx` line 10: change:
```typescript
  if (type === 'story') return '#7c3aed'
```
(remove `|| type === 'mother_tree'`)

- [ ] **Step 14: Update test fixtures**

In each test file, replace `alex_tip:` with `alex_dream:` in the story mock objects. Replace any `type: 'mother_tree'` with `type: 'story'`.

`__tests__/components/map/TilePopup.test.tsx`:
- Line 16: `alex_dream: 'Alex found a golden trumpet.',`
- Line 62: `const motherTree: MappedTile = { ...storyTile, type: 'story', name: 'Mother Tree', childState: 'grey' }`
- Line 61: update test description to remove `mother_tree`

`__tests__/components/story/ReadingMode.test.tsx` line 15: `alex_dream: null,`
`__tests__/components/story/ListeningMode.test.tsx` line 15: `alex_dream: null,`
`__tests__/components/dream/ImageAcceptance.test.tsx` line 14: `alex_dream: null,`

- [ ] **Step 15: TypeScript check**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 16: Commit**

```bash
cd /root/fo-dream-stories && git add -A && git commit -m "feat: rename alex_tip→alex_dream, remove mother_tree type, OrbitControls on consumer map"
```

---

## Task 3: Alex's Dream image upload endpoint

**Files:**
- Create: `app/api/admin/stories/[id]/upload-alex-dream-image/route.ts`

- [ ] **Step 1: Create upload endpoint**

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
  const path = `alex-dreams/stories/${storyId}/${crypto.randomUUID()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await db.storage
    .from('dream-images')
    .upload(path, new Blob([buffer], { type: file.type }), { contentType: file.type, upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data } = db.storage.from('dream-images').getPublicUrl(path)

  const { error: updateError } = await db
    .from('stories').update({ alex_dream_image_url: data.publicUrl }).eq('id', storyId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ url: data.publicUrl })
}
```

- [ ] **Step 2: Add upload button to `components/admin/AlexImageSection.tsx`**

Add `uploadingImage` state and `handleImageUpload` function, and a hidden file input + button inside the component. Insert after the existing `<button onClick={handleRegenerate}...>` buttons:

Add to the state declarations at the top of the component:
```typescript
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
```

Add `useRef` to the import:
```typescript
import { useRef, useState } from 'react'
```

Add upload handler function:
```typescript
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    const fd = new FormData()
    fd.append('image', file)
    const res = await fetch(`/api/admin/stories/${story.id}/upload-alex-dream-image`, {
      method: 'POST',
      body: fd,
    })
    const json = await res.json()
    setUploadingImage(false)
    if (!res.ok) { setError(json.error); return }
    onUpdated({ ...story, alex_dream_image_url: json.url })
  }
```

Add hidden input and upload button alongside the Regenerate button (in both `story.alex_dream_image_url` truthy and falsy branches):
```tsx
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50 w-fit"
            >
              {uploadingImage ? 'Uploading…' : 'Upload image'}
            </button>
```

- [ ] **Step 3: TypeScript check**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /root/fo-dream-stories && git add app/api/admin/stories/\[id\]/upload-alex-dream-image/route.ts components/admin/AlexImageSection.tsx && git commit -m "feat: upload Alex's Dream image from admin stories panel"
```

---

## Task 4: Moderation drawing lightbox

**Files:**
- Modify: `components/admin/ModerationCard.tsx`

- [ ] **Step 1: Rewrite `components/admin/ModerationCard.tsx`**

Add a lightbox: clicking the thumbnail shows a full-screen overlay with the image at full size. Add `expanded` state and modal.

```tsx
'use client'
import { getAge } from '@/lib/types'
import { useState } from 'react'

interface Submission {
  id: string
  transcribed_text: string | null
  token_image_url: string | null
  input_type: string
  created_at: string
  child_profiles: { name: string; date_of_birth: string } | null
  tiles: { name: string } | null
}

interface Props {
  submission: Submission
  onRemoved: (id: string) => void
}

export default function ModerationCard({ submission, onRemoved }: Props) {
  const [expanded, setExpanded] = useState(false)
  const age = submission.child_profiles?.date_of_birth
    ? getAge(submission.child_profiles.date_of_birth)
    : '?'

  async function handleRemove() {
    if (!confirm('Remove this dream from public view?')) return
    await fetch('/api/admin/moderation', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: submission.id }),
    })
    onRemoved(submission.id)
  }

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4">
        {submission.token_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={submission.token_image_url}
            alt="Dream"
            onClick={() => setExpanded(true)}
            className="w-20 h-20 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          />
        )}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {submission.child_profiles?.name ?? 'Unknown'}, age {age}
            </span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-400">{submission.tiles?.name}</span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-500">{submission.input_type}</span>
          </div>
          <p className="text-sm text-gray-300 line-clamp-3">{submission.transcribed_text}</p>
          <p className="text-xs text-gray-600">{new Date(submission.created_at).toLocaleDateString()}</p>
        </div>
        <button
          onClick={handleRemove}
          className="shrink-0 px-3 py-1 bg-red-900/40 text-red-400 rounded-lg text-xs hover:bg-red-900/70 self-start"
        >
          Remove
        </button>
      </div>

      {expanded && submission.token_image_url && (
        <div
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={submission.token_image_url}
            alt="Dream (expanded)"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setExpanded(false)}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | head -10 && git add components/admin/ModerationCard.tsx && git commit -m "feat: moderation card — click thumbnail to expand fullscreen"
```

---

## Task 5: Stories page — audio player + FO mascot button

**Files:**
- Modify: `components/admin/StoryForm.tsx`

The audio section should show an `<audio>` player if `audio_url` is set. The FO mascot `<input type="file">` should be hidden behind a styled button.

- [ ] **Step 1: Update the audio section in `components/admin/StoryForm.tsx`**

Find the audio section (the div with label "Audio") and add an audio player beneath the AudioUpload component:

```tsx
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">Audio</label>
            <AudioUpload
              currentUrl={story.audio_url}
              onUploaded={url => set('audio_url', url)}
            />
            {story.audio_url && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio controls src={story.audio_url} className="w-full mt-1" />
            )}
            {story.story_text && (
              <button
                onClick={handleGenerateAudio}
                disabled={generatingAudio}
                className="mt-1 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 text-sm w-fit"
              >
                {generatingAudio ? 'Generating…' : '🎙 Generate audio with ElevenLabs'}
              </button>
            )}
          </div>
```

- [ ] **Step 2: Update the FO mascot section — replace plain file input with a styled button**

Replace the `<input type="file">` block with a hidden input + button pattern. Add `foFileInputRef` to the component:

Add to the state declarations at the top of StoryForm:
```typescript
  const foFileInputRef = useRef<HTMLInputElement>(null)
```

Add `useRef` to the React import:
```typescript
import { useRef, useState } from 'react'
```

Replace the FO Mascot section:
```tsx
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400 uppercase tracking-wider">FO Mascot Image</label>
            {story.fo_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={story.fo_image_url} alt="FO mascot" className="w-32 h-32 object-contain rounded-lg mb-2" />
            )}
            <input
              ref={foFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFoImageUpload}
              disabled={uploadingFo}
              className="hidden"
            />
            <button
              onClick={() => foFileInputRef.current?.click()}
              disabled={uploadingFo}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50 w-fit"
            >
              {uploadingFo ? 'Uploading…' : story.fo_image_url ? 'Replace FO image' : 'Upload FO image'}
            </button>
          </div>
```

- [ ] **Step 3: TypeScript check + commit**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | head -10 && git add components/admin/StoryForm.tsx && git commit -m "feat: stories admin — audio player preview, FO mascot upload button"
```

---

## Task 6: Copy GLB assets + /api/admin/models route

**Files:**
- Shell: copy GLBs + PNGs from gemini project
- Create: `app/api/admin/models/route.ts`

- [ ] **Step 1: Copy model files**

```bash
cp /root/fo-dream-stories-gemini/public/tiles/*.glb /root/fo-dream-stories/public/models/
cp /root/fo-dream-stories-gemini/public/tiles/*.png /root/fo-dream-stories/public/models/ 2>/dev/null || true
ls /root/fo-dream-stories/public/models/*.glb | wc -l
```

Expected: lists ~40+ .glb files.

- [ ] **Step 2: Create `app/api/admin/models/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin'
import fs from 'fs'
import path from 'path'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const modelsDir = path.join(process.cwd(), 'public', 'models')
  const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.glb')).sort()
  return NextResponse.json(files)
}
```

- [ ] **Step 3: TypeScript check + commit**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | head -10 && git add public/models/ app/api/admin/models/route.ts && git commit -m "feat: add Kenney GLB tiles to public/models, admin models API"
```

---

## Task 7: Update map-tiles API (add model, rotation, position fields)

**Files:**
- Modify: `app/api/admin/map-tiles/route.ts`
- Modify: `app/api/admin/map-tiles/[id]/route.ts`

- [ ] **Step 1: Update GET in `app/api/admin/map-tiles/route.ts`**

Change the select to include `model` and `rotation`:
```typescript
    .select('id, type, name, position_q, position_r, terrain_type, model, rotation, story_id, story:stories(id, title)')
```

Also update POST to include `model` in the insert and select, and accept it from the body:
```typescript
export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { q, r, model } = await req.json()
  if (q === undefined || r === undefined) {
    return NextResponse.json({ error: 'q and r required' }, { status: 400 })
  }
  const { data, error } = await db
    .from('tiles')
    .insert({ type: 'undefined', position_q: q, position_r: r, model: model ?? null, rotation: 0 })
    .select('id, type, name, position_q, position_r, terrain_type, model, rotation, story_id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, story: null }, { status: 201 })
}
```

- [ ] **Step 2: Update PATCH in `app/api/admin/map-tiles/[id]/route.ts`**

Add `model`, `rotation`, `position_q`, `position_r` to allowed patch fields:
```typescript
  if ('type' in body)         patch.type = body.type
  if ('story_id' in body)     patch.story_id = body.story_id
  if ('name' in body)         patch.name = body.name
  if ('terrain_type' in body) patch.terrain_type = body.terrain_type
  if ('model' in body)        patch.model = body.model
  if ('rotation' in body)     patch.rotation = body.rotation
  if ('position_q' in body)   patch.position_q = body.position_q
  if ('position_r' in body)   patch.position_r = body.position_r
```

- [ ] **Step 3: TypeScript check + commit**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | head -10 && git add app/api/admin/map-tiles/ && git commit -m "feat: map-tiles API — model, rotation, position in GET/POST/PATCH"
```

---

## Task 8: 3D AdminHexTile component (replace 2D version)

**Files:**
- Modify (full rewrite): `components/admin/map/AdminHexTile.tsx`

This file exports the `AdminTile` interface (used by TileSidePanel, LinkedTilesModeHeader, page.tsx) and the default 3D React component. The interface now includes `model` and `rotation`.

- [ ] **Step 1: Rewrite `components/admin/map/AdminHexTile.tsx`**

```tsx
'use client'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { axialToWorld } from '@/lib/hex'
import { TileType, TerrainType } from '@/lib/types'

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
}

// Keep tileColor for any 2D fallbacks; not used in the 3D view
export function tileColor(type: TileType): string {
  if (type === 'story') return '#7c3aed'
  if (type === 'terrain') return '#166534'
  return '#6b7280'
}

const MODEL_SCALE = 1.72

interface PlaceholderProps {
  position: [number, number, number]
  isSelected: boolean
  onClick: () => void
}

function PlaceholderTile({ position, isSelected, onClick }: PlaceholderProps) {
  return (
    <mesh position={position} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <cylinderGeometry args={[0.85, 0.85, 0.15, 6]} />
      <meshStandardMaterial
        color={isSelected ? '#a78bfa' : '#374151'}
        transparent
        opacity={0.7}
        wireframe={false}
      />
    </mesh>
  )
}

interface Props {
  tile: AdminTile
  isSelected: boolean
  isMoving: boolean
  isLinkedToSelected: boolean
  isBlockedByOtherStory: boolean
  onClick: (id: string, shiftKey: boolean, ctrlKey: boolean) => void
}

function AdminHexTileModel({ tile, isSelected, isMoving, isLinkedToSelected, isBlockedByOtherStory, onClick }: Props) {
  const modelPath = `/models/${tile.model}`
  const { scene } = useGLTF(modelPath)
  const groupRef = useRef<THREE.Group>(null!)

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
      } else {
        mat.opacity = isMoving ? 0.6 : 1
      }
      mesh.material = mat
    })
    return c
  }, [scene, isMoving, isBlockedByOtherStory, isLinkedToSelected])

  const { x, z } = axialToWorld(tile.position_q, tile.position_r)
  const targetY = (isSelected || isMoving) ? 0.8 : 0
  const targetRotY = (tile.rotation || 0) * (Math.PI / 3)

  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.position.lerp(new THREE.Vector3(x, targetY, z), 0.1)
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.1)
    const s = isMoving ? MODEL_SCALE * 0.9 : MODEL_SCALE
    groupRef.current.scale.lerp(new THREE.Vector3(s, s, s), 0.1)
  })

  const ringColor = isLinkedToSelected ? '#00ffff' : '#a78bfa'

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onClick(tile.id, e.shiftKey, e.ctrlKey) }}>
      <primitive object={cloned} />
      {(isSelected || isLinkedToSelected) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.88, 0.94, 6]} />
          <meshBasicMaterial color={ringColor} transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  )
}

export default function AdminHexTile(props: Props) {
  const { tile, isSelected, onClick } = props
  const { x, z } = axialToWorld(tile.position_q, tile.position_r)

  if (!tile.model) {
    return (
      <PlaceholderTile
        position={[x, 0, z]}
        isSelected={isSelected}
        onClick={() => onClick(tile.id, false, false)}
      />
    )
  }

  return <AdminHexTileModel {...props} />
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | head -20 && git add components/admin/map/AdminHexTile.tsx && git commit -m "feat: AdminHexTile — 3D GLB tile with selection, linking, blocked states"
```

---

## Task 9: 3D AdminMapCanvas (replace AdminHexGrid)

**Files:**
- Modify (full rewrite): `components/admin/map/AdminHexGrid.tsx`

This component is the 3D canvas. OrbitControls: left drag = rotate, right drag = pan, scroll = zoom. A transparent ground plane detects empty clicks for tile placement.

- [ ] **Step 1: Rewrite `components/admin/map/AdminHexGrid.tsx`**

```tsx
'use client'
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei'
import { HEX_X_SPACING, HEX_Z_SPACING } from '@/lib/hex'
import AdminHexTile, { AdminTile } from './AdminHexTile'

function axialFromWorld(x: number, z: number): { q: number; r: number } {
  const r = Math.round(z / HEX_Z_SPACING)
  const q = Math.round(x / HEX_X_SPACING - r / 2)
  return { q, r }
}

interface Props {
  tiles: AdminTile[]
  selectedTileId: string | null
  isMoving: boolean
  isLinkingMode: boolean
  linkedTileIds: Set<string>
  allUnlocks: { from_tile_id: string; to_tile_id: string }[]
  onTileClick: (id: string, shiftKey: boolean, ctrlKey: boolean) => void
  onEmptyClick: (q: number, r: number) => void
  onDeselect: () => void
}

export default function AdminHexGrid({
  tiles, selectedTileId, isMoving, isLinkingMode, linkedTileIds, allUnlocks,
  onTileClick, onEmptyClick, onDeselect,
}: Props) {
  const tilePositions = new Set(tiles.map(t => `${t.position_q},${t.position_r}`))

  function handleGroundClick(e: any) {
    if (e.delta > 5) return // drag, not click
    const { q, r } = axialFromWorld(e.point.x, e.point.z)
    if (tilePositions.has(`${q},${r}`)) return
    if (isMoving && selectedTileId) {
      // Move selected tile to this position
      onEmptyClick(q, r)
    } else if (!isLinkingMode) {
      onEmptyClick(q, r)
    }
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        shadows
        camera={{ position: [15, 15, 15], fov: 35 }}
        onPointerMissed={onDeselect}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={1} />
          <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
          <Environment preset="city" />
          <OrbitControls makeDefault />

          {tiles.map(tile => {
            const isLinkedToSelected = isLinkingMode && linkedTileIds.has(tile.id)
            // A tile is blocked if it unlocks a DIFFERENT story tile (not the current selected)
            const linkedFrom = allUnlocks.find(u => u.to_tile_id === tile.id)?.from_tile_id
            const isBlockedByOtherStory = isLinkingMode &&
              linkedFrom !== undefined &&
              linkedFrom !== selectedTileId

            return (
              <AdminHexTile
                key={tile.id}
                tile={tile}
                isSelected={tile.id === selectedTileId}
                isMoving={isMoving && tile.id === selectedTileId}
                isLinkedToSelected={isLinkedToSelected}
                isBlockedByOtherStory={isBlockedByOtherStory}
                onClick={onTileClick}
              />
            )
          })}

          {/* Invisible ground plane for click detection */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.01, 0]}
            onClick={handleGroundClick}
          >
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>

          <ContactShadows position={[0, -0.01, 0]} opacity={0.3} scale={50} blur={2} />
        </Suspense>
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | head -20 && git add components/admin/map/AdminHexGrid.tsx && git commit -m "feat: AdminHexGrid — 3D canvas with OrbitControls, ground-click placement"
```

---

## Task 10: Updated TileSidePanel (model picker, rotation, grab, delete)

**Files:**
- Modify (full rewrite): `components/admin/map/TileSidePanel.tsx`

The panel has two modes:
1. No tile selected: model picker to choose which model to place next
2. Tile selected: edit type, change model, rotate, grab/drop, delete, story picker (story type), linking (story type)

- [ ] **Step 1: Rewrite `components/admin/map/TileSidePanel.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { TileType } from '@/lib/types'
import { AdminTile } from './AdminHexTile'

interface StoryOption { id: string; title: string }

interface Props {
  tile: AdminTile | null
  stories: StoryOption[]
  modelFiles: string[]
  selectedModel: string
  onModelSelect: (model: string) => void
  isMoving: boolean
  onTileUpdated: (updated: AdminTile) => void
  onLinkedTilesClick: () => void
  onGrabToggle: () => void
  onDelete: () => void
}

async function patchTile(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`/api/admin/map-tiles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return res.ok
}

function ModelGrid({ models, selected, onSelect }: { models: string[]; selected: string; onSelect: (m: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 max-h-64 overflow-y-auto pr-1">
      {models.map(m => {
        const thumbSrc = `/models/${m.replace('.glb', '.png')}`
        const label = m.replace('.glb', '').replace(/-/g, ' ')
        return (
          <button
            key={m}
            onClick={() => onSelect(m)}
            title={label}
            className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-colors ${
              selected === m
                ? 'border-violet-500 bg-violet-900/30'
                : 'border-gray-700 bg-gray-800 hover:border-gray-600'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbSrc}
              alt={label}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              className="w-full aspect-square object-contain rounded"
            />
            <span className="text-[9px] text-gray-400 truncate w-full text-center leading-tight">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function TileSidePanel({
  tile, stories, modelFiles, selectedModel, onModelSelect,
  isMoving, onTileUpdated, onLinkedTilesClick, onGrabToggle, onDelete,
}: Props) {
  const [name, setName] = useState(tile?.name ?? '')
  const nameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (nameTimerRef.current) clearTimeout(nameTimerRef.current)
    setName(tile?.name ?? '')
  }, [tile?.id, tile?.name])

  async function handleTypeChange(type: TileType) {
    if (!tile) return
    const patch: Record<string, unknown> = { type }
    // Auto-name terrain from model filename
    if (type === 'terrain' && tile.model) {
      patch.name = tile.model.replace('.glb', '').replace(/-/g, ' ')
    }
    // Clear story link when switching away from story
    if (type !== 'story') patch.story_id = null
    const ok = await patchTile(tile.id, patch)
    if (ok) onTileUpdated({ ...tile, type, ...(patch.name !== undefined ? { name: patch.name as string } : {}), ...(type !== 'story' ? { story_id: null, story: null } : {}) })
  }

  async function handleModelChange(model: string) {
    onModelSelect(model)
    if (!tile) return
    const patch: Record<string, unknown> = { model }
    // Auto-name terrain from model filename
    if (tile.type === 'terrain') {
      patch.name = model.replace('.glb', '').replace(/-/g, ' ')
    }
    const ok = await patchTile(tile.id, patch)
    if (ok) onTileUpdated({ ...tile, model, ...(patch.name !== undefined ? { name: patch.name as string } : {}) })
  }

  async function handleRotate() {
    if (!tile) return
    const rotation = (tile.rotation + 1) % 6
    const ok = await patchTile(tile.id, { rotation })
    if (ok) onTileUpdated({ ...tile, rotation })
  }

  async function handleStoryChange(storyId: string | null) {
    if (!tile) return
    const story = storyId ? (stories.find(s => s.id === storyId) ?? null) : null
    const ok = await patchTile(tile.id, { story_id: storyId })
    if (ok) onTileUpdated({ ...tile, story_id: storyId, story })
  }

  async function handleDelete() {
    if (!tile) return
    if (!confirm('Delete this tile? This cannot be undone.')) return
    onDelete()
  }

  if (!tile) {
    return (
      <aside style={{ width: 280, minWidth: 280 }} className="bg-gray-900 border-l border-gray-800 p-4 flex flex-col gap-4 overflow-y-auto">
        <p className="text-gray-500 text-xs">Click empty ground to place a tile.</p>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Model to place</p>
          <ModelGrid models={modelFiles} selected={selectedModel} onSelect={onModelSelect} />
        </div>
      </aside>
    )
  }

  const typeButtons: TileType[] = ['undefined', 'terrain', 'story']

  return (
    <aside style={{ width: 280, minWidth: 280 }} className="bg-gray-900 border-l border-gray-800 p-4 flex flex-col gap-4 overflow-y-auto">

      {/* Coordinates */}
      <p className="text-xs text-gray-600 font-mono">({tile.position_q}, {tile.position_r})</p>

      {/* Type */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Type</p>
        <div className="flex flex-wrap gap-1.5">
          {typeButtons.map(t => (
            <button key={t} onClick={() => handleTypeChange(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tile.type === t ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Model */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Model</p>
        <ModelGrid models={modelFiles} selected={tile.model ?? selectedModel} onSelect={handleModelChange} />
      </div>

      {/* Rotate */}
      <button onClick={handleRotate}
        className="w-full py-2 bg-gray-800 text-gray-300 rounded-lg text-xs hover:bg-gray-700 transition-colors">
        Rotate 60° ↻
      </button>

      {/* Story picker */}
      {tile.type === 'story' && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Story</p>
          <select
            value={tile.story_id ?? ''}
            onChange={e => handleStoryChange(e.target.value || null)}
            className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-700"
          >
            <option value="">— None —</option>
            {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          {tile.story_id && (
            <Link href={`/admin/stories/${tile.story_id}`}
              className="text-xs text-violet-400 hover:text-violet-300 mt-1 block">
              Edit story →
            </Link>
          )}
        </div>
      )}

      {/* Linked tiles — story tiles with a story assigned only */}
      {tile.type === 'story' && tile.story_id && (
        <div className="border-t border-gray-800 pt-3">
          <button onClick={onLinkedTilesClick}
            className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors text-left">
            Linked tiles (unlocks when completed) →
          </button>
        </div>
      )}

      {/* Grab / Drop */}
      <button onClick={onGrabToggle}
        className={`w-full py-2 rounded-lg text-xs font-medium transition-colors border ${
          isMoving
            ? 'bg-cyan-600 text-white border-cyan-500'
            : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
        }`}>
        {isMoving ? 'Drop tile (click new position)' : 'Grab & move'}
      </button>

      {/* Delete */}
      <button onClick={handleDelete}
        className="w-full py-2 text-red-400 text-xs hover:text-red-300 transition-colors">
        Delete tile
      </button>
    </aside>
  )
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | head -20 && git add components/admin/map/TileSidePanel.tsx && git commit -m "feat: TileSidePanel 3D — model picker, rotation, grab/move, delete, story linking"
```

---

## Task 11: Updated admin/map page

**Files:**
- Modify: `app/(admin)/admin/map/page.tsx`

The page adds `isMoving`, `modelFiles`, `selectedModel` to state. The `handleTileClick` in linking mode now restricts to story-type tiles only (per spec: only story tiles can be linked). The `onEmptyClick` either places a new tile or moves the grabbed tile.

- [ ] **Step 1: Rewrite `app/(admin)/admin/map/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { AdminTile } from '@/components/admin/map/AdminHexTile'
import TileSidePanel from '@/components/admin/map/TileSidePanel'
import LinkedTilesModeHeader from '@/components/admin/map/LinkedTilesModeHeader'

// react-three-fiber accesses the DOM on import — SSR off
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
  const [isMoving, setIsMoving]     = useState(false)
  const [modelFiles, setModelFiles] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('grass.glb')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/map-tiles').then(r => r.json()),
      fetch('/api/admin/stories').then(r => r.json()),
      fetch('/api/admin/unlocks').then(r => r.json()),
      fetch('/api/admin/models').then(r => r.json()),
    ]).then(([tileData, storyData, unlockData, modelData]) => {
      setTiles(tileData)
      setStories(storyData.map((s: { id: string; title: string }) => ({ id: s.id, title: s.title })))
      setAllUnlocks(unlockData)
      if (Array.isArray(modelData) && modelData.length > 0) {
        setModelFiles(modelData)
        setSelectedModel(modelData[0])
      }
      setLoading(false)
    })
  }, [])

  async function handleTileClick(id: string, shiftKey: boolean, ctrlKey: boolean) {
    const tile = tiles.find(t => t.id === id)
    if (!tile) return

    if (linkedMode) {
      // Linking: only non-undefined tiles, only when not blocked by another story
      if (!selectedTile || tile.type === 'undefined') return
      const linkedFrom = allUnlocks.find(u => u.to_tile_id === tile.id)?.from_tile_id
      if (linkedFrom && linkedFrom !== selectedTile.id) return // blocked
      const next = linkedIds.includes(tile.id)
        ? linkedIds.filter(id2 => id2 !== tile.id)
        : [...linkedIds, tile.id]
      setLinkedIds(next)
      setAllUnlocks(prev => {
        const filtered = prev.filter(u => !(u.from_tile_id === selectedTile.id && u.to_tile_id === tile.id))
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

    setSelectedTile(tile)
    setIsMoving(false)
  }

  async function handleEmptyClick(q: number, r: number) {
    if (linkedMode) return

    if (isMoving && selectedTile) {
      // Move tile to new position
      const res = await fetch(`/api/admin/map-tiles/${selectedTile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_q: q, position_r: r }),
      })
      if (!res.ok) return
      const updated = { ...selectedTile, position_q: q, position_r: r }
      setTiles(prev => prev.map(t => t.id === selectedTile.id ? updated : t))
      setSelectedTile(updated)
      setIsMoving(false)
      return
    }

    // Create new tile
    const res = await fetch('/api/admin/map-tiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, r, model: selectedModel }),
    })
    if (!res.ok) return
    const newTile: AdminTile = await res.json()
    setTiles(prev => [...prev, newTile])
    setSelectedTile(newTile)
  }

  function handleTileUpdated(updated: AdminTile) {
    setTiles(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelectedTile(updated)
  }

  async function handleDelete() {
    if (!selectedTile) return
    const res = await fetch(`/api/admin/map-tiles/${selectedTile.id}`, { method: 'DELETE' })
    if (!res.ok) return
    setTiles(prev => prev.filter(t => t.id !== selectedTile.id))
    setSelectedTile(null)
    setIsMoving(false)
  }

  function enterLinkedMode() {
    if (!selectedTile || selectedTile.type !== 'story') return
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

  async function resetMap() {
    const input = window.prompt('Type RESET to delete all tiles and start over:')
    if (input !== 'RESET') return
    const res = await fetch('/api/admin/map-tiles', { method: 'DELETE' })
    if (!res.ok) { alert('Reset failed'); return }
    setTiles([])
    setSelectedTile(null)
    setAllUnlocks([])
    setLinkedMode(false)
    setIsMoving(false)
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
        <AdminHexGrid
          tiles={tiles}
          selectedTileId={selectedTile?.id ?? null}
          isMoving={isMoving}
          isLinkingMode={linkedMode}
          linkedTileIds={new Set(linkedIds)}
          allUnlocks={allUnlocks}
          onTileClick={handleTileClick}
          onEmptyClick={handleEmptyClick}
          onDeselect={() => { if (!isMoving && !linkedMode) { setSelectedTile(null) } }}
        />
      </div>

      {/* Side panel */}
      <TileSidePanel
        tile={selectedTile}
        stories={stories}
        modelFiles={modelFiles}
        selectedModel={selectedModel}
        onModelSelect={setSelectedModel}
        isMoving={isMoving}
        onTileUpdated={handleTileUpdated}
        onLinkedTilesClick={enterLinkedMode}
        onGrabToggle={() => setIsMoving(m => !m)}
        onDelete={handleDelete}
      />
    </div>
  )
}
```

Note: The `DELETE /api/admin/map-tiles/[id]` endpoint needs to exist. Check if it exists. If not, add it to `app/api/admin/map-tiles/[id]/route.ts`:

```typescript
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const db = adminClient()
  const { error } = await db.from('tiles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit and push**

```bash
cd /root/fo-dream-stories && git add app/\(admin\)/admin/map/page.tsx app/api/admin/map-tiles/\[id\]/route.ts && git commit -m "feat: admin map page — 3D state management, move tiles, grab/drop, delete" && git push
```

- [ ] **Step 4: Verify on live app**

After Vercel deploys:
- `/admin/map` loads with 3D canvas
- Existing tiles appear as GLB models
- Click empty ground → tile placed with selected model
- Side panel shows type/model/rotation/story controls
- Rotate button rotates tile 60° increments
- Grab/move: tile elevates, click new position to move
- Delete tile: removes from map and DB
- Story tile + story assigned → "Linked tiles" button appears → cyan highlights + blocked gray

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| 1. Moderation thumbnail lightbox | Task 4 |
| 2. Alex's tip → Alex's Dream rename + image shown + only after submit | Tasks 2, 3 |
| 3. Audio player in stories tab | Task 5 |
| 4. FO mascot as button | Task 5 |
| 5. Alex's Dream image upload | Task 3 |
| 6a. Mother tree is just a story tile | Tasks 1, 2 |
| 6b. 3D map with Kenney tiles + model picker | Tasks 6, 8, 9, 10, 11 |
| 6c. Linking only for story tiles | Tasks 10, 11 |
| 6d. Rotate + pan + zoom for admin AND consumer | Tasks 2, 9 |
| 6e. Terrain tiles named from GLB filename | Task 10 |
| 6f. Already-linked tiles transparent in link mode | Task 9 |

**Type consistency:** AdminTile interface defined in Task 8 is referenced in Tasks 9, 10, 11 with the same field names. ✓

**Placeholder scan:** No TBD/placeholder steps. All code blocks are complete. ✓

**Note on single-tile DELETE:** `app/api/admin/map-tiles/[id]/route.ts` currently only has PATCH. Task 11 adds the DELETE handler to that file. This is additive and non-breaking. ✓
