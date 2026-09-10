# Plan 4 — Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private admin panel that lets Kobe manage tiles, story content, audio, unlock graph, shared dream moderation, stats, and beta signup cap — all without touching the database directly.

**Architecture:** Route group `app/(admin)/admin/` with a server-side admin guard in the layout. A `lib/admin.ts` helper provides an `isAdmin()` check and a service-role Supabase client used by every admin API route. Mutations go through API routes (audio upload, Alex image regeneration, tile CRUD, moderation actions). Read-heavy pages use server components.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Supabase (PostgreSQL + Storage), OpenAI DALL-E 3 for Alex image regeneration.

---

## File Map

**New files — DB & lib:**
- `supabase/migrations/005_admin.sql` — `is_admin` column on families, `app_settings` table
- `lib/admin.ts` — `isAdmin(userId)` helper + `adminClient()` (service role Supabase client)

**New files — Admin shell:**
- `app/(admin)/admin/layout.tsx` — server component, checks `is_admin`, renders sidebar nav
- `app/(admin)/admin/page.tsx` — stats dashboard (family count, submission count, top tiles)

**New files — Tile management:**
- `app/(admin)/admin/tiles/page.tsx` — tile list sorted by ring then name
- `app/(admin)/admin/tiles/new/page.tsx` — new tile shell page
- `app/(admin)/admin/tiles/[id]/page.tsx` — edit tile shell page
- `components/admin/TileForm.tsx` — client form component (shared by new + edit)
- `components/admin/AudioUpload.tsx` — audio file picker + upload + inline player
- `components/admin/AlexImageSection.tsx` — shows current Alex image + Regenerate button

**New files — API routes:**
- `app/api/admin/tiles/route.ts` — GET list, POST create
- `app/api/admin/tiles/[id]/route.ts` — GET one, PATCH update, DELETE
- `app/api/admin/upload-audio/route.ts` — POST multipart → Supabase `story-audio` bucket
- `app/api/admin/regenerate-alex-image/route.ts` — POST prompt → DALL-E → Supabase → update tile
- `app/api/admin/unlocks/route.ts` — GET all, PUT full replacement of unlock graph
- `app/api/admin/moderation/route.ts` — GET shared submissions, DELETE remove
- `app/api/admin/stats/route.ts` — GET aggregated counts
- `app/api/admin/settings/route.ts` — GET/PATCH beta cap config

**New files — Unlock graph:**
- `app/(admin)/admin/unlocks/page.tsx` — unlock editor shell
- `components/admin/UnlockMatrix.tsx` — client component, checkbox grid (from_tile → to_tile)

**New files — Moderation:**
- `app/(admin)/admin/moderation/page.tsx` — moderation shell
- `components/admin/ModerationCard.tsx` — shows dream image + text + Remove button

**New files — Settings:**
- `app/(admin)/admin/settings/page.tsx` — beta cap toggle + limit input

**New files — Auth:**
- `app/api/auth/check-beta/route.ts` — service-role beta cap check, called by SignupForm before signUp()

**Modified files:**
- `components/auth/SignupForm.tsx` — fetch /api/auth/check-beta before supabase.auth.signUp()
- `lib/types.ts` — fix Family interface (add is_admin, remove phantom email), add AppSettings

**Test files:**
- `__tests__/admin/tiles.test.ts`
- `__tests__/admin/unlocks.test.ts`
- `__tests__/admin/moderation.test.ts`

---

## Task 1: DB Migration + Admin Helper

**Files:**
- Create: `supabase/migrations/005_admin.sql`
- Create: `lib/admin.ts`
- Modify: `lib/types.ts`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/005_admin.sql`:

```sql
-- Add is_admin flag to families
alter table public.families
  add column if not exists is_admin boolean not null default false;

-- App-wide settings (single row, id = 1)
create table if not exists public.app_settings (
  id        integer primary key default 1 check (id = 1),
  beta_cap  integer not null default 100,
  beta_open boolean not null default true
);
insert into public.app_settings (id, beta_cap, beta_open)
  values (1, 100, true)
  on conflict (id) do nothing;

-- Admin can read/write app_settings; public cannot
alter table public.app_settings enable row level security;
create policy "Admin full access to app_settings"
  on public.app_settings for all
  using (
    exists (select 1 from public.families where id = auth.uid() and is_admin = true)
  );

grant select, insert, update on public.app_settings to authenticated;

-- Create story-audio storage bucket via API (see Step 2)

-- Public can read beta settings (needed for signup cap check via service role API)
-- Service role bypasses RLS, so no extra policy needed for the /api/auth/check-beta route.
-- The admin policy above covers the admin panel reads/writes.
```

- [ ] **Step 2: Run the migration via Supabase management API**

```bash
source /root/.secrets/tokens.env
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "alter table public.families add column if not exists is_admin boolean not null default false;"}'

curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "create table if not exists public.app_settings (id integer primary key default 1 check (id = 1), beta_cap integer not null default 100, beta_open boolean not null default true); insert into public.app_settings values (1, 100, true) on conflict do nothing;"}'

curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "alter table public.app_settings enable row level security; create policy \"Admin app_settings\" on public.app_settings for all using (exists (select 1 from public.families where id = auth.uid() and is_admin = true)); grant select, update on public.app_settings to authenticated;"}'
```

Expected: `{"message":"Success"}` for each.

- [ ] **Step 3: Create the story-audio storage bucket**

```bash
source /root/.secrets/tokens.env
curl -s -X POST "https://tdoqdiyalenignhitxgj.supabase.co/storage/v1/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d '{"id": "story-audio", "name": "story-audio", "public": true}'
```

Expected: `{"name":"story-audio"}` or `{"statusCode":"409"...}` if already exists.

- [ ] **Step 4: Mark Kobe's account as admin**

```bash
source /root/.secrets/tokens.env
# Get Kobe's family ID (auth.users.id = families.id)
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT id FROM auth.users WHERE email = '"'"'kobe.thys@gmail.com'"'"'"}'
```

Note the UUID returned, then:

```bash
KOBE_ID="<uuid-from-above>"
curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"update public.families set is_admin = true where id = '$KOBE_ID'\"}"
```

Expected: `{"message":"Success"}`.

- [ ] **Step 5: Create `lib/admin.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client with service role — bypasses RLS.
 * SERVER SIDE ONLY. Never import in client components.
 */
export function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}

