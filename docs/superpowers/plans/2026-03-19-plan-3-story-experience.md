# FO's Dream Stories — Plan 3: Story Experience

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete story experience loop — tile tap popup, listening/reading modes, dream mode black screen, dream submission (text/voice/drawing), AI image generation, tile completion, and map expansion with pan/zoom.

**Architecture:** Tile taps open a positioned popup on the map; story modes live in a dedicated `/story/[tileId]` page (full-screen); dream submission is a bottom drawer on the map page. Three Next.js API routes wrap OpenAI (Whisper, GPT-4o Vision, DALL-E 3) server-side. The `locked` state is retired — tiles not yet unlocked are invisible (not rendered). A new `revealed` state shows fogged tiles that require a tap to unlock.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + RLS + Storage), react-zoom-pan-pinch, OpenAI API (Whisper + GPT-4o Vision + DALL-E 3), browser speechSynthesis API, MediaRecorder API, HTML5 Canvas, Jest + React Testing Library

---

## Scene Setting

The app lives at `/root/fo-dream-stories/`. All page routes are under `app/`. Components under `components/`. Utilities under `lib/`. Tests under `__tests__/`. 30 tests currently pass.

Current `TileState` type includes `'locked'` — this plan removes it and adds `'revealed'`. The map page currently console.logs on tile click — this plan wires up the full experience.

**Important:** After each DB migration task, the human must run the SQL in Supabase SQL Editor (project: https://tdoqdiyalenignhitxgj.supabase.co). The implementer writes the files; the human runs the SQL.

---

## File Structure

```
fo-dream-stories/
├── app/
│   ├── (app)/
│   │   ├── map/page.tsx                     MODIFY — popup, invisible tiles, token images, drawer, unlock propagation
│   │   └── story/
│   │       └── [tileId]/page.tsx             NEW — Phase 1+2 entry + routes to modes
│   └── api/
│       ├── transcribe/route.ts              NEW — POST: audio → Whisper → text
│       ├── describe-drawing/route.ts        NEW — POST: image base64 → GPT-4o Vision → description
│       └── generate-image/route.ts         NEW — POST: text → DALL-E 3 → Supabase Storage URL
├── components/
│   ├── map/
│   │   ├── HexTile.tsx                      MODIFY — revealed state, isSelected prop, token image, listened pulse
│   │   ├── HexGrid.tsx                      MODIFY — react-zoom-pan-pinch wrapper, dynamic container
│   │   └── TilePopup.tsx                    NEW — speech bubble popup (unlocked/listened/completed states)
│   ├── story/
│   │   ├── ListeningMode.tsx                NEW — pre-buffer audio/TTS, black screen, audio-end gate
│   │   ├── ReadingMode.tsx                  NEW — story text + Start dreaming button
│   │   └── DreamMode.tsx                    NEW — black screen, pulsing light, minimum timer gate
│   └── dream/
│       ├── DreamSubmissionDrawer.tsx        NEW — bottom drawer shell with 3 tabs
│       ├── WriteItTab.tsx                   NEW — text input
│       ├── SayItTab.tsx                     NEW — MediaRecorder + Whisper
│       ├── DrawItTab.tsx                    NEW — canvas + photo upload + GPT-4o Vision
│       └── ImageAcceptance.tsx              NEW — DALL-E result, accept/try again/skip
├── lib/
│   ├── types.ts                             MODIFY — add revealed, DreamSubmission, token fields on MappedTile
│   └── storage.ts                           NEW — Supabase Storage upload helpers
└── supabase/
    └── migrations/
        ├── 003_revealed_state.sql           NEW
        └── 004_dream_submissions.sql        NEW
```

---

## Task 1: DB Migration Files

**Files:**
- Create: `supabase/migrations/003_revealed_state.sql`
- Create: `supabase/migrations/004_dream_submissions.sql`

No tests for this task. The human runs both files in Supabase SQL Editor after the commit.

- [ ] **Step 1: Create `supabase/migrations/003_revealed_state.sql`**

```sql
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
```

- [ ] **Step 2: Create `supabase/migrations/004_dream_submissions.sql`**

```sql
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
```

- [ ] **Step 3: Commit**

```bash
cd /root/fo-dream-stories
git add supabase/migrations/003_revealed_state.sql supabase/migrations/004_dream_submissions.sql
git commit -m "feat: DB migrations — revealed state + dream_submissions table"
```

- [ ] **Step 4: Human runs SQL in Supabase**

Go to https://tdoqdiyalenignhitxgj.supabase.co → SQL Editor.
Run `003_revealed_state.sql` first. Expected: no errors.
Run `004_dream_submissions.sql` second. Expected: no errors, `dream_submissions` table visible in Table Editor.
Then in Supabase → Storage: create bucket `dream-inputs` (private) and `dream-images` (public).

---

## Task 2: Types + Storage Helper

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/storage.ts`
- Create: `__tests__/lib/storage.test.ts`

- [ ] **Step 1: Update `lib/types.ts`**

Replace the map types section (everything after `getAge`):

```typescript
// ── Map types ──────────────────────────────────────────────────────────────

export type TileType = 'mother_tree' | 'story' | 'terrain'
export type TerrainType = 'forest' | 'land' | 'water' | 'mountain'
// Note: 'locked' has been retired. Tiles with no child_tile_states row are invisible.
export type TileState = 'revealed' | 'unlocked' | 'listened' | 'completed'

export interface Tile {
  id: string
  type: TileType
  name: string
  position_q: number
  position_r: number
  terrain_type: TerrainType | null
  story_text: string | null
  audio_url: string | null
  alex_tip: string | null
  alex_dream_image_url: string | null
  sensory_moment_text: string | null
  default_token_image_url: string | null
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

// Tile enriched with the child's current state + latest dream token
export interface MappedTile extends Tile {
  childState: TileState
  token_image_url: string | null  // from latest dream_submissions row for this child+tile
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
```

- [ ] **Step 2: Run tests — expect some failures due to type changes**

```bash
cd /root/fo-dream-stories && npm test 2>&1 | tail -20
```

Expected: some tests may fail because `MappedTile` now requires `token_image_url`. Fix any test fixtures that create `MappedTile` objects by adding `token_image_url: null` to each.

- [ ] **Step 3: Fix test fixtures**

Search for `MappedTile` usage in tests:

```bash
cd /root/fo-dream-stories && grep -r "MappedTile\|childState" __tests__/ --include="*.tsx" --include="*.ts" -l
```

In each test file that constructs a `MappedTile`, add `token_image_url: null` to the object.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: 30 tests passing.

- [ ] **Step 5: Create `lib/storage.ts`**

```typescript
import { createClient } from '@/lib/supabase/client'

/**
 * Upload a Blob to Supabase Storage and return the public URL.
 * Bucket must already exist and be configured in Supabase.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: Blob,
  contentType: string
): Promise<string> {
  const supabase = createClient()
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/** Generate a UUID-like path segment for unique filenames */
export function storagePath(
  childProfileId: string,
  tileId: string,
  ext: string
): string {
  const uid = crypto.randomUUID()
  return `${childProfileId}/${tileId}/${uid}.${ext}`
}
```

- [ ] **Step 6: Write failing test for storage helper**

Create `__tests__/lib/storage.test.ts`:

```typescript
import { storagePath } from '@/lib/storage'

describe('storagePath', () => {
  it('returns a path with the correct prefix', () => {
    const path = storagePath('child-1', 'tile-1', 'png')
    expect(path.startsWith('child-1/tile-1/')).toBe(true)
  })

  it('ends with the correct extension', () => {
    const path = storagePath('child-1', 'tile-1', 'webm')
    expect(path.endsWith('.webm')).toBe(true)
  })

  it('generates unique paths on each call', () => {
    const a = storagePath('c', 't', 'png')
    const b = storagePath('c', 't', 'png')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: 33 tests passing (30 + 3 new storage tests).

- [ ] **Step 8: Commit**

```bash
cd /root/fo-dream-stories
git add lib/types.ts lib/storage.ts __tests__/lib/storage.test.ts
git commit -m "feat: add revealed TileState, DreamSubmission type, storage helper"
```

---

## Task 3: OpenAI API Routes

**Files:**
- Create: `app/api/transcribe/route.ts`
- Create: `app/api/describe-drawing/route.ts`
- Create: `app/api/generate-image/route.ts`
- Create: `__tests__/api/transcribe.test.ts`
- Create: `__tests__/api/describe-drawing.test.ts`
- Create: `__tests__/api/generate-image.test.ts`

First install the OpenAI SDK:

- [ ] **Step 1: Install openai package**

```bash
cd /root/fo-dream-stories && npm install openai
```

Expected: openai added to package.json dependencies.

- [ ] **Step 2: Write failing tests**

Create `__tests__/api/transcribe.test.ts`:

```typescript
// Mock OpenAI before importing the route
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({ text: 'I dreamed of flying' }),
      },
    },
  })),
}))

import { POST } from '@/app/api/transcribe/route'

describe('POST /api/transcribe', () => {
  it('returns transcribed text', async () => {
    const formData = new FormData()
    formData.append('audio', new Blob(['audio data'], { type: 'audio/webm' }), 'audio.webm')
    const request = new Request('http://localhost/api/transcribe', {
      method: 'POST',
      body: formData,
    })
    const response = await POST(request)
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.text).toBe('I dreamed of flying')
  })
})
```

Create `__tests__/api/describe-drawing.test.ts`:

```typescript
jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'A child flying over rainbow mountains' } }],
        }),
      },
    },
  })),
}))

import { POST } from '@/app/api/describe-drawing/route'

describe('POST /api/describe-drawing', () => {
  it('returns description from vision model', async () => {
    const request = new Request('http://localhost/api/describe-drawing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: 'abc123', mimeType: 'image/png' }),
    })
    const response = await POST(request)
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.description).toBe('A child flying over rainbow mountains')
  })
})
```

Create `__tests__/api/generate-image.test.ts`:

```typescript
// Mock fetch for downloading the OpenAI image
global.fetch = jest.fn()

jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    images: {
      generate: jest.fn().mockResolvedValue({
        data: [{ url: 'https://openai.com/image.png' }],
      }),
    },
  })),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/dream.png' } }),
      }),
    },
  }),
}))

import { POST } from '@/app/api/generate-image/route'

describe('POST /api/generate-image', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    })
  })

  it('returns a storage URL', async () => {
    const request = new Request('http://localhost/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'flying', childProfileId: 'c1', tileId: 't1' }),
    })
    const response = await POST(request)
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.imageUrl).toBe('https://storage.example.com/dream.png')
  })
})
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="api/"
```

Expected: FAIL — "Cannot find module '@/app/api/transcribe/route'"

- [ ] **Step 4: Create `app/api/transcribe/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio') as File | null
    if (!audio) return NextResponse.json({ error: 'No audio file' }, { status: 400 })

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audio,
    })
    return NextResponse.json({ text: transcription.text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Create `app/api/describe-drawing/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType } = await request.json()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: 'Describe what this child has drawn in 2-3 sentences, as if narrating their dream. Keep it warm, imaginative, and child-friendly.',
            },
          ],
        },
      ],
      max_tokens: 200,
    })
    const description = response.choices[0]?.message?.content ?? ''
    return NextResponse.json({ description })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vision analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 6: Create `app/api/generate-image/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const STYLE_SUFFIX = "Children's illustrated storybook style, dreamlike, warm colours, soft lighting, magical forest world, safe and wonder-filled"

export async function POST(request: NextRequest) {
  try {
    const { prompt, childProfileId, tileId } = await request.json()
    const fullPrompt = `${prompt}. ${STYLE_SUFFIX}`

    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt: fullPrompt,
      size: '1024x1024',
      response_format: 'url',
    })

    const openAiUrl = result.data[0]?.url
    if (!openAiUrl) throw new Error('No image URL returned from DALL-E')

    // Fetch and store in Supabase (OpenAI URLs expire after ~1 hour)
    const imageResponse = await fetch(openAiUrl)
    const buffer = await imageResponse.arrayBuffer()
    const blob = new Blob([buffer], { type: 'image/png' })

    const uid = crypto.randomUUID()
    const path = `${childProfileId}/${tileId}/${uid}.png`
    const supabase = await createClient()
    const { error: uploadError } = await supabase.storage
      .from('dream-images')
      .upload(path, blob, { contentType: 'image/png', upsert: false })
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    const { data } = supabase.storage.from('dream-images').getPublicUrl(path)
    return NextResponse.json({ imageUrl: data.publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 7: Run API tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="api/"
```

