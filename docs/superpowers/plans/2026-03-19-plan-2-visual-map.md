# FO's Dream Stories — Plan 2: Visual Redesign, FO Mascot & Hexagonal Map

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark slate placeholder UI with a warm storybook visual theme, introduce the Friendly Onion (FO) mascot on all key screens, and render a working hexagonal tile map with real tile states per child profile.

**Architecture:** Global CSS variables updated to a warm forest-night palette (already using `dark` class on `<html>`). FOMascot is a fixed-position floating React component accepting a `message` prop. The hex grid uses axial coordinates (q, r) with pixel positions derived from a pure math utility (`lib/hex.ts`). Tiles and child tile states are fetched from Supabase on map load; if a child has no states yet (first visit), they are initialised in a single upsert. The map renders as a CSS `position: relative` container with absolutely-positioned hex tiles. Completed tiles get a golden glow via CSS `filter: drop-shadow` — regular CSS `border` is clipped by `clip-path` and would be invisible.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + RLS), shadcn/ui (@base-ui/react), next/image, Jest + React Testing Library, Vercel

---

## Scene Setting

The app is a Next.js 16 project at `/root/fo-dream-stories/`. All page routes live under `app/`. Shared components live under `components/`. Utility functions live under `lib/`. Tests live under `__tests__/`. The Supabase browser client is at `lib/supabase/client.ts`; the server client at `lib/supabase/server.ts`.

The `dark` class is applied to `<html>` in `app/layout.tsx`, so `.dark {}` CSS variables are active globally. Pages currently hardcode `bg-slate-950` — this plan replaces all such hardcoded colours with semantic theme tokens.

FO's character image (the base reading pose) exists at `/root/FOs_dream_stories/image_d5fe9915.png` and must be copied to the Next.js `public/` folder.

The Supabase project already has `families` and `child_profiles` tables with RLS. This plan adds `tiles`, `tile_unlocks`, and `child_tile_states` tables. After running the migration SQL, the implementer must also run the seed SQL to populate the initial tile layout.

**Terrain tile tap** (showing sensory moment text) is deferred to Plan 3 — the story experience plan. For now, tapping a terrain tile does nothing.

---

## File Structure

```
fo-dream-stories/
├── public/
│   └── fo-reading.png              NEW — FO character image (copied from uploads)
├── app/
│   ├── globals.css                 MODIFY — warm forest-night palette
│   ├── (auth)/
│   │   ├── login/page.tsx          MODIFY — warm theme + FO greeting
│   │   └── signup/page.tsx         MODIFY — warm theme + FO greeting
│   └── (app)/
│       ├── select-profile/page.tsx MODIFY — warm theme + FO greeting
│       ├── create-profile/page.tsx MODIFY — warm theme
│       └── map/page.tsx            REWRITE — full map implementation
├── components/
│   ├── fo/
│   │   └── FOMascot.tsx            NEW — floating FO character + speech bubble
│   └── map/
│       ├── HexTile.tsx             NEW — single hexagonal tile
│       └── HexGrid.tsx             NEW — full hex map, positions tiles
├── lib/
│   ├── hex.ts                      NEW — axial coordinate math
│   └── types.ts                    MODIFY — add Tile, TileState, MappedTile types
├── supabase/
│   ├── migrations/
│   │   └── 002_map_schema.sql      NEW — tiles, tile_unlocks, child_tile_states
│   └── seeds/
│       └── 001_initial_tiles.sql   NEW — Mother Tree + first ring of tiles
└── __tests__/
    ├── lib/
    │   └── hex.test.ts             NEW — hex math unit tests (9 tests)
    └── components/
        ├── fo/
        │   └── FOMascot.test.tsx   NEW — FOMascot renders message + image (3 tests)
        ├── map/
        │   ├── HexTile.test.tsx    NEW — HexTile renders correctly per state (5 tests)
        │   └── HexGrid.test.tsx    NEW — HexGrid renders correct number of tiles (2 tests)
```

---

## Initial Tile Layout

The map uses axial coordinates (q, r). Pointy-top hexagons. Mother Tree is at (0, 0).

```
Ring 0 — always unlocked:
  (0,  0)  Mother Tree            [mother_tree]

Ring 1 — unlocked on first visit (distance = 1 from Mother Tree):
  (1,  0)  The Tinkle Trunk       [story]
  (0,  1)  Forest Path            [terrain, forest]
  (-1, 1)  The Upside-down Waterfall [story]
  (-1, 0)  Sunny Meadow           [terrain, land]
  (0, -1)  Raindrop Castle        [story]
  (1, -1)  Old Oak Trail          [terrain, forest]

Ring 2 — locked initially, unlocked by completing ring-1 stories:
  (2,  0)  The Syrup Tree         [story] ← unlocked by Tinkle Trunk
  (2, -1)  The Lighthouse         [story] ← unlocked by Tinkle Trunk
  (0,  2)  Dragon Mountains       [story] ← unlocked by Upside-down Waterfall
  (-2, 1)  Elven Forest           [story] ← unlocked by Upside-down Waterfall
  (-1,-1)  Sun Cave               [story] ← unlocked by Raindrop Castle
```

---

## Task 1: Warm Visual Palette + FO Asset + Restyle All Screens