/**
 * Returns true if the currently authenticated user has is_admin = true.
 * Call at the top of every admin layout and API route.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase
      .from('families')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    return data?.is_admin === true
  } catch {
    return false
  }
}
```

- [ ] **Step 6: Update `lib/types.ts`**

Update the `Family` interface (it has a phantom `email` field that doesn't exist in the DB) and add `AppSettings`:

```ts
// Replace the existing Family interface:
export interface Family {
  id: string
  is_admin: boolean
  created_at: string
}

// Append:
export interface AppSettings {
  id: 1
  beta_cap: number
  beta_open: boolean
}
```

- [ ] **Step 7: Add SUPABASE_SERVICE_ROLE to Vercel environment variables**

```bash
source /root/.secrets/tokens.env
# Verify the env var name used in the codebase
grep -r "SUPABASE_SERVICE_ROLE" /root/fo-dream-stories/lib/ /root/fo-dream-stories/app/api/ 2>/dev/null
```

Then in the Vercel dashboard (or via CLI), add `SUPABASE_SERVICE_ROLE` with value from `/root/.secrets/tokens.env`.

```bash
# Via Vercel CLI (if available):
vercel env add SUPABASE_SERVICE_ROLE production
# Paste the value from tokens.env
```

- [ ] **Step 8: Commit**

```bash
cd /root/fo-dream-stories
git add supabase/migrations/005_admin.sql lib/admin.ts lib/types.ts
git commit -m "feat: admin DB migration, isAdmin helper, service role client"
```

---

## Task 2: Admin Shell — Layout + Navigation

**Files:**
- Create: `app/(admin)/admin/layout.tsx`

- [ ] **Step 1: Create `app/(admin)/admin/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import Link from 'next/link'

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/tiles', label: 'Tiles' },
  { href: '/admin/unlocks', label: 'Unlock Graph' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/settings', label: 'Settings' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin()
  if (!admin) redirect('/map')

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-1 shrink-0">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 px-2">Admin</p>
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            {label}
          </Link>
        ))}
        <div className="mt-auto">
          <Link href="/map" className="px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 block">
            Back to app
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify the layout compiles**

```bash
cd /root/fo-dream-stories
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing ones unrelated to admin).

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/admin/layout.tsx
git commit -m "feat: admin layout with sidebar nav + isAdmin guard"
```

---

## Task 3: Stats Dashboard

**Files:**
- Create: `app/api/admin/stats/route.ts`
- Create: `app/(admin)/admin/page.tsx`

- [ ] **Step 1: Create `app/api/admin/stats/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = adminClient()

  const [
    { count: familyCount },
    { count: profileCount },
    { count: submissionCount },
    { count: sharedCount },
    { data: topTiles },
  ] = await Promise.all([
    db.from('families').select('*', { count: 'exact', head: true }),
    db.from('child_profiles').select('*', { count: 'exact', head: true }),
    db.from('dream_submissions').select('*', { count: 'exact', head: true }),
    db.from('dream_submissions').select('*', { count: 'exact', head: true }).eq('is_shared', true),
    db.from('dream_submissions')
      .select('tile_id, tiles(name)')
      .limit(100),
  ])

  // Count submissions per tile for top 5
  const tileCounts: Record<string, { name: string; count: number }> = {}
  for (const row of topTiles ?? []) {
    const id = row.tile_id
    const name = (row.tiles as { name: string } | null)?.name ?? id
    tileCounts[id] = { name, count: (tileCounts[id]?.count ?? 0) + 1 }
  }
  const topStories = Object.values(tileCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return NextResponse.json({
    familyCount: familyCount ?? 0,
    profileCount: profileCount ?? 0,
    submissionCount: submissionCount ?? 0,
    sharedCount: sharedCount ?? 0,
    topStories,
  })
}
```

- [ ] **Step 2: Create `app/(admin)/admin/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'

interface Stats {
  familyCount: number
  profileCount: number
  submissionCount: number
  sharedCount: number
  topStories: { name: string; count: number }[]
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats)
  }, [])

  if (!stats) return <p className="text-gray-500">Loading stats...</p>

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Families" value={stats.familyCount} />
        <StatCard label="Child profiles" value={stats.profileCount} />
        <StatCard label="Dream submissions" value={stats.submissionCount} />
        <StatCard label="Shared dreams" value={stats.sharedCount} />
      </div>
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Top stories by submissions</h2>
        {stats.topStories.length === 0
          ? <p className="text-gray-500 text-sm">No submissions yet.</p>
          : stats.topStories.map(s => (
            <div key={s.name} className="flex justify-between py-2 border-b border-gray-800 last:border-0">
              <span className="text-gray-200 text-sm">{s.name}</span>
              <span className="text-gray-400 text-sm">{s.count}</span>
            </div>
          ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add app/\(admin\)/admin/page.tsx app/api/admin/stats/route.ts
git commit -m "feat: admin dashboard with stats"
```

---

## Task 4: Tile List + New Tile + Edit Shell

**Files:**
- Create: `app/api/admin/tiles/route.ts`
- Create: `app/api/admin/tiles/[id]/route.ts`
- Create: `app/(admin)/admin/tiles/page.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/admin/tiles.test.ts`:

```ts
// Note: these tests mock isAdmin and adminClient.
// They verify that the route correctly gates non-admins and returns expected shapes.

jest.mock('@/lib/admin', () => ({
  isAdmin: jest.fn(),
  adminClient: jest.fn(),
}))

import { isAdmin, adminClient } from '@/lib/admin'
import { GET, POST } from '@/app/api/admin/tiles/route'
import { NextRequest } from 'next/server'

const mockIsAdmin = isAdmin as jest.MockedFunction<typeof isAdmin>
const mockAdminClient = adminClient as jest.MockedFunction<typeof adminClient>

describe('GET /api/admin/tiles', () => {
  it('returns 403 when not admin', async () => {
    mockIsAdmin.mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns tile list when admin', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockAdminClient.mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => ({ data: [{ id: '1', name: 'Mother Tree', type: 'mother_tree' }], error: null }),
        }),
      }),
    } as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /root/fo-dream-stories
npx jest __tests__/admin/tiles.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — route files don't exist yet.

- [ ] **Step 3: Create `app/api/admin/tiles/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db
    .from('tiles')
    .select('*')
    .order('type')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const body = await request.json()
  const { data, error } = await db.from('tiles').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 4: Create `app/api/admin/tiles/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const db = adminClient()
  const { data, error } = await db.from('tiles').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const db = adminClient()
  const body = await request.json()
  const { data, error } = await db.from('tiles').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const db = adminClient()
  const { error } = await db.from('tiles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx jest __tests__/admin/tiles.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 6: Create `app/(admin)/admin/tiles/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tile } from '@/lib/types'

export default function TileListPage() {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/tiles').then(r => r.json()).then(data => {
      setTiles(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-gray-500">Loading tiles...</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tiles</h1>
        <Link
          href="/admin/tiles/new"
          className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
        >
          + New tile
        </Link>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-800">
            <th className="pb-2 pr-4">Name</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2 pr-4">Position (q, r)</th>
            <th className="pb-2 pr-4">Story</th>
            <th className="pb-2 pr-4">Audio</th>
            <th className="pb-2">Alex image</th>
          </tr>
        </thead>
        <tbody>
          {tiles.map(tile => (
            <tr key={tile.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-3 pr-4">
                <Link href={`/admin/tiles/${tile.id}`} className="text-violet-400 hover:underline">
                  {tile.name}
                </Link>
              </td>
              <td className="py-3 pr-4 text-gray-400">{tile.type}</td>
              <td className="py-3 pr-4 text-gray-400">{tile.position_q}, {tile.position_r}</td>
              <td className="py-3 pr-4">{tile.story_text ? '✓' : <span className="text-gray-600">—</span>}</td>
              <td className="py-3 pr-4">{tile.audio_url ? '✓' : <span className="text-gray-600">—</span>}</td>
              <td className="py-3">{tile.alex_dream_image_url ? '✓' : <span className="text-gray-600">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/tiles/ app/\(admin\)/admin/tiles/page.tsx __tests__/admin/tiles.test.ts
git commit -m "feat: admin tile list + CRUD API routes"
```

---

## Task 5: Tile Edit Form + Audio Upload

**Files:**
- Create: `app/api/admin/upload-audio/route.ts`
- Create: `components/admin/AudioUpload.tsx`
- Create: `components/admin/TileForm.tsx`
- Create: `app/(admin)/admin/tiles/new/page.tsx`
- Create: `app/(admin)/admin/tiles/[id]/page.tsx`

- [ ] **Step 1: Create `app/api/admin/upload-audio/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const formData = await request.formData()
  const file = formData.get('audio') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const db = adminClient()
  const ext = file.name.split('.').pop() ?? 'mp3'
  const path = `${crypto.randomUUID()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error } = await db.storage
    .from('story-audio')
    .upload(path, new Blob([arrayBuffer], { type: file.type }), {
      contentType: file.type,
      upsert: false,
    })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = db.storage.from('story-audio').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
```

- [ ] **Step 2: Create `components/admin/AudioUpload.tsx`**

```tsx
'use client'
import { useRef, useState } from 'react'

interface AudioUploadProps {
  currentUrl: string | null
  onUploaded: (url: string) => void
}

export default function AudioUpload({ currentUrl, onUploaded }: AudioUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    const formData = new FormData()
    formData.append('audio', file)
    const res = await fetch('/api/admin/upload-audio', { method: 'POST', body: formData })
    const json = await res.json()
    setUploading(false)
    if (!res.ok) { alert(json.error); return }
    setPreviewUrl(json.url)
    onUploaded(json.url)
  }

  return (
    <div className="flex flex-col gap-3">
      {previewUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={previewUrl} className="w-full" />
      )}
      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : previewUrl ? 'Replace audio' : 'Upload audio'}
        </button>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-gray-200 truncate max-w-xs">
            {previewUrl.split('/').pop()}
          </a>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create `components/admin/TileForm.tsx`**

This is the main edit form — handles all tile fields including audio upload and Alex tip.

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tile } from '@/lib/types'
import AudioUpload from './AudioUpload'

type TileInput = Partial<Omit<Tile, 'id' | 'created_at' | 'alex_dream_image_url'>>

interface TileFormProps {
  tile?: Tile          // undefined = new tile
}

const TILE_TYPES = ['mother_tree', 'story', 'terrain'] as const
const TERRAIN_TYPES = ['forest', 'land', 'water', 'mountain'] as const

export default function TileForm({ tile }: TileFormProps) {
  // Note: save Alex tip text and save tile BEFORE clicking Regenerate image —
  // AlexImageSection reads the tile prop and uses the saved alex_tip as the DALL-E prompt.
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<TileInput>({
    type: tile?.type ?? 'story',
    name: tile?.name ?? '',
    position_q: tile?.position_q ?? 0,
    position_r: tile?.position_r ?? 0,
    terrain_type: tile?.terrain_type ?? null,
    story_text: tile?.story_text ?? '',
    audio_url: tile?.audio_url ?? null,
    alex_tip: tile?.alex_tip ?? '',
    sensory_moment_text: tile?.sensory_moment_text ?? '',
    default_token_image_url: tile?.default_token_image_url ?? null,
  })

  function set<K extends keyof TileInput>(key: K, value: TileInput[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const url = tile ? `/api/admin/tiles/${tile.id}` : '/api/admin/tiles'
    const method = tile ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error); return }
    router.push('/admin/tiles')
    router.refresh()
  }

  async function handleDelete() {
    if (!tile) return
    if (!confirm(`Delete "${tile.name}"? This cannot be undone.`)) return
    await fetch(`/api/admin/tiles/${tile.id}`, { method: 'DELETE' })
    router.push('/admin/tiles')
    router.refresh()
  }

  const isStory = form.type === 'story' || form.type === 'mother_tree'
  const isTerrain = form.type === 'terrain'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      {/* Type + Name + Position */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Type</span>
          <select
            value={form.type}
            onChange={e => set('type', e.target.value as Tile['type'])}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            {TILE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Name</span>
          <input
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Position Q</span>
          <input
            type="number"
            value={form.position_q}
            onChange={e => set('position_q', parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Position R</span>
          <input
            type="number"
            value={form.position_r}
            onChange={e => set('position_r', parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </label>
      </div>

      {/* Terrain type (only for terrain tiles) */}
      {isTerrain && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Terrain type</span>
          <select
            value={form.terrain_type ?? ''}
            onChange={e => set('terrain_type', e.target.value as Tile['terrain_type'])}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">— select —</option>
            {TERRAIN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      )}

      {/* Story text (story/mother_tree only) */}
      {isStory && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Story text</span>
          <textarea
            value={form.story_text ?? ''}
            onChange={e => set('story_text', e.target.value)}
            rows={8}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm leading-relaxed resize-y"
          />
        </label>
      )}

      {/* Audio upload */}
      {isStory && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Audio</span>
          <AudioUpload
            currentUrl={form.audio_url ?? null}
            onUploaded={url => set('audio_url', url)}
          />
        </div>
      )}

      {/* Alex's tip (story/mother_tree only) */}
      {isStory && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Alex&apos;s tip</span>
          <textarea
            value={form.alex_tip ?? ''}
            onChange={e => set('alex_tip', e.target.value)}
            rows={3}
            placeholder="What Alex found here..."
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm leading-relaxed"
          />
        </label>
      )}

      {/* Sensory moment (terrain only) */}
      {isTerrain && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Sensory moment</span>
          <textarea
            value={form.sensory_moment_text ?? ''}
            onChange={e => set('sensory_moment_text', e.target.value)}
            rows={2}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </label>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : tile ? 'Save changes' : 'Create tile'}
        </button>
        {tile && (
          <button
            type="button"
            onClick={handleDelete}
            className="px-6 py-2 bg-red-900/50 text-red-400 rounded-lg text-sm hover:bg-red-900"
          >
            Delete tile
          </button>
        )}
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Create `app/(admin)/admin/tiles/new/page.tsx`**

```tsx
import TileForm from '@/components/admin/TileForm'

export default function NewTilePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">New tile</h1>
      <TileForm />
    </div>
  )
}
```

- [ ] **Step 5: Create `app/(admin)/admin/tiles/[id]/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Tile } from '@/lib/types'
import TileForm from '@/components/admin/TileForm'
import AlexImageSection from '@/components/admin/AlexImageSection'

export default function EditTilePage() {
  const { id } = useParams<{ id: string }>()
  const [tile, setTile] = useState<Tile | null>(null)

  useEffect(() => {
    fetch(`/api/admin/tiles/${id}`).then(r => r.json()).then(setTile)
  }, [id])

  if (!tile) return <p className="text-gray-500">Loading tile...</p>

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Edit: {tile.name}</h1>
      <TileForm tile={tile} />
      {(tile.type === 'story' || tile.type === 'mother_tree') && (
        <div className="border-t border-gray-800 pt-8">
          <h2 className="text-lg font-semibold mb-4">Alex&apos;s dream image</h2>
          <AlexImageSection tile={tile} onUpdated={setTile} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: TypeScript check**

```bash
cd /root/fo-dream-stories && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -10
```

Fix any errors before continuing.

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/tiles/ app/api/admin/upload-audio/ \
        app/\(admin\)/admin/tiles/ \
        components/admin/TileForm.tsx components/admin/AudioUpload.tsx
git commit -m "feat: tile edit form with audio upload"
```

---

## Task 6: Alex Dream Image Management

**Files:**
- Create: `app/api/admin/regenerate-alex-image/route.ts`
- Create: `components/admin/AlexImageSection.tsx`

- [ ] **Step 1: Create `app/api/admin/regenerate-alex-image/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { isAdmin, adminClient } from '@/lib/admin'

const ALEX_STYLE = "A child's dream illustration, watercolour and ink, soft magical light, storybook style, warm palette, child-safe, wonder-filled"

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const { tileId, alexTip } = await request.json()
  if (!tileId || !alexTip) return NextResponse.json({ error: 'tileId and alexTip required' }, { status: 400 })

  const prompt = `${alexTip}. ${ALEX_STYLE}`
  const result = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    size: '1024x1024',
    response_format: 'url',
  })
  const openAiUrl = result.data?.[0]?.url
  if (!openAiUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

  // Fetch and store in Supabase
  const imageResponse = await fetch(openAiUrl)
  const buffer = await imageResponse.arrayBuffer()
  const db = adminClient()
  const path = `alex-dreams/${tileId}/${crypto.randomUUID()}.png`
  const { error: uploadError } = await db.storage
    .from('dream-images')
    .upload(path, new Blob([buffer], { type: 'image/png' }), { contentType: 'image/png', upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data } = db.storage.from('dream-images').getPublicUrl(path)

  // Update the tile
  const { error: updateError } = await db
    .from('tiles')
    .update({ alex_dream_image_url: data.publicUrl })
    .eq('id', tileId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ imageUrl: data.publicUrl })
}
```

- [ ] **Step 2: Create `components/admin/AlexImageSection.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { Tile } from '@/lib/types'

interface Props {
  tile: Tile
  onUpdated: (tile: Tile) => void
}

export default function AlexImageSection({ tile, onUpdated }: Props) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  async function handleRegenerate() {
    if (!tile.alex_tip) { setError('Add Alex\'s tip text first — it\'s used as the image prompt.'); return }
    setGenerating(true)
    setError('')
    const res = await fetch('/api/admin/regenerate-alex-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tileId: tile.id, alexTip: tile.alex_tip }),
    })
    const json = await res.json()
    setGenerating(false)
    if (!res.ok) { setError(json.error); return }
    onUpdated({ ...tile, alex_dream_image_url: json.imageUrl })
  }

  return (
    <div className="flex flex-col gap-4">
      {tile.alex_dream_image_url ? (
        <div className="flex gap-6 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tile.alex_dream_image_url}
            alt="Alex's dream"
            className="w-48 h-48 rounded-xl object-cover"
          />
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-400">Current Alex dream image</p>
            <button
              onClick={handleRegenerate}
              disabled={generating}
              className="px-4 py-2 bg-amber-600/30 text-amber-400 rounded-lg text-sm hover:bg-amber-600/50 disabled:opacity-50 w-fit"
            >
              {generating ? 'Generating…' : 'Regenerate image'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500">No Alex dream image yet. Add Alex&apos;s tip text above and generate one.</p>
          <button
            onClick={handleRegenerate}
            disabled={generating || !tile.alex_tip}
            className="px-4 py-2 bg-amber-600/30 text-amber-400 rounded-lg text-sm hover:bg-amber-600/50 disabled:opacity-50 w-fit"
          >
            {generating ? 'Generating…' : 'Generate Alex dream image'}
          </button>
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /root/fo-dream-stories
git add app/api/admin/regenerate-alex-image/ components/admin/AlexImageSection.tsx
git commit -m "feat: Alex dream image generation + management UI"
```

---

## Task 7: Unlock Graph Editor

**Files:**
- Create: `app/api/admin/unlocks/route.ts`
- Create: `components/admin/UnlockMatrix.tsx`
- Create: `app/(admin)/admin/unlocks/page.tsx`

- [ ] **Step 1: Write failing test**

Append to `__tests__/admin/unlocks.test.ts`:

```ts
jest.mock('@/lib/admin', () => ({
  isAdmin: jest.fn(),
  adminClient: jest.fn(),
}))

import { isAdmin, adminClient } from '@/lib/admin'
import { GET, PUT } from '@/app/api/admin/unlocks/route'

const mockIsAdmin = isAdmin as jest.MockedFunction<typeof isAdmin>
const mockAdminClient = adminClient as jest.MockedFunction<typeof adminClient>

describe('GET /api/admin/unlocks', () => {
  it('returns 403 when not admin', async () => {
    mockIsAdmin.mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx jest __tests__/admin/unlocks.test.ts --no-coverage 2>&1 | tail -5
```

- [ ] **Step 3: Create `app/api/admin/unlocks/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db.from('tile_unlocks').select('from_tile_id, to_tile_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT replaces the entire unlock graph: { unlocks: [{from_tile_id, to_tile_id}] }
export async function PUT(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { unlocks } = await request.json() as { unlocks: { from_tile_id: string; to_tile_id: string }[] }
  const db = adminClient()
  // Delete all existing rows. PostgREST requires at least one filter on DELETE;
  // filtering on a column that is always non-null satisfies this requirement cleanly.
  const { error: deleteError } = await db.from('tile_unlocks').delete().not('from_tile_id', 'is', null)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  if (unlocks.length > 0) {
    const { error: insertError } = await db.from('tile_unlocks').insert(unlocks)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx jest __tests__/admin/unlocks.test.ts --no-coverage 2>&1 | tail -5
```

- [ ] **Step 5: Create `components/admin/UnlockMatrix.tsx`**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { Tile } from '@/lib/types'

interface Unlock { from_tile_id: string; to_tile_id: string }

export default function UnlockMatrix() {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [unlocks, setUnlocks] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/tiles').then(r => r.json()),
      fetch('/api/admin/unlocks').then(r => r.json()),
    ]).then(([tileData, unlockData]: [Tile[], Unlock[]]) => {
      setTiles(tileData.filter(t => t.type !== 'terrain'))
      setUnlocks(new Set(unlockData.map(u => `${u.from_tile_id}:${u.to_tile_id}`)))
    })
  }, [])

  function toggle(fromId: string, toId: string) {
    if (fromId === toId) return
    const key = `${fromId}:${toId}`
    setUnlocks(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function save() {
    setSaving(true)
    const unlockList = Array.from(unlocks).map(k => {
      const [from, to] = k.split(':')
      return { from_tile_id: from, to_tile_id: to }
    })
    await fetch('/api/admin/unlocks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlocks: unlockList }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (tiles.length === 0) return <p className="text-gray-500">Loading unlock graph...</p>

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-gray-400">
        Each row is a "completing X unlocks Y" relationship. Tick a cell to add an unlock rule.
      </p>
      <div className="overflow-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left text-gray-500 pr-4 pb-2 whitespace-nowrap">Completing →</th>
              {tiles.map(t => (
                <th key={t.id} className="text-gray-400 pb-2 px-2 font-normal whitespace-nowrap writing-vertical" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxWidth: 32 }}>
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tiles.map(from => (
              <tr key={from.id} className="border-t border-gray-800">
                <td className="text-gray-300 pr-4 py-1 whitespace-nowrap">{from.name}</td>
                {tiles.map(to => (
                  <td key={to.id} className="text-center px-2 py-1">
                    {from.id === to.id
                      ? <span className="text-gray-700">—</span>
                      : <input
                          type="checkbox"
                          checked={unlocks.has(`${from.id}:${to.id}`)}
                          onChange={() => toggle(from.id, to.id)}
                          className="cursor-pointer"
                        />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 w-fit"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save unlock graph'}
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Create `app/(admin)/admin/unlocks/page.tsx`**

```tsx
import UnlockMatrix from '@/components/admin/UnlockMatrix'

export default function UnlocksPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Unlock graph</h1>
        <p className="text-sm text-gray-400 mt-1">Define which tile completions reveal new tiles on the map.</p>
      </div>
      <UnlockMatrix />
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/unlocks/ components/admin/UnlockMatrix.tsx \
        app/\(admin\)/admin/unlocks/ __tests__/admin/unlocks.test.ts
git commit -m "feat: unlock graph editor with checkbox matrix"
```

---

## Task 8: Shared Dreams Moderation

**Files:**
- Create: `app/api/admin/moderation/route.ts`
- Create: `components/admin/ModerationCard.tsx`
- Create: `app/(admin)/admin/moderation/page.tsx`

- [ ] **Step 1: Write failing test**

Create `__tests__/admin/moderation.test.ts`:

```ts
jest.mock('@/lib/admin', () => ({
  isAdmin: jest.fn(),
  adminClient: jest.fn(),
}))

import { isAdmin } from '@/lib/admin'
import { GET } from '@/app/api/admin/moderation/route'

const mockIsAdmin = isAdmin as jest.MockedFunction<typeof isAdmin>

describe('GET /api/admin/moderation', () => {
  it('returns 403 when not admin', async () => {
    mockIsAdmin.mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx jest __tests__/admin/moderation.test.ts --no-coverage 2>&1 | tail -5
```

- [ ] **Step 3: Create `app/api/admin/moderation/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db
    .from('dream_submissions')
    .select(`
      id, transcribed_text, token_image_url, generated_image_url,
      input_type, is_shared, created_at,
      child_profiles ( name, date_of_birth ),
      tiles ( name )
    `)
    .eq('is_shared', true)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE a shared dream (sets is_shared = false)
export async function DELETE(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await request.json()
  const db = adminClient()
  const { error } = await db
    .from('dream_submissions')
    .update({ is_shared: false })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx jest __tests__/admin/moderation.test.ts --no-coverage 2>&1 | tail -5
```

- [ ] **Step 5: Create `components/admin/ModerationCard.tsx`**

```tsx
'use client'
import { getAge } from '@/lib/types'

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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex gap-4">
      {submission.token_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={submission.token_image_url}
          alt="Dream"
          className="w-20 h-20 rounded-lg object-cover shrink-0"
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
  )
}
```

- [ ] **Step 6: Create `app/(admin)/admin/moderation/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import ModerationCard from '@/components/admin/ModerationCard'

interface Submission {
  id: string
  transcribed_text: string | null
  token_image_url: string | null
  input_type: string
  created_at: string
  child_profiles: { name: string; date_of_birth: string } | null
  tiles: { name: string } | null
}

export default function ModerationPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/moderation').then(r => r.json()).then(data => {
      setSubmissions(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-gray-500">Loading shared dreams...</p>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Moderation</h1>
        <p className="text-sm text-gray-400 mt-1">{submissions.length} shared dream{submissions.length !== 1 ? 's' : ''}</p>
      </div>
      {submissions.length === 0
        ? <p className="text-gray-600">No shared dreams yet.</p>
        : submissions.map(s => (
          <ModerationCard
            key={s.id}
            submission={s}
            onRemoved={id => setSubmissions(prev => prev.filter(s => s.id !== id))}
          />
        ))}
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/moderation/ components/admin/ModerationCard.tsx \
        app/\(admin\)/admin/moderation/ __tests__/admin/moderation.test.ts
git commit -m "feat: shared dreams moderation UI"
```

---

## Task 9: Beta Cap Settings

**Files:**
- Create: `app/api/admin/settings/route.ts`
- Create: `app/(admin)/admin/settings/page.tsx`
- Modify: `app/(auth)/signup/page.tsx` — enforce cap at signup

- [ ] **Step 1: Create `app/api/admin/settings/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { isAdmin, adminClient } from '@/lib/admin'

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = adminClient()
  const { data, error } = await db.from('app_settings').select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const db = adminClient()
  const { data, error } = await db.from('app_settings').update(body).eq('id', 1).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Create `app/(admin)/admin/settings/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { AppSettings } from '@/lib/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(setSettings)
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beta_cap: settings.beta_cap, beta_open: settings.beta_open }),
    })
    const json = await res.json()
    setSaving(false)
    if (res.ok) { setSettings(json); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  if (!settings) return <p className="text-gray-500">Loading settings...</p>

  return (
    <div className="flex flex-col gap-8 max-w-md">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Beta access</h2>

        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-200">Signups open</span>
          <input
            type="checkbox"
            checked={settings.beta_open}
            onChange={e => setSettings(s => s ? { ...s, beta_open: e.target.checked } : s)}
            className="w-5 h-5 cursor-pointer"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Max families (beta cap)</span>
          <input
            type="number"
            min={1}
            value={settings.beta_cap}
            onChange={e => setSettings(s => s ? { ...s, beta_cap: parseInt(e.target.value) } : s)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-32"
          />
        </label>

        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 w-fit"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save settings'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `/api/auth/check-beta/route.ts`**

The signup happens in `components/auth/SignupForm.tsx` (a `'use client'` component). The beta check must run server-side using the service role (to bypass RLS on `app_settings`). Create a dedicated API route that `SignupForm.tsx` calls via `fetch` before calling `supabase.auth.signUp()`.

```ts
// app/api/auth/check-beta/route.ts
import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/admin'

export async function GET() {
  const db = adminClient()
  const { data, error } = await db
    .from('app_settings')
    .select('beta_open, beta_cap')
    .single()

  if (error || !data) return NextResponse.json({ allowed: true }) // fail open

  if (!data.beta_open) {
    return NextResponse.json({ allowed: false, reason: 'Signups are currently closed.' })
  }

  const { count } = await db
    .from('families')
    .select('*', { count: 'exact', head: true })

  if ((count ?? 0) >= data.beta_cap) {
    return NextResponse.json({ allowed: false, reason: `Beta is full (${data.beta_cap} families). Check back later.` })
  }

  return NextResponse.json({ allowed: true })
}
```

- [ ] **Step 4: Update `components/auth/SignupForm.tsx` to call the beta check first**

Add the beta check call before `supabase.auth.signUp()` in `handleSubmit`:

```ts
// In handleSubmit, before the supabase.auth.signUp call, add:
const betaRes = await fetch('/api/auth/check-beta')
const betaJson = await betaRes.json()
if (!betaJson.allowed) {
  setError(betaJson.reason)
  setLoading(false)
  return
}
```

- [ ] **Step 5: Full test run**

```bash
cd /root/fo-dream-stories && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Fix any errors.

- [ ] **Step 7: Commit and push**

```bash
git add app/api/admin/settings/ app/\(admin\)/admin/settings/ \
        app/\(auth\)/signup/page.tsx
git commit -m "feat: beta cap settings with admin toggle + signup enforcement"
git push origin main
```

---

## Task 10: Add SUPABASE_SERVICE_ROLE to Vercel + Final Deploy Verification

- [ ] **Step 1: Set SUPABASE_SERVICE_ROLE in Vercel**

Check if it's already set:
```bash
source /root/.secrets/tokens.env
curl -s "https://api.vercel.com/v10/projects/$VERCEL_PROJECT_ID/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
keys = [e['key'] for e in data.get('envs', [])]
print('SUPABASE_SERVICE_ROLE in Vercel:', 'SUPABASE_SERVICE_ROLE' in keys)
print('All keys:', keys)
"
```

If not set, add it:
```bash
curl -s -X POST "https://api.vercel.com/v10/projects/$VERCEL_PROJECT_ID/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"key\": \"SUPABASE_SERVICE_ROLE\",
    \"value\": \"$SUPABASE_SERVICE_ROLE\",
    \"type\": \"encrypted\",
    \"target\": [\"production\", \"preview\"]
  }"
```

- [ ] **Step 2: Trigger a new Vercel deploy if env var was just added**

```bash
# Push any pending commit, or create an empty commit to trigger deploy
git commit --allow-empty -m "chore: trigger deploy for new env vars"
git push origin main
```

- [ ] **Step 3: Verify deploy succeeds**

```bash
sleep 30
curl -s "https://api.vercel.com/v6/deployments?projectId=$VERCEL_PROJECT_ID&limit=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
d = data['deployments'][0]
print('Status:', d['state'])
print('URL:', d.get('url',''))
"
```

- [ ] **Step 4: Smoke test the admin panel**

Open https://fo-dream-stories.vercel.app/admin in a browser logged in as Kobe.
- Verify redirect to `/map` for non-admin accounts
- Verify dashboard loads and shows stats
- Verify tile list loads
- Edit one tile and save — verify change persists
- Verify unlock matrix loads
- Verify moderation page loads

---

## Summary

| Task | Deliverable |
|------|------------|
| 1 | DB migration (is_admin, app_settings), service role client, storage bucket |
| 2 | Admin layout with sidebar nav + auth guard |
| 3 | Stats dashboard (families, submissions, top stories) |
| 4 | Tile list page + CRUD API routes |
| 5 | Tile edit form + audio upload |
| 6 | Alex dream image regeneration |
| 7 | Unlock graph checkbox matrix |
| 8 | Shared dreams moderation |
| 9 | Beta cap settings + signup enforcement |
| 10 | Vercel env var + deploy verification |