Expected: 3 tests passing.

- [ ] **Step 8: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: 36 tests passing.

- [ ] **Step 9: Commit**

```bash
cd /root/fo-dream-stories
git add app/api/ __tests__/api/ package.json package-lock.json
git commit -m "feat: OpenAI API routes — transcribe, describe-drawing, generate-image"
```

---

## Task 4: HexTile + HexGrid Updates

**Files:**
- Modify: `components/map/HexTile.tsx`
- Modify: `components/map/HexGrid.tsx`
- Modify: `__tests__/components/map/HexTile.test.tsx`
- Modify: `__tests__/components/map/HexGrid.test.tsx`

- [ ] **Step 1: Install react-zoom-pan-pinch**

```bash
cd /root/fo-dream-stories && npm install react-zoom-pan-pinch
```

- [ ] **Step 2: Update `__tests__/components/map/HexTile.test.tsx`**

Read the existing test file first. Update the `baseTile` fixture to add `token_image_url: null` and `alex_dream_image_url: null`. Add two new tests:

```typescript
it('renders "?" for revealed tiles', () => {
  render(<HexTile tile={{ ...baseTile, childState: 'revealed' }} x={0} y={0} />)
  expect(screen.getByText('?')).toBeInTheDocument()
})

it('applies selected scale when isSelected is true', () => {
  const { container } = render(<HexTile tile={baseTile} x={0} y={0} isSelected={true} />)
  const el = container.querySelector('[data-type]') as HTMLElement
  expect(el.style.transform).toContain('scale')
})
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="HexTile"
```

Expected: FAIL — existing tests fail due to missing `token_image_url` on fixture, new tests fail due to missing `revealed` handling.

- [ ] **Step 4: Rewrite `components/map/HexTile.tsx`**

```typescript
import Image from 'next/image'
import { MappedTile } from '@/lib/types'
import { HEX_WIDTH, HEX_HEIGHT } from '@/lib/hex'

interface HexTileProps {
  tile: MappedTile
  x: number
  y: number
  isSelected?: boolean
  isFlipped?: boolean
  onClick?: (tile: MappedTile) => void
}

const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

function tileBackground(tile: MappedTile): string {
  if (tile.childState === 'revealed') return '#374151'
  if (tile.type === 'mother_tree') return '#7c3aed'
  if (tile.type === 'terrain') {
    switch (tile.terrain_type) {
      case 'forest':   return '#166534'
      case 'land':     return '#78716c'
      case 'water':    return '#1e40af'
      case 'mountain': return '#6b7280'
      default:         return '#4b5563'
    }
  }
  return '#1e40af' // story tile: unlocked/listened/completed
}

function tileFilter(tile: MappedTile): string {
  if (tile.childState === 'completed') return 'drop-shadow(0 0 6px #d97706)'
  if (tile.childState === 'listened') return 'drop-shadow(0 0 8px #f59e0b)'
  if (tile.type === 'mother_tree') return 'drop-shadow(0 0 6px #a78bfa)'
  return 'none'
}

function tileLabel(tile: MappedTile): string | null {
  if (tile.childState === 'revealed') return '?'
  if (tile.type === 'terrain') return null
  return tile.name
}

function isClickable(tile: MappedTile): boolean {
  return true // all visible tiles are clickable (revealed → unlock, unlocked → story, etc.)
}

export default function HexTile({ tile, x, y, isSelected = false, isFlipped = false, onClick }: HexTileProps) {
  const label = tileLabel(tile)
  const baseTransform = isSelected ? 'scale(1.15) translateY(-8px)' : 'scale(1)'
  const flipTransform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'

  return (
    <div
      style={{
        position: 'absolute',
        left: x - HEX_WIDTH / 2,
        top: y - HEX_HEIGHT / 2,
        width: HEX_WIDTH,
        height: HEX_HEIGHT,
        perspective: 600,
        transform: baseTransform,
        transition: 'transform 0.2s',
        zIndex: isSelected ? 10 : 1,
      }}
      onClick={() => onClick?.(tile)}
    >
      {/* Inner flip container */}
      <div
        data-type={tile.type}
        data-state={tile.childState}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.4s',
          transform: flipTransform,
        }}
      >
        {/* Front face */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: HEX_CLIP,
            backgroundColor: tileBackground(tile),
            filter: tileFilter(tile),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backfaceVisibility: 'hidden',
            opacity: tile.childState === 'revealed' ? 0.7 : 1,
          }}
        >
          {label && (
            <span style={{
              color: 'white',
              fontSize: tile.childState === 'revealed' ? 16 : 9,
              fontWeight: 600,
              textAlign: 'center',
              padding: '0 6px',
              lineHeight: 1.2,
              pointerEvents: 'none',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}>
              {label}
            </span>
          )}
          {tile.childState === 'completed' && tile.token_image_url && (
            <Image
              src={tile.token_image_url}
              alt="Dream token"
              fill
              className="object-cover opacity-60"
              style={{ clipPath: HEX_CLIP }}
            />
          )}
        </div>

        {/* Back face — Alex's dream image (only rendered when tile has alex_dream_image_url) */}
        {tile.alex_dream_image_url && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath: HEX_CLIP,
              backgroundColor: '#1e1b4b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              overflow: 'hidden',
            }}
          >
            <Image
              src={tile.alex_dream_image_url}
              alt="Alex's dream"
              fill
              className="object-cover opacity-80"
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run HexTile tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="HexTile"
```