**Files:**
- Modify: `app/globals.css`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/signup/page.tsx`
- Modify: `app/(app)/select-profile/page.tsx`
- Modify: `app/(app)/create-profile/page.tsx`
- Create: `public/fo-reading.png` (file copy)

- [ ] **Step 1: Copy FO image to public/**

```bash
cp /root/FOs_dream_stories/image_d5fe9915.png /root/fo-dream-stories/public/fo-reading.png
```

Verify: `ls /root/fo-dream-stories/public/fo-reading.png` — should print the path.

- [ ] **Step 2: Update global CSS palette**

Replace the entire content of `app/globals.css` with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

/* Light mode — warm parchment/garden */
:root {
  --background: oklch(0.97 0.02 85);
  --foreground: oklch(0.22 0.05 60);
  --card: oklch(0.95 0.02 85);
  --card-foreground: oklch(0.22 0.05 60);
  --popover: oklch(0.95 0.02 85);
  --popover-foreground: oklch(0.22 0.05 60);
  --primary: oklch(0.52 0.22 290);
  --primary-foreground: oklch(0.97 0 0);
  --secondary: oklch(0.90 0.03 85);
  --secondary-foreground: oklch(0.30 0.05 60);
  --muted: oklch(0.90 0.03 85);
  --muted-foreground: oklch(0.55 0.06 60);
  --accent: oklch(0.75 0.14 80);
  --accent-foreground: oklch(0.22 0.05 60);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.85 0.04 85);
  --input: oklch(0.88 0.03 85);
  --ring: oklch(0.52 0.22 290);
  --radius: 0.75rem;
  --chart-1: oklch(0.809 0.105 251.813);
  --chart-2: oklch(0.623 0.214 259.815);
  --chart-3: oklch(0.546 0.245 262.881);
  --chart-4: oklch(0.488 0.243 264.376);
  --chart-5: oklch(0.424 0.199 265.638);
  --sidebar: oklch(0.93 0.02 85);
  --sidebar-foreground: oklch(0.22 0.05 60);
  --sidebar-primary: oklch(0.52 0.22 290);
  --sidebar-primary-foreground: oklch(0.97 0 0);
  --sidebar-accent: oklch(0.90 0.03 85);
  --sidebar-accent-foreground: oklch(0.22 0.05 60);
  --sidebar-border: oklch(0.85 0.04 85);
  --sidebar-ring: oklch(0.52 0.22 290);
}

/* Dark mode — warm forest night (active globally via .dark on <html>) */
.dark {
  --background: oklch(0.17 0.04 145);
  --foreground: oklch(0.93 0.03 85);
  --card: oklch(0.21 0.04 140);
  --card-foreground: oklch(0.93 0.03 85);
  --popover: oklch(0.21 0.04 140);
  --popover-foreground: oklch(0.93 0.03 85);
  --primary: oklch(0.70 0.18 290);
  --primary-foreground: oklch(0.14 0.02 145);
  --secondary: oklch(0.26 0.05 140);
  --secondary-foreground: oklch(0.90 0.02 85);
  --muted: oklch(0.26 0.05 140);
  --muted-foreground: oklch(0.68 0.05 85);
  --accent: oklch(0.76 0.14 80);
  --accent-foreground: oklch(0.17 0.04 145);
  --destructive: oklch(0.65 0.20 25);
  --border: oklch(0.33 0.05 140);
  --input: oklch(0.27 0.04 140);
  --ring: oklch(0.70 0.18 290);
  --chart-1: oklch(0.809 0.105 251.813);
  --chart-2: oklch(0.623 0.214 259.815);
  --chart-3: oklch(0.546 0.245 262.881);
  --chart-4: oklch(0.488 0.243 264.376);
  --chart-5: oklch(0.424 0.199 265.638);
  --sidebar: oklch(0.21 0.04 140);
  --sidebar-foreground: oklch(0.93 0.03 85);
  --sidebar-primary: oklch(0.70 0.18 290);
  --sidebar-primary-foreground: oklch(0.14 0.02 145);
  --sidebar-accent: oklch(0.26 0.05 140);
  --sidebar-accent-foreground: oklch(0.90 0.02 85);
  --sidebar-border: oklch(0.33 0.05 140);
  --sidebar-ring: oklch(0.70 0.18 290);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 3: Replace login page (warm theme, no FO yet)**

Replace `app/(auth)/login/page.tsx`:

```tsx
import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">FO&apos;s Dream Stories</h1>
        <p className="text-muted-foreground mt-2">Welcome back, dreamer</p>
      </div>
      <LoginForm />
      <p className="mt-6 text-muted-foreground text-sm">
        No account?{' '}
        <Link href="/signup" className="text-primary hover:underline">Sign up</Link>
      </p>
    </main>
  )
}
```

- [ ] **Step 4: Replace signup page (warm theme, no FO yet)**

Replace `app/(auth)/signup/page.tsx`:

```tsx
import SignupForm from '@/components/auth/SignupForm'
import Link from 'next/link'

export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">FO&apos;s Dream Stories</h1>
        <p className="text-muted-foreground mt-2">Create your family account</p>
      </div>
      <SignupForm />
      <p className="mt-6 text-muted-foreground text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline">Log in</Link>
      </p>
    </main>
  )
}
```

- [ ] **Step 5: Replace select-profile page (warm theme, no FO yet)**

Replace `app/(app)/select-profile/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProfileGrid from '@/components/profile/ProfileGrid'
import { ChildProfile } from '@/lib/types'