Expected: 7 tests passing.

- [ ] **Step 6: Update `components/map/HexGrid.tsx`**

```typescript
'use client'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { MappedTile } from '@/lib/types'
import { axialToPixel, HEX_WIDTH, HEX_HEIGHT } from '@/lib/hex'
import HexTile from './HexTile'

interface HexGridProps {
  tiles: MappedTile[]
  selectedTileId?: string | null
  flippedTileId?: string | null
  onTileClick?: (tile: MappedTile) => void
}

const PADDING = 100

export default function HexGrid({ tiles, selectedTileId, flippedTileId, onTileClick }: HexGridProps) {
  if (tiles.length === 0) return null

  // Compute bounding box from all tile pixel positions
  const positions = tiles.map(t => axialToPixel(t.position_q, t.position_r))
  const minX = Math.min(...positions.map(p => p.x)) - HEX_WIDTH / 2 - PADDING
  const maxX = Math.max(...positions.map(p => p.x)) + HEX_WIDTH / 2 + PADDING
  const minY = Math.min(...positions.map(p => p.y)) - HEX_HEIGHT / 2 - PADDING
  const maxY = Math.max(...positions.map(p => p.y)) + HEX_HEIGHT / 2 + PADDING
  const width = maxX - minX
  const height = maxY - minY
  const offsetX = -minX
  const offsetY = -minY

  return (
    <TransformWrapper minScale={0.5} maxScale={2} centerOnInit limitToBounds={false}>
      <TransformComponent wrapperStyle={{ width: '100%', maxWidth: '100vw' }}>
        <div style={{ position: 'relative', width, height }}>
          {tiles.map(tile => {
            const { x, y } = axialToPixel(tile.position_q, tile.position_r)
            return (
              <HexTile
                key={tile.id}
                tile={tile}
                x={offsetX + x}
                y={offsetY + y}
                isSelected={selectedTileId === tile.id}
                isFlipped={flippedTileId === tile.id}
                onClick={onTileClick}
              />
            )
          })}
        </div>
      </TransformComponent>
    </TransformWrapper>
  )
}
```

- [ ] **Step 7: Update `__tests__/components/map/HexGrid.test.tsx`**

Read the existing test. Update `makeTile` helper to include `token_image_url: null` and `alex_dream_image_url: null`. Add `selectedTileId` prop to tests if needed. Run tests to confirm they still pass.

- [ ] **Step 8: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: all tests passing.

- [ ] **Step 9: Commit**

```bash
cd /root/fo-dream-stories
git add components/map/HexTile.tsx components/map/HexGrid.tsx __tests__/components/map/ package.json package-lock.json
git commit -m "feat: HexTile revealed state + selected animation; HexGrid pan/zoom via react-zoom-pan-pinch"
```

---

## Task 5: TilePopup Component

**Files:**
- Create: `components/map/TilePopup.tsx`
- Create: `__tests__/components/map/TilePopup.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/map/TilePopup.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import TilePopup from '@/components/map/TilePopup'
import { MappedTile } from '@/lib/types'

const storyTile: MappedTile = {
  id: 'tile-1', type: 'story', name: 'The Tinkle Trunk',
  position_q: 1, position_r: 0, terrain_type: null,
  story_text: 'Once upon a time...', audio_url: null,
  alex_tip: 'Alex found a golden trumpet.', alex_dream_image_url: null,
  sensory_moment_text: null, default_token_image_url: null,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'unlocked', token_image_url: null,
}

const noop = () => {}

describe('TilePopup', () => {
  it('shows mode buttons for unlocked story tile', () => {
    render(<TilePopup tile={storyTile} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/Listening mode/i)).toBeInTheDocument()
    expect(screen.getByText(/Reading mode/i)).toBeInTheDocument()
  })

  it('shows Tell us your dream for listened tile', () => {
    render(<TilePopup tile={{ ...storyTile, childState: 'listened' }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/Tell us your dream/i)).toBeInTheDocument()
  })

  it('shows Read it again for completed tile', () => {
    render(<TilePopup tile={{ ...storyTile, childState: 'completed' }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText(/Read it again/i)).toBeInTheDocument()
  })

  it('shows Alex Dream text in completed popup when alex_tip is set', () => {
    render(<TilePopup tile={{ ...storyTile, childState: 'completed' }} onClose={noop} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    expect(screen.getByText("Alex found a golden trumpet.")).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    render(<TilePopup tile={storyTile} onClose={onClose} onListeningMode={noop} onReadingMode={noop} onSubmitDream={noop} onReadAgain={noop} />)
    fireEvent.click(screen.getByTestId('popup-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="TilePopup"
```

Expected: FAIL — "Cannot find module '@/components/map/TilePopup'"

- [ ] **Step 3: Create `components/map/TilePopup.tsx`**

```typescript
'use client'
import { MappedTile } from '@/lib/types'

interface TilePopupProps {
  tile: MappedTile
  onClose: () => void
  onListeningMode: () => void
  onReadingMode: () => void
  onSubmitDream: () => void
  onReadAgain: () => void
}

export default function TilePopup({
  tile, onClose, onListeningMode, onReadingMode, onSubmitDream, onReadAgain
}: TilePopupProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="popup-backdrop"
        onClick={onClose}
        className="fixed inset-0 z-30"
      />
      {/* Popup */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-72 bg-white rounded-2xl shadow-2xl p-5">
        <h2 className="text-slate-800 font-bold text-lg mb-1">{tile.name}</h2>

        {tile.type === 'mother_tree' && (
          <p className="text-violet-600 text-sm leading-snug">
            The heart of the dream world. Stories branch out from here — tap a neighbouring tile to begin.
          </p>
        )}

        {tile.type !== 'mother_tree' && tile.childState === 'unlocked' && (
          <>
            <p className="text-slate-500 text-sm mb-4">A story awaits...</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onListeningMode}
                className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors"
              >
                🎧 Listening mode
              </button>
              <button
                onClick={onReadingMode}
                className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                📖 Reading mode
              </button>
            </div>
            {tile.alex_dream_image_url && (
              <p className="text-slate-400 text-xs mt-3 text-center">
                Tap the tile to peek at Alex&apos;s dream
              </p>
            )}
          </>
        )}

        {tile.type !== 'mother_tree' && tile.childState === 'listened' && (
          <>
            <p className="text-amber-600 text-sm mb-4 animate-pulse">How did your adventure end?</p>
            <button
              onClick={onSubmitDream}
              className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
            >
              Tell us your dream
            </button>
          </>
        )}

        {tile.type !== 'mother_tree' && tile.childState === 'completed' && (
          <>
            {tile.token_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tile.token_image_url}
                alt="Your dream"
                className="w-full rounded-xl mb-3 object-cover aspect-square"
              />
            )}
            {tile.alex_tip && (
              <div className="bg-amber-50 rounded-xl p-3 mb-3">
                <p className="text-amber-800 text-xs font-semibold mb-1">Alex&apos;s Dream</p>
                <p className="text-amber-900 text-sm leading-snug">{tile.alex_tip}</p>
              </div>
            )}
            <button
              onClick={onReadAgain}
              className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition-colors"
            >
              Read it again
            </button>
          </>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run TilePopup tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="TilePopup"
```

Expected: 5 tests passing.

- [ ] **Step 5: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: all tests passing.

- [ ] **Step 6: Commit**

```bash
cd /root/fo-dream-stories
git add components/map/TilePopup.tsx __tests__/components/map/TilePopup.test.tsx
git commit -m "feat: TilePopup component for unlocked/listened/completed tile states"
```

---

## Task 6: Story Page + Listening Mode + Dream Mode