export default function SelectProfilePage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<ChildProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('child_profiles')
        .select('*')
        .order('created_at', { ascending: true })
      setProfiles(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function handleSelect(profile: ChildProfile) {
    sessionStorage.setItem('activeProfileId', profile.id)
    sessionStorage.setItem('activeProfileName', profile.name)
    router.push('/map')
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <h1 className="text-2xl font-bold text-foreground mb-2">Who&apos;s exploring tonight?</h1>
      <p className="text-muted-foreground mb-10">Choose your dreamer</p>
      <ProfileGrid
        profiles={profiles}
        onSelect={handleSelect}
        onAdd={() => router.push('/create-profile')}
      />
    </main>
  )
}
```

- [ ] **Step 6: Replace create-profile page (warm theme)**

Replace `app/(app)/create-profile/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const AVATAR_COLORS = ['#7c3aed', '#1d4ed8', '#166534', '#b45309', '#be185d', '#0e7490']

export default function CreateProfilePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [color, setColor] = useState(AVATAR_COLORS[0])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Name is required'); return }
    if (!dob) { setError('Date of birth is required'); return }
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { count } = await supabase
      .from('child_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('family_id', user.id)
    if ((count ?? 0) >= 4) {
      setLoading(false)
      setError("You've reached the maximum of 4 child profiles.")
      return
    }
    const { error } = await supabase.from('child_profiles').insert({
      family_id: user.id, name: name.trim(), date_of_birth: dob, avatar_color: color
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/select-profile')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <h1 className="text-2xl font-bold text-foreground mb-2">Add a dreamer</h1>
      <p className="text-muted-foreground mb-8">Tell us about your child</p>
      <form onSubmit={handleSubmit} className="space-y-5 w-full max-w-sm">
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Emma" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dob">Date of birth</Label>
          <Input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Avatar colour</Label>
          <div className="flex gap-2">
            {AVATAR_COLORS.map(c => (
              <button
                key={c} type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving...' : 'Add dreamer'}
        </Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 7: Verify build passes**

```bash
cd /root/fo-dream-stories && npm run build
```

Expected: successful build, no TypeScript errors.

- [ ] **Step 8: Run tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: 11 tests passing (unchanged).

- [ ] **Step 9: Commit**

```bash
cd /root/fo-dream-stories
git add public/fo-reading.png app/globals.css app/(auth)/login/page.tsx app/(auth)/signup/page.tsx "app/(app)/select-profile/page.tsx" "app/(app)/create-profile/page.tsx"
git commit -m "feat: warm forest-night palette, FO asset, restyle all screens"
```

---

## Task 2: FOMascot Component

**Files:**
- Create: `components/fo/FOMascot.tsx`
- Create: `__tests__/components/fo/FOMascot.test.tsx`

The speech bubble uses intentional white/dark-text styling — it reads as a comic-style bubble regardless of the app theme, which is the desired design.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/fo/FOMascot.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import FOMascot from '@/components/fo/FOMascot'

describe('FOMascot', () => {
  it('renders the message text', () => {
    render(<FOMascot message="Hello, dreamer!" />)
    expect(screen.getByText('Hello, dreamer!')).toBeInTheDocument()
  })

  it('renders the FO image with correct alt text', () => {
    render(<FOMascot message="Hello!" />)
    expect(screen.getByAltText('Friendly Onion')).toBeInTheDocument()
  })

  it('renders nothing when message is empty', () => {
    const { container } = render(<FOMascot message="" />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPattern="FOMascot"
```

Expected: FAIL — "Cannot find module '@/components/fo/FOMascot'"

- [ ] **Step 3: Implement FOMascot**

Create `components/fo/FOMascot.tsx`:

```tsx
import Image from 'next/image'

interface FOMascotProps {
  message: string
}

export default function FOMascot({ message }: FOMascotProps) {
  if (!message) return null

  return (
    <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2 z-20 pointer-events-none">
      {/* Speech bubble — intentionally white comic-bubble style */}
      <div className="relative bg-white text-slate-800 rounded-2xl px-4 py-3 max-w-[200px] text-sm shadow-lg leading-snug">
        {message}
        {/* Tail pointing down toward FO */}
        <span
          className="absolute bottom-0 right-8 translate-y-full w-0 h-0"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid white',
          }}
        />
      </div>
      {/* FO image */}
      <Image
        src="/fo-reading.png"
        alt="Friendly Onion"
        width={96}
        height={96}
        className="object-contain drop-shadow-lg"
        priority
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPattern="FOMascot"
```

Expected: 3 tests passing.

- [ ] **Step 5: Add FO to login, signup, and select-profile pages**

Replace `app/(auth)/login/page.tsx` (complete file):

```tsx
import LoginForm from '@/components/auth/LoginForm'
import FOMascot from '@/components/fo/FOMascot'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">FO&apos;s Dream Stories</h1>
        <p className="text-muted-foreground mt-2">Welcome back, dreamer</p>
      </div>
      <LoginForm />
      <p className="mt-6 text-muted-foreground text-sm">
        No account?{' '}
        <Link href="/signup" className="text-primary hover:underline">Sign up</Link>
      </p>
      <FOMascot message="Hello! Ready to explore tonight?" />
    </main>
  )
}
```

Replace `app/(auth)/signup/page.tsx` (complete file):

```tsx
import SignupForm from '@/components/auth/SignupForm'
import FOMascot from '@/components/fo/FOMascot'
import Link from 'next/link'

export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">FO&apos;s Dream Stories</h1>
        <p className="text-muted-foreground mt-2">Create your family account</p>
      </div>
      <SignupForm />
      <p className="mt-6 text-muted-foreground text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline">Log in</Link>
      </p>
      <FOMascot message="I can't wait to read with you!" />
    </main>
  )
}
```

Replace `app/(app)/select-profile/page.tsx` (complete file):

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProfileGrid from '@/components/profile/ProfileGrid'
import FOMascot from '@/components/fo/FOMascot'
import { ChildProfile } from '@/lib/types'

export default function SelectProfilePage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<ChildProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('child_profiles')
        .select('*')
        .order('created_at', { ascending: true })
      setProfiles(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function handleSelect(profile: ChildProfile) {
    sessionStorage.setItem('activeProfileId', profile.id)
    sessionStorage.setItem('activeProfileName', profile.name)
    router.push('/map')
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <h1 className="text-2xl font-bold text-foreground mb-2">Who&apos;s exploring tonight?</h1>
      <p className="text-muted-foreground mb-10">Choose your dreamer</p>
      <ProfileGrid
        profiles={profiles}
        onSelect={handleSelect}
        onAdd={() => router.push('/create-profile')}
      />
      <FOMascot message="Which dreamer are we tonight?" />
    </main>
  )
}
```

- [ ] **Step 6: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: 14 tests passing (11 original + 3 FOMascot).

- [ ] **Step 7: Commit**

```bash
cd /root/fo-dream-stories
git add components/fo/FOMascot.tsx __tests__/components/fo/FOMascot.test.tsx app/(auth)/login/page.tsx app/(auth)/signup/page.tsx "app/(app)/select-profile/page.tsx"
git commit -m "feat: FOMascot floating character component with speech bubble"
```

---

## Task 3: Map Database Schema + Initial Seed

**Files:**
- Create: `supabase/migrations/002_map_schema.sql`
- Create: `supabase/seeds/001_initial_tiles.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/002_map_schema.sql`:

```sql
-- Tiles: the hex grid nodes (story tiles, terrain tiles, Mother Tree)
create table public.tiles (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('mother_tree', 'story', 'terrain')),
  name text not null,
  position_q integer not null,
  position_r integer not null,
  terrain_type text check (terrain_type in ('forest', 'land', 'water', 'mountain')),
  story_text text,
  audio_url text,
  alex_tip text,
  sensory_moment_text text,
  default_token_image_url text,
  created_at timestamptz not null default now(),
  unique (position_q, position_r)
);
alter table public.tiles enable row level security;
create policy "Tiles readable by authenticated users"
  on public.tiles for select
  using (auth.uid() is not null);

-- Tile unlocks: the directed graph of story progression
create table public.tile_unlocks (
  id uuid primary key default gen_random_uuid(),
  from_tile_id uuid not null references public.tiles(id) on delete cascade,
  to_tile_id uuid not null references public.tiles(id) on delete cascade,
  unique (from_tile_id, to_tile_id)
);
alter table public.tile_unlocks enable row level security;
create policy "Tile unlocks readable by authenticated users"
  on public.tile_unlocks for select
  using (auth.uid() is not null);

-- Child tile states: per-child progress on every tile
create table public.child_tile_states (
  id uuid primary key default gen_random_uuid(),
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  tile_id uuid not null references public.tiles(id) on delete cascade,
  state text not null check (state in ('locked', 'unlocked', 'listened', 'completed')),
  listened_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (child_profile_id, tile_id)
);
alter table public.child_tile_states enable row level security;
create policy "Families can manage their children tile states"
  on public.child_tile_states for all
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

-- Grants (Supabase does not auto-grant for tables created via SQL editor)
grant select on public.tiles to authenticated;
grant select on public.tile_unlocks to authenticated;
grant all on public.child_tile_states to authenticated;
```

- [ ] **Step 2: Create the seed file**

Create `supabase/seeds/001_initial_tiles.sql`:

```sql
-- Initial tile layout: Mother Tree at centre, ring-1 tiles, ring-2 story tiles
-- Fixed UUIDs so tile_unlocks can reference them explicitly

insert into public.tiles (id, type, name, position_q, position_r, terrain_type, alex_tip, sensory_moment_text)
values
  -- Ring 0
  ('00000000-0000-0000-0000-000000000001',
   'mother_tree', 'Mother Tree', 0, 0, null,
   'The Mother Tree is so tall it touches the clouds! I found a secret door in the trunk that led to a tiny library with glowing books. Each one told a story from a different dreamer.',
   null),

  -- Ring 1: story tiles
  ('00000000-0000-0000-0000-000000000002',
   'story', 'The Tinkle Trunk', 1, 0, null, null, null),

  ('00000000-0000-0000-0000-000000000004',
   'story', 'The Upside-down Waterfall', -1, 1, null, null, null),

  ('00000000-0000-0000-0000-000000000006',
   'story', 'Raindrop Castle', 0, -1, null, null, null),

  -- Ring 1: terrain tiles
  ('00000000-0000-0000-0000-000000000003',
   'terrain', 'Forest Path', 0, 1, 'forest', null,
   'You feel the soft earth beneath your feet. The smell of pine fills the air. Somewhere nearby, a bird calls twice and then goes quiet.'),

  ('00000000-0000-0000-0000-000000000005',
   'terrain', 'Sunny Meadow', -1, 0, 'land', null,
   'Warm sun on your face. The grass is soft and springy. You can hear bees humming somewhere close, lazy and happy.'),

  ('00000000-0000-0000-0000-000000000007',
   'terrain', 'Old Oak Trail', 1, -1, 'forest', null,
   'Ancient roots arch over the path like a doorway. The air is still here — not cold, just waiting. Old leaves crunch softly under each step.'),

  -- Ring 2: story tiles (locked initially)
  ('00000000-0000-0000-0000-000000000008',
   'story', 'The Syrup Tree', 2, 0, null, null, null),

  ('00000000-0000-0000-0000-000000000009',
   'story', 'Dragon Mountains', 0, 2, null, null, null),

  ('00000000-0000-0000-0000-000000000010',
   'story', 'Elven Forest', -2, 1, null, null, null),

  ('00000000-0000-0000-0000-000000000011',
   'story', 'Sun Cave', -1, -1, null, null, null),

  ('00000000-0000-0000-0000-000000000012',
   'story', 'The Lighthouse', 2, -1, null, null, null);

-- Unlock graph
insert into public.tile_unlocks (from_tile_id, to_tile_id)
values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000008'), -- Tinkle Trunk → Syrup Tree
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012'), -- Tinkle Trunk → Lighthouse
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000009'), -- Upside-down Waterfall → Dragon Mountains
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000010'), -- Upside-down Waterfall → Elven Forest
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000011'); -- Raindrop Castle → Sun Cave
```

- [ ] **Step 3: Run the migration in Supabase SQL Editor**

Go to **Supabase → SQL Editor**. Paste and run `002_map_schema.sql`. Expected: no errors, 3 new tables visible in Table Editor.

- [ ] **Step 4: Run the seed in Supabase SQL Editor**

Paste and run `001_initial_tiles.sql`. Expected: no errors. Check `tiles` table — 12 rows. Check `tile_unlocks` — 5 rows.

- [ ] **Step 5: Commit**

```bash
cd /root/fo-dream-stories
git add supabase/migrations/002_map_schema.sql supabase/seeds/001_initial_tiles.sql
git commit -m "feat: map schema (tiles, tile_unlocks, child_tile_states) + initial seed"
```

---

## Task 4: Hex Math Utilities + Map Types

**Files:**
- Create: `lib/hex.ts`
- Modify: `lib/types.ts`
- Create: `__tests__/lib/hex.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/hex.test.ts`:

```typescript
import { HEX_SIZE, axialToPixel, hexDistance, getNeighborCoords } from '@/lib/hex'

describe('axialToPixel', () => {
  it('returns (0, 0) for origin tile', () => {
    const { x, y } = axialToPixel(0, 0)
    expect(x).toBe(0)
    expect(y).toBe(0)
  })

  it('returns correct x for (1, 0) — one step right', () => {
    const { x } = axialToPixel(1, 0)
    expect(x).toBeCloseTo(HEX_SIZE * Math.sqrt(3))
  })

  it('returns 0 y for (1, 0) — same row', () => {
    const { y } = axialToPixel(1, 0)
    expect(y).toBe(0)
  })

  it('returns correct y for (0, 1) — one row down', () => {
    const { y } = axialToPixel(0, 1)
    expect(y).toBeCloseTo(HEX_SIZE * 1.5)
  })
})

describe('hexDistance', () => {
  it('returns 0 for the same tile', () => {
    expect(hexDistance(0, 0, 0, 0)).toBe(0)
  })

  it('returns 1 for each of the 6 direct neighbours', () => {
    expect(hexDistance(0, 0, 1, 0)).toBe(1)
    expect(hexDistance(0, 0, -1, 0)).toBe(1)
    expect(hexDistance(0, 0, 0, 1)).toBe(1)
    expect(hexDistance(0, 0, 0, -1)).toBe(1)
    expect(hexDistance(0, 0, 1, -1)).toBe(1)
    expect(hexDistance(0, 0, -1, 1)).toBe(1)
  })

  it('returns 2 for two steps away', () => {
    expect(hexDistance(0, 0, 2, 0)).toBe(2)
  })
})

describe('getNeighborCoords', () => {
  it('returns exactly 6 neighbours', () => {
    expect(getNeighborCoords(0, 0)).toHaveLength(6)
  })

  it('includes all 6 expected neighbour coordinates for origin', () => {
    const neighbours = getNeighborCoords(0, 0)
    expect(neighbours).toContainEqual({ q: 1, r: 0 })
    expect(neighbours).toContainEqual({ q: -1, r: 0 })
    expect(neighbours).toContainEqual({ q: 0, r: 1 })
    expect(neighbours).toContainEqual({ q: 0, r: -1 })
    expect(neighbours).toContainEqual({ q: 1, r: -1 })
    expect(neighbours).toContainEqual({ q: -1, r: 1 })
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPattern="hex.test"
```

Expected: FAIL — "Cannot find module '@/lib/hex'"

- [ ] **Step 3: Implement hex math**

Create `lib/hex.ts`:

```typescript
// Pointy-top hexagon grid using axial coordinates (q, r).
// HEX_SIZE is the circumradius (centre to corner) in pixels.
export const HEX_SIZE = 44

// Pixel dimensions of a pointy-top hex:
//   width  = sqrt(3) * HEX_SIZE
//   height = 2 * HEX_SIZE
export const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE
export const HEX_HEIGHT = 2 * HEX_SIZE

// Convert axial (q, r) to pixel (x, y). Origin tile maps to (0, 0).
// Caller adds a viewport offset to centre the grid.
export function axialToPixel(q: number, r: number): { x: number; y: number } {
  const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r)
  const y = HEX_SIZE * (1.5 * r)
  return { x, y }
}

// Manhattan distance between two axial hex positions.
export function hexDistance(q1: number, r1: number, q2: number, r2: number): number {
  const dq = q1 - q2
  const dr = r1 - r2
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

// The 6 axial direction vectors for neighbours of a pointy-top hex.
const NEIGHBOUR_DIRECTIONS = [
  { q: 1, r: 0 }, { q: -1, r: 0 },
  { q: 0, r: 1 }, { q: 0, r: -1 },
  { q: 1, r: -1 }, { q: -1, r: 1 },
]

// Returns the 6 neighbour coordinates of a given hex.
export function getNeighborCoords(q: number, r: number): { q: number; r: number }[] {
  return NEIGHBOUR_DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }))
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPattern="hex.test"
```

Expected: 9 tests passing.

- [ ] **Step 5: Add map types to lib/types.ts**

Append to the bottom of `lib/types.ts`:

```typescript
// ── Map types ──────────────────────────────────────────────────────────────

export type TileType = 'mother_tree' | 'story' | 'terrain'
export type TerrainType = 'forest' | 'land' | 'water' | 'mountain'
export type TileState = 'locked' | 'unlocked' | 'listened' | 'completed'

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

// Tile enriched with the child's current state — used by HexGrid and HexTile
export interface MappedTile extends Tile {
  childState: TileState
}
```

- [ ] **Step 6: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: all tests pass (23 total: 14 from Tasks 1–2 + 9 new hex tests).

- [ ] **Step 7: Commit**

```bash
cd /root/fo-dream-stories
git add lib/hex.ts lib/types.ts __tests__/lib/hex.test.ts
git commit -m "feat: hex math utilities and map TypeScript types"
```

---

## Task 5: HexTile Component

**Files:**
- Create: `components/map/HexTile.tsx`
- Create: `__tests__/components/map/HexTile.test.tsx`

**Note on borders:** CSS `border` is clipped by `clip-path` and disappears at hex corners. To show a "completed" gold indicator, this plan uses `filter: drop-shadow` which renders outside the clip region and correctly traces the hex shape.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/map/HexTile.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import HexTile from '@/components/map/HexTile'
import { MappedTile } from '@/lib/types'

const baseTile: MappedTile = {
  id: 'tile-1',
  type: 'story',
  name: 'The Tinkle Trunk',
  position_q: 1,
  position_r: 0,
  terrain_type: null,
  story_text: null,
  audio_url: null,
  alex_tip: null,
  sensory_moment_text: null,
  default_token_image_url: null,
  created_at: '2026-01-01T00:00:00Z',
  childState: 'unlocked',
}

describe('HexTile', () => {
  it('renders tile name for unlocked story tiles', () => {
    render(<HexTile tile={baseTile} x={0} y={0} />)
    expect(screen.getByText('The Tinkle Trunk')).toBeInTheDocument()
  })

  it('renders tile name for locked story tiles', () => {
    render(<HexTile tile={{ ...baseTile, childState: 'locked' }} x={0} y={0} />)
    expect(screen.getByText('The Tinkle Trunk')).toBeInTheDocument()
  })

  it('does not render name for locked terrain tiles', () => {
    const terrainTile: MappedTile = {
      ...baseTile,
      type: 'terrain',
      name: 'Forest Path',
      terrain_type: 'forest',
      childState: 'locked',
    }
    render(<HexTile tile={terrainTile} x={0} y={0} />)
    expect(screen.queryByText('Forest Path')).not.toBeInTheDocument()
  })

  it('renders Mother Tree with its own data-type attribute', () => {
    const motherTree: MappedTile = {
      ...baseTile,
      type: 'mother_tree',
      name: 'Mother Tree',
      childState: 'unlocked',
    }
    const { container } = render(<HexTile tile={motherTree} x={0} y={0} />)
    expect(container.querySelector('[data-type="mother_tree"]')).toBeInTheDocument()
  })

  it('calls onClick when an unlocked tile is clicked', () => {
    const onClick = jest.fn()
    render(<HexTile tile={baseTile} x={0} y={0} onClick={onClick} />)
    const hexEl = screen.getByText('The Tinkle Trunk').closest('[data-type]')!
    fireEvent.click(hexEl)
    expect(onClick).toHaveBeenCalledWith(baseTile)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPattern="HexTile"
```

Expected: FAIL — "Cannot find module '@/components/map/HexTile'"

- [ ] **Step 3: Implement HexTile**

Create `components/map/HexTile.tsx`:

```tsx
import { MappedTile } from '@/lib/types'
import { HEX_WIDTH, HEX_HEIGHT } from '@/lib/hex'

interface HexTileProps {
  tile: MappedTile
  x: number           // pixel x offset from grid centre
  y: number           // pixel y offset from grid centre
  onClick?: (tile: MappedTile) => void
}

// Pointy-top hexagon clip path (percentage-based, works at any size)
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

function tileBackground(tile: MappedTile): string {
  if (tile.type === 'mother_tree') return '#7c3aed'
  if (tile.type === 'terrain') {
    if (tile.childState === 'locked') return '#374151'
    switch (tile.terrain_type) {
      case 'forest':   return '#166534'
      case 'land':     return '#78716c'
      case 'water':    return '#1e40af'
      case 'mountain': return '#6b7280'
      default:         return '#4b5563'
    }
  }
  // story tile
  switch (tile.childState) {
    case 'unlocked':
    case 'listened':
    case 'completed': return '#1e40af'
    case 'locked':    return '#374151'
    default:          return '#374151'
  }
}

// CSS filter: drop-shadow traces the clipped hex shape, unlike border which is clipped away
function tileFilter(tile: MappedTile): string {
  if (tile.childState === 'completed') return 'drop-shadow(0 0 6px #d97706)'
  if (tile.type === 'mother_tree') return 'drop-shadow(0 0 6px #a78bfa)'
  return 'none'
}

function showName(tile: MappedTile): boolean {
  // Locked terrain tiles show nothing — they look like fog
  return !(tile.type === 'terrain' && tile.childState === 'locked')
}

function isClickable(tile: MappedTile): boolean {
  return tile.type === 'mother_tree' || tile.childState !== 'locked'
}

export default function HexTile({ tile, x, y, onClick }: HexTileProps) {
  return (
    <div
      data-type={tile.type}
      data-state={tile.childState}
      onClick={() => isClickable(tile) && onClick?.(tile)}
      style={{
        position: 'absolute',
        left: x - HEX_WIDTH / 2,
        top: y - HEX_HEIGHT / 2,
        width: HEX_WIDTH,
        height: HEX_HEIGHT,
        clipPath: HEX_CLIP,
        backgroundColor: tileBackground(tile),
        filter: tileFilter(tile),
        cursor: isClickable(tile) ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'filter 0.2s',
      }}
    >
      {showName(tile) && (
        <span
          style={{
            color: 'white',
            fontSize: 9,
            fontWeight: 600,
            textAlign: 'center',
            padding: '0 6px',
            lineHeight: 1.2,
            pointerEvents: 'none',
            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}
        >
          {tile.name}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPattern="HexTile"
```

Expected: 5 tests passing.

- [ ] **Step 5: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: 28 tests passing (23 + 5 new HexTile tests).

- [ ] **Step 6: Commit**

```bash
cd /root/fo-dream-stories
git add components/map/HexTile.tsx __tests__/components/map/HexTile.test.tsx
git commit -m "feat: HexTile component with per-state colours and gold glow for completed"
```

---

## Task 6: HexGrid Component

**Files:**
- Create: `components/map/HexGrid.tsx`
- Create: `__tests__/components/map/HexGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/map/HexGrid.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import HexGrid from '@/components/map/HexGrid'
import { MappedTile } from '@/lib/types'

function makeTile(id: string, q: number, r: number, state: MappedTile['childState'] = 'unlocked'): MappedTile {
  return {
    id,
    type: 'story',
    name: `Tile ${id}`,
    position_q: q,
    position_r: r,
    terrain_type: null,
    story_text: null,
    audio_url: null,
    alex_tip: null,
    sensory_moment_text: null,
    default_token_image_url: null,
    created_at: '2026-01-01T00:00:00Z',
    childState: state,
  }
}

describe('HexGrid', () => {
  it('renders a tile for each entry in the tiles array', () => {
    const tiles = [makeTile('1', 0, 0), makeTile('2', 1, 0), makeTile('3', -1, 0)]
    render(<HexGrid tiles={tiles} />)
    expect(screen.getAllByText(/^Tile /)).toHaveLength(3)
  })

  it('calls onTileClick with the correct tile when a tile is clicked', () => {
    const onClick = jest.fn()
    const tiles = [makeTile('1', 0, 0)]
    render(<HexGrid tiles={tiles} onTileClick={onClick} />)
    fireEvent.click(screen.getByText('Tile 1'))
    expect(onClick).toHaveBeenCalledWith(tiles[0])
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPattern="HexGrid"
```

Expected: FAIL — "Cannot find module '@/components/map/HexGrid'"

- [ ] **Step 3: Implement HexGrid**

Create `components/map/HexGrid.tsx`:

```tsx
'use client'
import { MappedTile } from '@/lib/types'
import { axialToPixel } from '@/lib/hex'
import HexTile from './HexTile'

interface HexGridProps {
  tiles: MappedTile[]
  onTileClick?: (tile: MappedTile) => void
}

// Container is 600×600px; Mother Tree (0,0) pixel coords map to the centre
const GRID_SIZE = 600
const CENTRE = GRID_SIZE / 2

export default function HexGrid({ tiles, onTileClick }: HexGridProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: GRID_SIZE,
        height: GRID_SIZE,
        maxWidth: '100vw',
        overflow: 'hidden',
      }}
    >
      {tiles.map(tile => {
        const { x, y } = axialToPixel(tile.position_q, tile.position_r)
        return (
          <HexTile
            key={tile.id}
            tile={tile}
            x={CENTRE + x}
            y={CENTRE + y}
            onClick={onTileClick}
          />
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /root/fo-dream-stories && npm test -- --testPathPattern="HexGrid"
```

Expected: 2 tests passing.

- [ ] **Step 5: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: 30 tests passing (28 + 2 new HexGrid tests).

- [ ] **Step 6: Commit**

```bash
cd /root/fo-dream-stories
git add components/map/HexGrid.tsx __tests__/components/map/HexGrid.test.tsx
git commit -m "feat: HexGrid component — positions tiles using axial-to-pixel conversion"
```

---

## Task 7: Map Page — Full Implementation

**Files:**
- Rewrite: `app/(app)/map/page.tsx`
- Modify: `jest.setup.ts`

- [ ] **Step 1: Update the Supabase mock in jest.setup.ts**

The map page uses `upsert` and chains `.eq()` in a way that must resolve to a value. Replace `jest.setup.ts`:

```typescript
import '@testing-library/jest-dom'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
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
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
}))
```

- [ ] **Step 2: Run existing tests — expect still PASS**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: 21 tests still passing.

- [ ] **Step 3: Rewrite the map page**

Replace `app/(app)/map/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tile, ChildTileState, MappedTile, TileState } from '@/lib/types'
import { hexDistance } from '@/lib/hex'
import HexGrid from '@/components/map/HexGrid'
import FOMascot from '@/components/fo/FOMascot'

function getInitialState(tile: Tile, allTiles: Tile[]): TileState {
  if (tile.type === 'mother_tree') return 'unlocked'
  const motherTree = allTiles.find(t => t.type === 'mother_tree')
  if (motherTree) {
    const dist = hexDistance(
      tile.position_q, tile.position_r,
      motherTree.position_q, motherTree.position_r
    )
    if (dist === 1) return 'unlocked'
  }
  return 'locked'
}

export default function MapPage() {
  const router = useRouter()
  const [profileName, setProfileName] = useState('Dreamer')
  const [tiles, setTiles] = useState<MappedTile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const name = sessionStorage.getItem('activeProfileName') ?? 'Dreamer'
    const childId = sessionStorage.getItem('activeProfileId')
    setProfileName(name)

    if (!childId) {
      router.push('/select-profile')
      return
    }

    async function loadMap() {
      const supabase = createClient()

      // Fetch all tiles
      const { data: tileRows, error: tilesError } = await supabase
        .from('tiles')
        .select('*')
        .order('created_at', { ascending: true })

      if (tilesError || !tileRows) {
        setError('Could not load the map. Please try again.')
        setLoading(false)
        return
      }

      const allTiles = tileRows as Tile[]

      // Fetch this child's tile states
      const { data: stateRows } = await supabase
        .from('child_tile_states')
        .select('*')
        .eq('child_profile_id', childId)

      let stateMap: Record<string, TileState> = {}

      if (!stateRows || stateRows.length === 0) {
        // First visit — initialise states for all tiles
        const initialStates = allTiles.map(tile => ({
          child_profile_id: childId,
          tile_id: tile.id,
          state: getInitialState(tile, allTiles),
        }))
        await supabase.from('child_tile_states').upsert(initialStates, {
          onConflict: 'child_profile_id,tile_id',
        })
        initialStates.forEach(s => { stateMap[s.tile_id] = s.state })
      } else {
        ;(stateRows as ChildTileState[]).forEach(s => { stateMap[s.tile_id] = s.state })
      }

      const mappedTiles: MappedTile[] = allTiles.map(tile => ({
        ...tile,
        childState: stateMap[tile.id] ?? 'locked',
      }))

      setTiles(mappedTiles)
      setLoading(false)
    }

    loadMap()
  }, [router])

  function handleTileClick(tile: MappedTile) {
    // Terrain tiles: sensory moment experience — deferred to Plan 3
    if (tile.type === 'terrain') return
    // Story tiles: full story experience — deferred to Plan 3
    console.log('Story tile tapped:', tile.name)
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading your dream world...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <p className="text-red-400 text-center">{error}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center bg-background pt-8 px-4">
      <h1 className="text-xl font-bold text-foreground mb-1">
        {profileName}&apos;s Dream World
      </h1>
      <p className="text-muted-foreground text-sm mb-6">Tap a tile to begin an adventure</p>
      <div className="w-full flex justify-center overflow-auto">
        <HexGrid tiles={tiles} onTileClick={handleTileClick} />
      </div>
      <FOMascot message={`Welcome, ${profileName}! Where shall we go?`} />
    </main>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
cd /root/fo-dream-stories && npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 5: Run all tests**

```bash
cd /root/fo-dream-stories && npm test
```

Expected: 30 tests passing (no new tests in this task).

- [ ] **Step 6: Commit**

```bash
cd /root/fo-dream-stories
git add "app/(app)/map/page.tsx" jest.setup.ts
git commit -m "feat: map page — loads tiles from Supabase, initialises child states, renders HexGrid with FO"
```

---

## Task 8: Deploy

- [ ] **Step 1: Push to GitHub**

```bash
cd /root/fo-dream-stories && git push
```

- [ ] **Step 2: Trigger Vercel deploy**

Vercel should auto-deploy. If not, go to Vercel dashboard → Deploy latest commit.

- [ ] **Step 3: Smoke test on device**

1. Open https://fo-dream-stories.vercel.app/login — FO visible bottom-right, warm forest-green background, white speech bubble
2. Log in → select profile (FO says "Which dreamer are we tonight?")
3. Map loads — Mother Tree at centre with purple glow, 6 adjacent tiles (3 story blue, 3 terrain green/brown), ring-2 tiles grey/locked
4. Tap an unlocked tile — nothing visible happens (story experience is Plan 3); check browser console for "Story tile tapped: The Tinkle Trunk"

- [ ] **Step 4: Verify FO image loads on all screens**

If `/fo-reading.png` is missing (404), check that it was committed: `git ls-files public/fo-reading.png` — should print the path.