**Files:**
- Create: `app/(app)/story/[tileId]/page.tsx`
- Create: `components/story/DreamMode.tsx`
- Create: `components/story/ListeningMode.tsx`
- Create: `__tests__/components/story/DreamMode.test.tsx`
- Create: `__tests__/components/story/ListeningMode.test.tsx`

- [ ] **Step 1: Write failing tests for DreamMode**

Create `__tests__/components/story/DreamMode.test.tsx`:

```typescript
import { render, screen, fireEvent, act } from '@testing-library/react'
import DreamMode from '@/components/story/DreamMode'

describe('DreamMode', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('renders the black screen with pulsing light', () => {
    render(<DreamMode onComplete={jest.fn()} minimumSeconds={120} />)
    expect(screen.getByTestId('dream-mode')).toBeInTheDocument()
  })

  it('does not show sweet dreams message before minimum time', () => {
    render(<DreamMode onComplete={jest.fn()} minimumSeconds={120} />)
    fireEvent.click(screen.getByTestId('dream-mode'))
    expect(screen.queryByText(/Sweet dreams/i)).not.toBeInTheDocument()
  })

  it('shows sweet dreams message on first tap after minimum time', async () => {
    render(<DreamMode onComplete={jest.fn()} minimumSeconds={5} />)
    act(() => { jest.advanceTimersByTime(6000) })
    fireEvent.click(screen.getByTestId('dream-mode'))
    expect(screen.getByText(/Sweet dreams/i)).toBeInTheDocument()
  })

  it('calls onComplete on second tap after sweet dreams shown', async () => {
    const onComplete = jest.fn()
    render(<DreamMode onComplete={onComplete} minimumSeconds={5} />)
    act(() => { jest.advanceTimersByTime(6000) })
    fireEvent.click(screen.getByTestId('dream-mode'))
    fireEvent.click(screen.getByTestId('dream-mode'))
    expect(onComplete).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="DreamMode"
```

- [ ] **Step 3: Create `components/story/DreamMode.tsx`**

```typescript
'use client'
import { useEffect, useRef, useState } from 'react'

interface DreamModeProps {
  onComplete: () => void
  minimumSeconds?: number
}

export default function DreamMode({ onComplete, minimumSeconds = 120 }: DreamModeProps) {
  const [timerDone, setTimerDone] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    timerRef.current = setTimeout(() => setTimerDone(true), minimumSeconds * 1000)
    return () => clearTimeout(timerRef.current)
  }, [minimumSeconds])

  function handleTap() {
    if (!timerDone) return
    if (!showMessage) { setShowMessage(true); return }
    onComplete()
  }

  return (
    <div
      data-testid="dream-mode"
      onClick={handleTap}
      style={{
        position: 'fixed', inset: 0, backgroundColor: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, cursor: timerDone ? 'pointer' : 'default',
      }}
    >
      {!showMessage && (
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.15)',
          animation: 'pulse 2s ease-in-out infinite',
        }} />
      )}
      {showMessage && (
        <p style={{
          color: 'rgba(255,255,255,0.85)', fontSize: 18, textAlign: 'center',
          padding: '0 32px', lineHeight: 1.6, fontStyle: 'italic',
        }}>
          Sweet dreams.<br />Come back and tell us what you found.
        </p>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.8;transform:scale(1.3)} }`}</style>
    </div>
  )
}
```

- [ ] **Step 4: Run DreamMode tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="DreamMode"
```

Expected: 4 tests passing.

- [ ] **Step 5: Write failing tests for ListeningMode**

Create `__tests__/components/story/ListeningMode.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ListeningMode from '@/components/story/ListeningMode'
import { MappedTile } from '@/lib/types'

const tile: MappedTile = {
  id: 't1', type: 'story', name: 'The Tinkle Trunk',
  position_q: 1, position_r: 0, terrain_type: null,
  story_text: 'Once upon a time there was a trunk.', audio_url: null,
  alex_tip: null, alex_dream_image_url: null,
  sensory_moment_text: null, default_token_image_url: null,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'unlocked', token_image_url: null,
}

// Mock speechSynthesis
const mockSpeak = jest.fn()
const mockCancel = jest.fn()
Object.defineProperty(window, 'speechSynthesis', {
  value: { speak: mockSpeak, cancel: mockCancel, speaking: false },
  writable: true,
})
Object.defineProperty(window, 'SpeechSynthesisUtterance', {
  value: class { onend: (() => void) | null = null; text = '' },
  writable: true,
})

describe('ListeningMode', () => {
  beforeEach(() => { mockSpeak.mockClear(); mockCancel.mockClear() })

  it('shows loading state initially', () => {
    render(<ListeningMode tile={tile} onComplete={jest.fn()} onFallback={jest.fn()} />)
    expect(screen.getByText(/Preparing/i)).toBeInTheDocument()
  })

  it('calls speechSynthesis.speak when tile has no audio_url', async () => {
    render(<ListeningMode tile={tile} onComplete={jest.fn()} onFallback={jest.fn()} />)
    await waitFor(() => expect(mockSpeak).toHaveBeenCalled())
  })
})
```

- [ ] **Step 6: Run tests — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="ListeningMode"
```

- [ ] **Step 7: Create `components/story/ListeningMode.tsx`**

```typescript
'use client'
import { useEffect, useState, useRef } from 'react'
import { MappedTile } from '@/lib/types'
import DreamMode from './DreamMode'

interface ListeningModeProps {
  tile: MappedTile
  onComplete: () => void
  onFallback: () => void  // user chooses to switch to reading mode
}

export default function ListeningMode({ tile, onComplete, onFallback }: ListeningModeProps) {
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading')
  const [dreamModeActive, setDreamModeActive] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (tile.audio_url) {
      // Use real audio file
      const audio = new Audio(tile.audio_url)
      audioRef.current = audio
      audio.addEventListener('canplaythrough', () => setStatus('playing'), { once: true })
      audio.addEventListener('error', () => setStatus('error'), { once: true })
      audio.addEventListener('ended', () => setDreamModeActive(true), { once: true })
      audio.load()
    } else if (tile.story_text && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Use browser TTS
      const utterance = new SpeechSynthesisUtterance(tile.story_text)
      utteranceRef.current = utterance
      utterance.onend = () => setDreamModeActive(true)
      // Small delay to let the component settle before speaking
      const t = setTimeout(() => {
        setStatus('playing')
        window.speechSynthesis.speak(utterance)
      }, 300)
      return () => {
        clearTimeout(t)
        window.speechSynthesis.cancel()
      }
    } else {
      setStatus('error')
    }

    return () => {
      audioRef.current?.pause()
      window.speechSynthesis?.cancel()
    }
  }, [tile])

  useEffect(() => {
    if (status === 'playing' && audioRef.current) {
      audioRef.current.play().catch(() => setStatus('error'))
    }
  }, [status])

  if (dreamModeActive) {
    return <DreamMode onComplete={onComplete} />
  }

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <p className="text-white/60 text-sm">Preparing your story...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 gap-4 px-8">
        <p className="text-white/80 text-center text-sm">
          We&apos;re having trouble loading the story — try refreshing, or switch to Reading mode.
        </p>
        <button
          onClick={onFallback}
          className="px-6 py-3 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
        >
          Read it to me
        </button>
      </div>
    )
  }

  // status === 'playing': render dark screen — DreamMode handles tap-to-exit after audio ends
  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.15)',
        animation: 'pulse 2s ease-in-out infinite',
      }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.8;transform:scale(1.3)} }`}</style>
    </div>
  )
}
```

- [ ] **Step 8: Create `app/(app)/story/[tileId]/page.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tile } from '@/lib/types'
import ListeningMode from '@/components/story/ListeningMode'
import ReadingMode from '@/components/story/ReadingMode'

export default function StoryPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const tileId = params.tileId as string
  const mode = searchParams.get('mode') ?? 'reading'
  const [tile, setTile] = useState<Tile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('tiles').select('*').eq('id', tileId).single()
      setTile(data as Tile)
      setLoading(false)
    }
    load()
  }, [tileId])

  async function handleComplete() {
    const childId = sessionStorage.getItem('activeProfileId')
    if (childId && tileId) {
      const supabase = createClient()
      await supabase
        .from('child_tile_states')
        .update({ state: 'listened', listened_at: new Date().toISOString() })
        .eq('child_profile_id', childId)
        .eq('tile_id', tileId)
    }
    router.push('/map')
  }

  if (loading || !tile) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <p className="text-white/60 text-sm">Loading...</p>
      </div>
    )
  }

  // Enrich tile as MappedTile for mode components
  const mappedTile = { ...tile, childState: 'unlocked' as const, token_image_url: null }

  if (mode === 'listening') {
    return (
      <ListeningMode
        tile={mappedTile}
        onComplete={handleComplete}
        onFallback={() => router.replace(`/story/${tileId}?mode=reading`)}
      />
    )
  }

  return <ReadingMode tile={mappedTile} onComplete={handleComplete} />
}
```

- [ ] **Step 9: Run ListeningMode tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="ListeningMode"
```

Expected: 2 tests passing.

- [ ] **Step 10: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: all tests passing.

- [ ] **Step 11: Commit**

```bash
cd /root/fo-dream-stories
git add app/\(app\)/story/ components/story/DreamMode.tsx components/story/ListeningMode.tsx __tests__/components/story/
git commit -m "feat: story page, ListeningMode (TTS/audio + black screen), DreamMode (timer gate)"
```

---

## Task 7: Reading Mode

**Files:**
- Create: `components/story/ReadingMode.tsx`
- Create: `__tests__/components/story/ReadingMode.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/story/ReadingMode.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import ReadingMode from '@/components/story/ReadingMode'
import { MappedTile } from '@/lib/types'

const tile: MappedTile = {
  id: 't1', type: 'story', name: 'Raindrop Castle',
  position_q: 0, position_r: -1, terrain_type: null,
  story_text: 'High above the clouds lived a castle made of raindrops.',
  audio_url: null, alex_tip: null, alex_dream_image_url: null,
  sensory_moment_text: null, default_token_image_url: null,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'unlocked', token_image_url: null,
}

describe('ReadingMode', () => {
  it('renders the tile name', () => {
    render(<ReadingMode tile={tile} onComplete={jest.fn()} />)
    expect(screen.getByText('Raindrop Castle')).toBeInTheDocument()
  })

  it('renders the story text', () => {
    render(<ReadingMode tile={tile} onComplete={jest.fn()} />)
    expect(screen.getByText(/High above the clouds/)).toBeInTheDocument()
  })

  it('renders a placeholder when story_text is null', () => {
    render(<ReadingMode tile={{ ...tile, story_text: null }} onComplete={jest.fn()} />)
    expect(screen.getByText(/Story coming soon/i)).toBeInTheDocument()
  })

  it('shows DreamMode after Start dreaming is tapped', () => {
    render(<ReadingMode tile={tile} onComplete={jest.fn()} />)
    fireEvent.click(screen.getByText(/Start dreaming/i))
    expect(screen.getByTestId('dream-mode')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="ReadingMode"
```

- [ ] **Step 3: Create `components/story/ReadingMode.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { MappedTile } from '@/lib/types'
import DreamMode from './DreamMode'

interface ReadingModeProps {
  tile: MappedTile
  onComplete: () => void
}

export default function ReadingMode({ tile, onComplete }: ReadingModeProps) {
  const [dreamModeActive, setDreamModeActive] = useState(false)

  if (dreamModeActive) {
    return <DreamMode onComplete={onComplete} minimumSeconds={120} />
  }

  return (
    <main className="min-h-screen bg-background flex flex-col px-6 pt-12 pb-24 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">{tile.name}</h1>
      <div className="flex-1 overflow-y-auto">
        <p className="text-foreground text-lg leading-relaxed">
          {tile.story_text ?? 'Story coming soon — check back after the admin has added content.'}
        </p>
      </div>
      <button
        onClick={() => setDreamModeActive(true)}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 rounded-2xl bg-violet-600 text-white font-semibold text-base shadow-lg hover:bg-violet-700 transition-colors"
      >
        Start dreaming ✨
      </button>
    </main>
  )
}
```

- [ ] **Step 4: Run ReadingMode tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="ReadingMode"
```

Expected: 4 tests passing.

- [ ] **Step 5: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: all tests passing.

- [ ] **Step 6: Commit**

```bash
cd /root/fo-dream-stories
git add components/story/ReadingMode.tsx __tests__/components/story/ReadingMode.test.tsx
git commit -m "feat: ReadingMode — story text + Start dreaming → DreamMode"
```

---

## Task 8: Dream Submission Drawer

**Files:**
- Create: `components/dream/WriteItTab.tsx`
- Create: `components/dream/SayItTab.tsx`
- Create: `components/dream/DrawItTab.tsx`
- Create: `components/dream/DreamSubmissionDrawer.tsx`
- Create: `__tests__/components/dream/WriteItTab.test.tsx`
- Create: `__tests__/components/dream/SayItTab.test.tsx`
- Create: `__tests__/components/dream/DrawItTab.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/dream/WriteItTab.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import WriteItTab from '@/components/dream/WriteItTab'

describe('WriteItTab', () => {
  it('renders a textarea', () => {
    render(<WriteItTab onSubmit={jest.fn()} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('submit button is disabled when textarea is empty', () => {
    render(<WriteItTab onSubmit={jest.fn()} />)
    expect(screen.getByRole('button', { name: /use this dream/i })).toBeDisabled()
  })

  it('submit button enables when text is entered', () => {
    render(<WriteItTab onSubmit={jest.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I flew over mountains' } })
    expect(screen.getByRole('button', { name: /use this dream/i })).not.toBeDisabled()
  })

  it('calls onSubmit with the text when submitted', () => {
    const onSubmit = jest.fn()
    render(<WriteItTab onSubmit={onSubmit} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I flew over mountains' } })
    fireEvent.click(screen.getByRole('button', { name: /use this dream/i }))
    expect(onSubmit).toHaveBeenCalledWith('I flew over mountains')
  })
})
```

Create `__tests__/components/dream/SayItTab.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import SayItTab from '@/components/dream/SayItTab'

describe('SayItTab', () => {
  it('renders the record button initially', () => {
    render(<SayItTab onSubmit={jest.fn()} />)
    expect(screen.getByText(/Tap to record/i)).toBeInTheDocument()
  })
})
```

Create `__tests__/components/dream/DrawItTab.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import DrawItTab from '@/components/dream/DrawItTab'

describe('DrawItTab', () => {
  it('renders a canvas', () => {
    render(<DrawItTab onSubmit={jest.fn()} />)
    expect(screen.getByTestId('drawing-canvas')).toBeInTheDocument()
  })

  it('submit button is disabled initially (blank canvas)', () => {
    render(<DrawItTab onSubmit={jest.fn()} />)
    expect(screen.getByRole('button', { name: /use this drawing/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="dream/"
```

- [ ] **Step 3: Create `components/dream/WriteItTab.tsx`**

```typescript
'use client'
import { useState } from 'react'

interface WriteItTabProps {
  onSubmit: (text: string) => void
}

export default function WriteItTab({ onSubmit }: WriteItTabProps) {
  const [text, setText] = useState('')
  const trimmed = text.trim()

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Describe your dream..."
        rows={4}
        className="w-full rounded-xl border border-border bg-input text-foreground px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        disabled={trimmed.length === 0}
        onClick={() => onSubmit(trimmed)}
        className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Use this dream
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create `components/dream/SayItTab.tsx`**

```typescript
'use client'
import { useRef, useState } from 'react'

interface SayItTabProps {
  childProfileId: string
  tileId: string
  onSubmit: (text: string, rawUrl: string | null) => void
}

type RecordState = 'idle' | 'recording' | 'processing' | 'confirming' | 'error'
const MAX_RECORDING_MS = 3 * 60 * 1000 // 3 minutes

export default function SayItTab({ childProfileId, tileId, onSubmit }: SayItTabProps) {
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [transcription, setTranscription] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [seconds, setSeconds] = useState(0)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const autoStopRef = useRef<ReturnType<typeof setTimeout>>()
  const rawUrlRef = useRef<string | null>(null)

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        clearInterval(timerRef.current)
        clearTimeout(autoStopRef.current)
        stream.getTracks().forEach(t => t.stop())
        setRecordState('processing')
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

          // Upload raw audio to Supabase Storage (spec: raw_input_url)
          const { uploadToStorage, storagePath } = await import('@/lib/storage')
          const path = storagePath(childProfileId, tileId, 'webm')
          rawUrlRef.current = await uploadToStorage('dream-inputs', path, blob, 'audio/webm')

          // Transcribe via Whisper
          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error)
          setTranscription(json.text)
          setRecordState('confirming')
        } catch {
          setErrorMsg("We couldn't hear that clearly — want to type it instead?")
          setRecordState('error')
        }
      }

      recorder.start()
      setRecordState('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
      autoStopRef.current = setTimeout(() => recorder.stop(), MAX_RECORDING_MS)
    } catch {
      setErrorMsg('Could not access microphone')
      setRecordState('error')
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
  }

  if (recordState === 'idle') {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <button
          onClick={startRecording}
          className="w-20 h-20 rounded-full bg-red-500 text-white font-semibold text-sm flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
        >
          🎤<br />Tap to record
        </button>
      </div>
    )
  }

  if (recordState === 'recording') {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
        <p className="text-muted-foreground text-sm">{mins}:{String(secs).padStart(2, '0')}</p>
        <button
          onClick={stopRecording}
          className="px-6 py-3 rounded-xl bg-slate-700 text-white text-sm hover:bg-slate-800 transition-colors"
        >
          Tap to stop
        </button>
      </div>
    )
  }

  if (recordState === 'processing') {
    return <p className="text-muted-foreground text-sm text-center py-4">Listening to your dream...</p>
  }

  if (recordState === 'confirming') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-foreground text-sm bg-muted rounded-xl p-4 leading-relaxed">{transcription}</p>
        <button
          onClick={() => onSubmit(transcription, rawUrlRef.current)}
          className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm"
        >
          Use this dream
        </button>
        <button
          onClick={() => { setTranscription(''); setRecordState('idle') }}
          className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 py-4">
      <p className="text-muted-foreground text-sm text-center">{errorMsg}</p>
      <button onClick={() => setRecordState('idle')} className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm">
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Create `components/dream/DrawItTab.tsx`**

```typescript
'use client'
import { useRef, useState, useEffect } from 'react'

interface DrawItTabProps {
  childProfileId: string
  tileId: string
  onSubmit: (text: string, rawUrl: string | null) => void
}

type DrawState = 'drawing' | 'processing' | 'confirming' | 'error'

export default function DrawItTab({ childProfileId, tileId, onSubmit }: DrawItTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawState, setDrawState] = useState<DrawState>('drawing')
  const [hasStrokes, setHasStrokes] = useState(false)
  const [description, setDescription] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [photoError, setPhotoError] = useState('')
  const rawUrlRef = useRef<string | null>(null)
  const strokesRef = useRef<{ x: number; y: number }[][]>([])
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([])
  const isDrawingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current; if (!canvas) return
    isDrawingRef.current = true
    currentStrokeRef.current = [getPos(e, canvas)]
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const pos = getPos(e, canvas)
    const prev = currentStrokeRef.current[currentStrokeRef.current.length - 1]
    ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
    currentStrokeRef.current.push(pos)
  }

  function endDraw() {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    strokesRef.current.push([...currentStrokeRef.current])
    currentStrokeRef.current = []
    setHasStrokes(true)
  }

  function undo() {
    strokesRef.current.pop()
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    strokesRef.current.forEach(stroke => {
      if (stroke.length < 2) return
      ctx.beginPath(); ctx.moveTo(stroke[0].x, stroke[0].y)
      stroke.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke()
    })
    setHasStrokes(strokesRef.current.length > 0)
  }

  function clear() {
    strokesRef.current = []
    setHasStrokes(false)
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  async function analyseImage(blob: Blob, mimeType: string) {
    setDrawState('processing')
    try {
      // Upload to Supabase Storage (spec: raw_input_url)
      const { uploadToStorage, storagePath } = await import('@/lib/storage')
      const ext = mimeType === 'image/png' ? 'png' : 'jpg'
      const path = storagePath(childProfileId, tileId, ext)
      rawUrlRef.current = await uploadToStorage('dream-inputs', path, blob, mimeType)

      const base64 = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = ev => resolve((ev.target?.result as string).split(',')[1])
        reader.readAsDataURL(blob)
      })
      const res = await fetch('/api/describe-drawing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDescription(json.description)
      setDrawState('confirming')
    } catch {
      setErrorMsg("We had trouble reading your drawing — want to describe it in words instead?")
      setDrawState('error')
    }
  }

  async function submitDrawing() {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.toBlob(blob => {
      if (blob) analyseImage(blob, 'image/png')
    }, 'image/png')
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setPhotoError('Please upload an image file under 10MB.')
      return
    }
    setPhotoError('')
    analyseImage(file, file.type)
  }

  if (drawState === 'processing') return <p className="text-muted-foreground text-sm text-center py-4">Reading your drawing...</p>

  if (drawState === 'confirming') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-foreground text-sm bg-muted rounded-xl p-4 leading-relaxed">{description}</p>
        <button onClick={() => onSubmit(description, rawUrlRef.current)} className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm">Use this drawing</button>
        <button onClick={() => { setDescription(''); setDrawState('drawing') }} className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm">Try again</button>
      </div>
    )
  }

  if (drawState === 'error') {
    return (
      <div className="flex flex-col gap-3 py-4">
        <p className="text-muted-foreground text-sm text-center">{errorMsg}</p>
        <button onClick={() => setDrawState('drawing')} className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm">Try again</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        data-testid="drawing-canvas"
        width={320} height={320}
        className="w-full rounded-xl border border-border touch-none"
        style={{ touchAction: 'none' }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      />
      <div className="flex gap-2">
        <button onClick={undo} disabled={!hasStrokes} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm disabled:opacity-40">Undo</button>
        <button onClick={clear} disabled={!hasStrokes} className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm disabled:opacity-40">Clear</button>
      </div>
      <label className="w-full py-2 rounded-xl border border-border text-center text-muted-foreground text-sm cursor-pointer hover:bg-muted transition-colors">
        Upload a photo instead
        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="sr-only" />
      </label>
      {photoError && <p className="text-red-500 text-xs text-center">{photoError}</p>}
      <button
        onClick={submitDrawing}
        disabled={!hasStrokes}
        className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Use this drawing
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Create `components/dream/DreamSubmissionDrawer.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { MappedTile } from '@/lib/types'
import WriteItTab from './WriteItTab'
import SayItTab from './SayItTab'
import DrawItTab from './DrawItTab'
import ImageAcceptance from './ImageAcceptance'

interface DreamSubmissionDrawerProps {
  tile: MappedTile
  childProfileId: string
  onClose: () => void
  onComplete: (result: { tokenImageUrl: string }) => void
}

type Tab = 'write' | 'say' | 'draw'

export default function DreamSubmissionDrawer({ tile, childProfileId, onClose, onComplete }: DreamSubmissionDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('write')
  const [dreamText, setDreamText] = useState<string | null>(null)
  const [rawInputUrl, setRawInputUrl] = useState<string | null>(null)
  const [inputType, setInputType] = useState<'text' | 'voice' | 'drawing'>('text')

  function handleText(text: string, type: 'text' | 'voice' | 'drawing', rawUrl: string | null = null) {
    setInputType(type)
    setDreamText(text)
    setRawInputUrl(rawUrl)
  }

  if (dreamText) {
    return (
      <>
        <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
          <ImageAcceptance
            text={dreamText}
            inputType={inputType}
            rawInputUrl={rawInputUrl}
            tile={tile}
            childProfileId={childProfileId}
            onComplete={onComplete}
            onError={() => setDreamText(null)}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-foreground font-bold text-lg">How did your adventure end?</h2>
          <button onClick={onClose} className="text-muted-foreground text-xl leading-none">×</button>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5">
          {([['write', 'Write it'], ['say', 'Say it'], ['draw', 'Draw it']] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {activeTab === 'write' && <WriteItTab onSubmit={text => handleText(text, 'text')} />}
        {activeTab === 'say' && <SayItTab childProfileId={childProfileId} tileId={tile.id} onSubmit={(text, rawUrl) => handleText(text, 'voice', rawUrl)} />}
        {activeTab === 'draw' && <DrawItTab childProfileId={childProfileId} tileId={tile.id} onSubmit={(text, rawUrl) => handleText(text, 'drawing', rawUrl)} />}
      </div>
    </>
  )
}
```

- [ ] **Step 7: Run dream tab tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="dream/"
```

Expected: 6 tests passing (4 WriteItTab + 1 SayItTab + 1 DrawItTab).

- [ ] **Step 8: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: all tests passing.

- [ ] **Step 9: Commit**

```bash
cd /root/fo-dream-stories
git add components/dream/ __tests__/components/dream/
git commit -m "feat: dream submission drawer — WriteItTab, SayItTab, DrawItTab"
```

---

## Task 9: Image Acceptance + Tile Completion

**Files:**
- Create: `components/dream/ImageAcceptance.tsx`
- Create: `__tests__/components/dream/ImageAcceptance.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/dream/ImageAcceptance.test.tsx`:

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ImageAcceptance from '@/components/dream/ImageAcceptance'
import { MappedTile } from '@/lib/types'

const tile: MappedTile = {
  id: 't1', type: 'story', name: 'The Tinkle Trunk',
  position_q: 1, position_r: 0, terrain_type: null,
  story_text: null, audio_url: null,
  alex_tip: null, alex_dream_image_url: null,
  sensory_moment_text: null, default_token_image_url: '/default.png',
  created_at: '2026-01-01T00:00:00Z',
  childState: 'listened', token_image_url: null,
}

global.fetch = jest.fn()

describe('ImageAcceptance', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ imageUrl: 'https://storage.example.com/dream.png' }),
    })
  })

  it('shows loading state initially', () => {
    render(<ImageAcceptance text="flying" inputType="text" tile={tile} childProfileId="c1" onComplete={jest.fn()} onError={jest.fn()} />)
    expect(screen.getByText(/Creating your dream/i)).toBeInTheDocument()
  })

  it('shows the generated image after loading', async () => {
    render(<ImageAcceptance text="flying" inputType="text" tile={tile} childProfileId="c1" onComplete={jest.fn()} onError={jest.fn()} />)
    await waitFor(() => screen.getByAltText('Your dream'))
    expect(screen.getByAltText('Your dream')).toBeInTheDocument()
  })

  it('calls onComplete with imageUrl when Accept is clicked', async () => {
    const onComplete = jest.fn()
    // Mock Supabase for the save call
    render(<ImageAcceptance text="flying" inputType="text" tile={tile} childProfileId="c1" onComplete={onComplete} onError={jest.fn()} />)
    await waitFor(() => screen.getByText(/Accept/i))
    fireEvent.click(screen.getByText(/Accept/i))
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="ImageAcceptance"
```

- [ ] **Step 3: Create `components/dream/ImageAcceptance.tsx`**

```typescript
'use client'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MappedTile } from '@/lib/types'

interface ImageAcceptanceProps {
  text: string
  inputType: 'text' | 'voice' | 'drawing'
  rawInputUrl: string | null
  tile: MappedTile
  childProfileId: string
  onComplete: (result: { tokenImageUrl: string }) => void
  onError: () => void
}

const MAX_ATTEMPTS = 3

export default function ImageAcceptance({ text, inputType, rawInputUrl, tile, childProfileId, onComplete, onError }: ImageAcceptanceProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [attempts, setAttempts] = useState(1)
  const [genError, setGenError] = useState(false)
  const [isShared, setIsShared] = useState(false)
  const [showAlexCard, setShowAlexCard] = useState(false)

  useEffect(() => { generateImage() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function generateImage() {
    setLoading(true)
    setGenError(false)
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, childProfileId, tileId: tile.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setImageUrl(json.imageUrl)
    } catch {
      setGenError(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    if (!imageUrl) return
    await saveDream(imageUrl)
  }

  async function handleSkip() {
    const tokenUrl = tile.default_token_image_url ?? ''
    setImageUrl(tokenUrl)  // Show default in Alex card if no generated image
    await saveDream(tokenUrl)
  }

  async function handleTryAgain() {
    setAttempts(a => a + 1)
    setImageUrl(null)
    await generateImage()
  }

  async function saveDream(tokenImageUrl: string) {
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('dream_submissions').insert({
        child_profile_id: childProfileId,
        tile_id: tile.id,
        input_type: inputType,
        raw_input_url: rawInputUrl,
        transcribed_text: text,
        generated_image_url: imageUrl,
        token_image_url: tokenImageUrl,
        is_shared: isShared,
      })
      await supabase
        .from('child_tile_states')
        .update({ state: 'completed', completed_at: new Date().toISOString() })
        .eq('child_profile_id', childProfileId)
        .eq('tile_id', tile.id)
      setShowAlexCard(true)
      // onComplete called after user dismisses the Alex reveal card
    } catch {
      setSaving(false)
      onError()
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm">Creating your dream picture...</p>
      </div>
    )
  }

  if (genError) {
    return (
      <div className="flex flex-col gap-3 py-4">
        <p className="text-muted-foreground text-sm text-center">Something went wrong with the picture — want to skip and use a default image?</p>
        <button onClick={handleSkip} className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm">Skip — use default image</button>
        <button onClick={onError} className="w-full py-3 rounded-xl bg-slate-100 text-slate-600 text-sm">Try a different description</button>
      </div>
    )
  }

  // Alex reveal card — shown after saving, before calling onComplete
  if (showAlexCard && imageUrl) {
    return (
      <div className="flex flex-col gap-4">
        <Image
          src={imageUrl}
          alt="Your dream"
          width={320} height={320}
          className="w-full rounded-2xl object-cover aspect-square"
          unoptimized
        />
        {tile.alex_tip && (
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="text-amber-800 text-xs font-semibold mb-1">Alex&apos;s Dream</p>
            <p className="text-amber-900 text-sm leading-snug">{tile.alex_tip}</p>
          </div>
        )}
        <button
          onClick={() => onComplete({ tokenImageUrl: imageUrl })}
          className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm"
        >
          Back to the map ✨
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt="Your dream"
          width={320} height={320}
          className="w-full rounded-2xl object-cover aspect-square"
          unoptimized
        />
      )}
      <p className="text-muted-foreground text-xs text-center">Attempt {attempts} of {MAX_ATTEMPTS}</p>

      {/* Sharing opt-in — defaults off, stored in is_shared */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isShared}
          onChange={e => setIsShared(e.target.checked)}
          className="w-4 h-4 rounded accent-violet-600"
        />
        <span className="text-muted-foreground text-xs">Share your dream with other kids?</span>
      </label>

      <button
        onClick={handleAccept}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold text-sm disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Accept ✨'}
      </button>
      {attempts < MAX_ATTEMPTS && (
        <button onClick={handleTryAgain} disabled={saving} className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 text-sm disabled:opacity-50">
          Try again
        </button>
      )}
      <button onClick={handleSkip} disabled={saving} className="w-full py-3 rounded-xl bg-slate-100 text-slate-500 text-sm disabled:opacity-50">
        Skip — use default image
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run ImageAcceptance tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPatterns="ImageAcceptance"
```

Expected: 3 tests passing.

- [ ] **Step 5: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: all tests passing.

- [ ] **Step 6: Commit**

```bash
cd /root/fo-dream-stories
git add components/dream/ImageAcceptance.tsx __tests__/components/dream/ImageAcceptance.test.tsx
git commit -m "feat: ImageAcceptance — DALL-E result, accept/try again/skip, saves dream_submission"
```

---

## Task 10: Map Page Full Integration

**Files:**
- Modify: `app/(app)/map/page.tsx`
- Modify: `jest.setup.ts`

This task wires everything together: popup, drawer, invisible tiles, unlock propagation.

- [ ] **Step 1: Update `jest.setup.ts`** to add `update` and `single` to the Supabase mock:

```typescript
import '@testing-library/jest-dom'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
      signUp: jest.fn().mockResolvedValue({ error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ error: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: '' } }),
      }),
    },
  }),
}))
```

- [ ] **Step 2: Run existing tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: all tests still passing.

- [ ] **Step 3: Rewrite `app/(app)/map/page.tsx`**

```typescript
'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tile, ChildTileState, MappedTile, TileState, DreamSubmission } from '@/lib/types'
import { hexDistance } from '@/lib/hex'
import HexGrid from '@/components/map/HexGrid'
import TilePopup from '@/components/map/TilePopup'
import DreamSubmissionDrawer from '@/components/dream/DreamSubmissionDrawer'
import FOMascot from '@/components/fo/FOMascot'

function getInitialState(tile: Tile, allTiles: Tile[]): TileState | null {
  if (tile.type === 'mother_tree') return 'unlocked'
  const motherTree = allTiles.find(t => t.type === 'mother_tree')
  if (motherTree) {
    const dist = hexDistance(tile.position_q, tile.position_r, motherTree.position_q, motherTree.position_r)
    if (dist === 1) return 'unlocked'
  }
  return null // ring-2+ tiles get no initial state row — they are invisible
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
  const [flippedTileId, setFlippedTileId] = useState<string | null>(null)
  const [sensoryTile, setSensoryTile] = useState<MappedTile | null>(null)

  const loadMap = useCallback(async (cId: string) => {
    const supabase = createClient()

    const { data: tileRows, error: tilesError } = await supabase
      .from('tiles').select('*').order('created_at', { ascending: true })
    if (tilesError || !tileRows) { setError('Could not load the map.'); setLoading(false); return }

    const allTiles = tileRows as Tile[]

    const { data: stateRows } = await supabase
      .from('child_tile_states').select('*').eq('child_profile_id', cId)

    let stateMap: Record<string, TileState> = {}

    if (!stateRows || stateRows.length === 0) {
      const initialStates = allTiles
        .map(tile => ({ tile, state: getInitialState(tile, allTiles) }))
        .filter(({ state }) => state !== null) as { tile: Tile; state: TileState }[]

      await supabase.from('child_tile_states').upsert(
        initialStates.map(({ tile, state }) => ({ child_profile_id: cId, tile_id: tile.id, state })),
        { onConflict: 'child_profile_id,tile_id' }
      )
      initialStates.forEach(({ tile, state }) => { stateMap[tile.id] = state })
    } else {
      ;(stateRows as ChildTileState[]).forEach(s => { stateMap[s.tile_id] = s.state })
    }

    // Fetch token images from latest dream_submissions per tile
    const { data: submissionRows } = await supabase
      .from('dream_submissions').select('tile_id, token_image_url, created_at').eq('child_profile_id', cId)
    const tokenMap: Record<string, string | null> = {}
    if (submissionRows) {
      ;(submissionRows as Pick<DreamSubmission, 'tile_id' | 'token_image_url' | 'created_at'>[])
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .forEach(s => { tokenMap[s.tile_id] = s.token_image_url })
    }

    // Only include tiles that have a state (invisible tiles are excluded)
    const mappedTiles: MappedTile[] = allTiles
      .filter(tile => stateMap[tile.id] !== undefined)
      .map(tile => ({ ...tile, childState: stateMap[tile.id], token_image_url: tokenMap[tile.id] ?? null }))

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

  async function handleTileClick(tile: MappedTile) {
    if (tile.childState === 'revealed') {
      // Reveal the tile: move to unlocked
      const supabase = createClient()
      await supabase.from('child_tile_states')
        .update({ state: 'unlocked' })
        .eq('child_profile_id', childId)
        .eq('tile_id', tile.id)
      setTiles(prev => prev.map(t => t.id === tile.id ? { ...t, childState: 'unlocked' } : t))
      return
    }
    if (tile.type === 'terrain') {
      // Show terrain sensory moment overlay (auto-dismisses after 4s)
      if (tile.sensory_moment_text) {
        setSensoryTile(tile)
        setTimeout(() => setSensoryTile(null), 4000)
      }
      return
    }
    // If tile already selected and has alex_dream_image_url → toggle flip
    if (selectedTile?.id === tile.id && tile.alex_dream_image_url) {
      setFlippedTileId(prev => prev === tile.id ? null : tile.id)
      return
    }
    setFlippedTileId(null)
    setSelectedTile(tile)
  }

  async function handleDreamComplete({ tokenImageUrl }: { tokenImageUrl: string }) {
    // drawerTile is always set when this function runs (set in onSubmitDream before selectedTile is cleared)
    if (!drawerTile || !childId) return
    const tileId = drawerTile.id

    // Update local tile to completed
    setTiles(prev => prev.map(t =>
      t.id === tileId ? { ...t, childState: 'completed', token_image_url: tokenImageUrl } : t
    ))

    // Unlock propagation: find tiles this completion unlocks
    const supabase = createClient()
    const { data: unlockRows } = await supabase
      .from('tile_unlocks').select('to_tile_id').eq('from_tile_id', tileId)

    if (unlockRows && unlockRows.length > 0) {
      const toIds = unlockRows.map((r: { to_tile_id: string }) => r.to_tile_id)

      // Fetch the tile data for newly revealed tiles
      const { data: newTileRows } = await supabase
        .from('tiles').select('*').in('id', toIds)

      if (newTileRows) {
        // Upsert child_tile_states for newly revealed tiles
        await supabase.from('child_tile_states').upsert(
          toIds.map((id: string) => ({ child_profile_id: childId, tile_id: id, state: 'revealed' })),
          { onConflict: 'child_profile_id,tile_id' }
        )
        // Add new tiles to local state
        const newMapped: MappedTile[] = (newTileRows as Tile[]).map(t => ({
          ...t, childState: 'revealed', token_image_url: null,
        }))
        setTiles(prev => {
          const existingIds = new Set(prev.map(t => t.id))
          return [...prev, ...newMapped.filter(t => !existingIds.has(t.id))]
        })
      }
    }

    setDrawerTile(null)
    setSelectedTile(null)
    setFlippedTileId(null)
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
    <main className="min-h-screen flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-foreground">{profileName}&apos;s Dream World</h1>
        <button onClick={() => router.push('/select-profile')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Switch dreamer
        </button>
      </div>
      <p className="text-muted-foreground text-sm px-4 mb-4">Tap a tile to begin an adventure</p>

      <div className="flex-1 w-full">
        <HexGrid tiles={tiles} selectedTileId={selectedTile?.id} flippedTileId={flippedTileId} onTileClick={handleTileClick} />
      </div>

      {selectedTile && selectedTile.childState !== 'revealed' && (
        <TilePopup
          tile={selectedTile}
          onClose={() => { setSelectedTile(null); setFlippedTileId(null) }}
          onListeningMode={() => { router.push(`/story/${selectedTile.id}?mode=listening`); setSelectedTile(null) }}
          onReadingMode={() => { router.push(`/story/${selectedTile.id}?mode=reading`); setSelectedTile(null) }}
          onSubmitDream={() => { setDrawerTile(selectedTile); setSelectedTile(null) }}
          onReadAgain={() => { router.push(`/story/${selectedTile.id}?mode=reading`); setSelectedTile(null) }}
        />
      )}

      {/* Terrain sensory moment overlay */}
      {sensoryTile && sensoryTile.sensory_moment_text && (
        <>
          <div
            onClick={() => setSensoryTile(null)}
            className="fixed inset-0 z-30"
          />
          <div
            onClick={() => setSensoryTile(null)}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-72 bg-white rounded-2xl shadow-2xl p-6 text-center"
          >
            <p className="text-slate-700 text-base leading-relaxed">{sensoryTile.sensory_moment_text}</p>
            <p className="text-slate-400 text-xs mt-3">Tap to close</p>
          </div>
        </>
      )}

      {drawerTile && childId && (
        <DreamSubmissionDrawer
          tile={drawerTile}
          childProfileId={childId}
          onClose={() => setDrawerTile(null)}
          onComplete={handleDreamComplete}
        />
      )}

      <FOMascot message={`Welcome, ${profileName}! Where shall we go?`} />
    </main>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
cd /root/fo-dream-stories && npm run build
```

Expected: clean build, no TypeScript errors. Fix any errors before proceeding.

- [ ] **Step 5: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: all tests passing.

- [ ] **Step 6: Commit**

```bash
cd /root/fo-dream-stories
git add "app/(app)/map/page.tsx" jest.setup.ts
git commit -m "feat: map page full integration — popup, dream drawer, unlock propagation, invisible tiles"
```

---

## Task 11: Deploy

- [ ] **Step 1: Add OPENAI_API_KEY to Vercel**

Go to https://platform.openai.com → Sign in / Create account → API Keys → Create new secret key. Copy it.

Go to Vercel Dashboard → fo-dream-stories → Settings → Environment Variables. Add:
- Key: `OPENAI_API_KEY`
- Value: (paste your key)
- Environments: Production, Preview, Development

- [ ] **Step 2: Verify build is clean**

```bash
cd /root/fo-dream-stories && npm run build
```

Expected: no errors.

- [ ] **Step 3: Push to GitHub**

```bash
cd /root/fo-dream-stories && git push
```

Vercel auto-deploys. Wait ~2 minutes.

- [ ] **Step 4: Run DB migrations in Supabase**

If not done in Task 1, run now:
1. SQL Editor → paste `supabase/migrations/003_revealed_state.sql` → Run
2. SQL Editor → paste `supabase/migrations/004_dream_submissions.sql` → Run
3. Storage → New bucket: `dream-inputs` (private)
4. Storage → New bucket: `dream-images` (public)

- [ ] **Step 5: Smoke test**

Open https://fo-dream-stories.vercel.app/login and verify:

1. Log in → select profile → map loads
2. Ring-2 tiles are invisible (not shown on map)
3. Tap Mother Tree → popup appears (no mode buttons, FO welcome)
4. Tap a ring-1 story tile → popup with "Listening mode" + "Reading mode"
5. Choose Listening mode → screen goes black, TTS reads story, cannot exit immediately
6. Audio ends → "Sweet dreams" message → tap → return to map
7. Tile pulses with amber glow
8. Tap tile → "Tell us your dream" button
9. Tap "Tell us your dream" → drawer slides up, three tabs visible
10. Write it tab → type dream → submit → DALL-E image appears
11. Accept → tile shows gold glow + dream image token
12. Ring-2 tile pops up on map as fogged silhouette
13. Tap fogged tile → fog clears, tile becomes unlocked
