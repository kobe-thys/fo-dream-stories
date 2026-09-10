# FO's Dream Stories — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full Next.js project with Supabase auth, family accounts, child profiles (up to 4 per family), child profile selection, and an empty map shell — everything a family needs to sign up and pick which child is exploring.

**Architecture:** Next.js 14 App Router with TypeScript and Tailwind CSS. Supabase handles authentication, PostgreSQL database, and file storage. All database access from server components uses the Supabase server client; client components use the browser client. Auth state is managed via Supabase session cookies.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (auth + postgres + storage), shadcn/ui, Jest, React Testing Library, Vercel (deployment target)

---

## Prerequisites (before starting)

The following accounts and keys must exist before running any code:

| What | Where | Notes |
|---|---|---|
| Supabase project | supabase.com | Free tier. Note: project URL and anon key. |
| OpenAI API key | platform.openai.com | Used later for Whisper, GPT-4o, DALL-E 3 |
| ElevenLabs account | elevenlabs.io | Used later for voice clone |
| Vercel account | vercel.com | Free tier. Connect to GitHub repo. |
| GitHub repo | github.com | Create empty repo: `fo-dream-stories` |

---

## File Structure

```
fo-dream-stories/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx          # Login page
│   │   └── signup/
│   │       └── page.tsx          # Signup page (email + password)
│   ├── (app)/
│   │   ├── layout.tsx            # App shell — requires auth, loads family/profile
│   │   ├── select-profile/
│   │   │   └── page.tsx          # Choose which child is exploring
│   │   ├── create-profile/
│   │   │   └── page.tsx          # Add a new child profile
│   │   └── map/
│   │       └── page.tsx          # Map shell (empty for now, filled in Plan 2)
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Root redirect (→ login or → select-profile)
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx         # Email/password login form
│   │   └── SignupForm.tsx        # Email/password signup form
│   ├── profile/
│   │   ├── ProfileCard.tsx       # Single child profile card (avatar + name)
│   │   └── ProfileGrid.tsx       # Grid of up to 4 profiles + add button
│   └── ui/                       # shadcn/ui components (auto-generated)
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client (singleton)
│   │   └── server.ts             # Server Supabase client (per-request)
│   └── types.ts                  # Shared TypeScript types (Family, ChildProfile, etc.)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Full DB schema for Plan 1
├── __tests__/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.test.tsx
│   │   │   └── SignupForm.test.tsx
│   │   └── profile/
│   │       ├── ProfileCard.test.tsx
│   │       └── ProfileGrid.test.tsx
│   └── lib/
│       └── types.test.ts
├── .env.local                    # Never committed — local secrets
├── .env.example                  # Committed — shows required env vars
├── jest.config.ts
├── jest.setup.ts
└── middleware.ts                 # Auth guard — redirects unauthenticated users
```

---

## Task 1: Initialise the project

**Files:**
- Create: `fo-dream-stories/` (entire project)
- Create: `.env.example`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Scaffold Next.js project**

```bash
npx create-next-app@latest fo-dream-stories \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias="@/*"
cd fo-dream-stories
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
# Choose: Default style, Slate base colour, CSS variables: yes
npx shadcn@latest add button input label card form
```

- [ ] **Step 4: Create jest.config.ts**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
}

export default createJestConfig(config)
```

- [ ] **Step 5: Create jest.setup.ts**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Create .env.example**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 7: Create .env.local with real values from Supabase dashboard**

(Copy .env.example, fill in real values. Never commit this file.)

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```
Expected: App running at http://localhost:3000, no errors.

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "feat: initialise Next.js project with Supabase and shadcn/ui"
git remote add origin https://github.com/YOUR_USERNAME/fo-dream-stories.git
git push -u origin main
```

---

## Task 2: Supabase clients and types

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/types.ts`
- Create: `__tests__/lib/types.test.ts`

- [ ] **Step 1: Create lib/supabase/client.ts**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create lib/supabase/server.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create lib/types.ts**

```typescript
export interface ChildProfile {
  id: string
  family_id: string
  name: string
  date_of_birth: string // ISO date string: "2018-04-12"
  avatar_color: string  // hex colour for avatar placeholder
  created_at: string
}

export interface Family {
  id: string
  email: string
  created_at: string
}

// Derived helper — never stored, always calculated
export function getAge(dateOfBirth: string): number {
  const today = new Date()
  const dob = new Date(dateOfBirth)
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--
  return age
}
```

- [ ] **Step 4: Write failing test for getAge**

```typescript
// __tests__/lib/types.test.ts
import { getAge } from '@/lib/types'

describe('getAge', () => {
  // Uses fixed dates to avoid month-overflow edge cases (e.g. December + 1 month = January next year)
  it('returns correct age when birthday has already passed this year', () => {
    // Born 2000-01-15 — if today is 2026-03-18, birthday has passed → age 26
    expect(getAge('2000-01-15')).toBe(26)
  })

  it('returns correct age when birthday has not yet occurred this year', () => {
    // Born 2000-12-25 — if today is 2026-03-18, birthday not yet → age 25
    expect(getAge('2000-12-25')).toBe(25)
  })
})
```

> **Note:** These tests use fixed DOB strings tied to the known current date (2026-03-18). If this plan is executed significantly later, update the expected ages accordingly.

- [ ] **Step 5: Run test to verify it fails**

```bash
npx jest __tests__/lib/types.test.ts -v
```
Expected: FAIL — "getAge is not a function" or similar.

- [ ] **Step 6: Run tests after adding getAge to types.ts**

```bash
npx jest __tests__/lib/types.test.ts -v
```
Expected: PASS — 2 tests passing.

- [ ] **Step 7: Commit**

```bash
git add lib/ __tests__/lib/
git commit -m "feat: add Supabase clients and shared types"
```

---

## Task 3: Database schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/001_initial_schema.sql

-- Families (one per household — maps to Supabase auth.users)
create table public.families (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.families enable row level security;
create policy "Families can only see their own record"
  on public.families for all
  using (auth.uid() = id);

-- Child profiles (up to 4 per family — cap enforced at application layer, not SQL)
create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  date_of_birth date not null,
  avatar_color text not null default '#7c3aed',
  created_at timestamptz not null default now()
);
alter table public.child_profiles enable row level security;
create policy "Families can manage their own child profiles"
  on public.child_profiles for all
  using (auth.uid() = family_id);

-- Auto-create family record when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.families (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 2: Apply migration via Supabase dashboard**

Go to Supabase Dashboard → SQL Editor → paste the migration → Run.
Expected: "Success. No rows returned."

- [ ] **Step 3: Verify tables exist in Supabase Table Editor**

Check: `families` and `child_profiles` tables exist with correct columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema for families and child profiles"
```

---

## Task 4: Auth middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
                      request.nextUrl.pathname.startsWith('/signup')

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/select-profile', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 2: Verify redirect works**

Visit http://localhost:3000 while not logged in.
Expected: Redirected to /login (404 for now — page doesn't exist yet, that's fine).

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware — redirect unauthenticated users to login"
```

---

## Task 5: Login and signup pages

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/signup/page.tsx`
- Create: `components/auth/LoginForm.tsx`
- Create: `components/auth/SignupForm.tsx`
- Create: `__tests__/components/auth/LoginForm.test.tsx`
- Create: `__tests__/components/auth/SignupForm.test.tsx`

- [ ] **Step 1: Write failing test for LoginForm**

```typescript
// __tests__/components/auth/LoginForm.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginForm from '@/components/auth/LoginForm'

describe('LoginForm', () => {
  it('renders email and password fields and a submit button', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  it('shows validation error when submitted empty', async () => {
    render(<LoginForm />)
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/auth/LoginForm.test.tsx -v
```
Expected: FAIL — "Cannot find module '@/components/auth/LoginForm'".

- [ ] **Step 3: Create components/auth/LoginForm.tsx**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email) { setError('Email is required'); return }
    if (!password) { setError('Password is required'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/select-profile')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email}
          onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password}
          onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Logging in...' : 'Log in'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/auth/LoginForm.test.tsx -v
```
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Create app/(auth)/login/page.tsx**

```typescript
import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white">FO's Dream Stories</h1>
        <p className="text-slate-400 mt-2">Welcome back, dreamer</p>
      </div>
      <LoginForm />
      <p className="mt-6 text-slate-400 text-sm">
        No account?{' '}
        <Link href="/signup" className="text-violet-400 hover:underline">Sign up</Link>
      </p>
    </main>
  )
}
```

- [ ] **Step 6: Write and implement SignupForm (same pattern as LoginForm)**

```typescript
// __tests__/components/auth/SignupForm.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignupForm from '@/components/auth/SignupForm'

describe('SignupForm', () => {
  it('renders email, password, and confirm password fields', () => {
    render(<SignupForm />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    render(<SignupForm />)
    await userEvent.type(screen.getByLabelText('Password'), 'abc123')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'xyz999')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
  })
})
```

```typescript
// components/auth/SignupForm.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email) { setError('Email is required'); return }
    if (!password) { setError('Password is required'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/select-profile')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email}
          onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password}
          onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" type="password" value={confirm}
          onChange={e => setConfirm(e.target.value)} placeholder="••••••••" />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  )
}
```

```typescript
// app/(auth)/signup/page.tsx
import SignupForm from '@/components/auth/SignupForm'
import Link from 'next/link'

export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white">FO's Dream Stories</h1>
        <p className="text-slate-400 mt-2">Create your family account</p>
      </div>
      <SignupForm />
      <p className="mt-6 text-slate-400 text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-violet-400 hover:underline">Log in</Link>
      </p>
    </main>
  )
}
```

- [ ] **Step 7: Run all auth tests**

```bash
npx jest __tests__/components/auth/ -v
```
Expected: PASS — 4 tests passing.

- [ ] **Step 8: Commit**

```bash
git add app/(auth)/ components/auth/ __tests__/components/auth/
git commit -m "feat: add login and signup pages with form validation"
```

---

## Task 6: Child profile components

**Files:**
- Create: `components/profile/ProfileCard.tsx`
- Create: `components/profile/ProfileGrid.tsx`
- Create: `__tests__/components/profile/ProfileCard.test.tsx`
- Create: `__tests__/components/profile/ProfileGrid.test.tsx`

- [ ] **Step 1: Write failing tests for ProfileCard**

```typescript
// __tests__/components/profile/ProfileCard.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileCard from '@/components/profile/ProfileCard'

const profile = {
  id: '1', family_id: 'f1', name: 'Emma',
  date_of_birth: '2017-03-01', avatar_color: '#7c3aed', created_at: ''
}

describe('ProfileCard', () => {
  it('renders child name', () => {
    render(<ProfileCard profile={profile} onClick={() => {}} />)
    expect(screen.getByText('Emma')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn()
    render(<ProfileCard profile={profile} onClick={onClick} />)
    await userEvent.click(screen.getByText('Emma'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/profile/ProfileCard.test.tsx -v
```
Expected: FAIL.

- [ ] **Step 3: Create components/profile/ProfileCard.tsx**

```typescript
'use client'
import { ChildProfile, getAge } from '@/lib/types'

interface Props {
  profile: ChildProfile
  onClick: () => void
}

export default function ProfileCard({ profile, onClick }: Props) {
  const age = getAge(profile.date_of_birth)
  const initials = profile.name.slice(0, 2).toUpperCase()

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-slate-800 transition-colors w-32"
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
        style={{ backgroundColor: profile.avatar_color }}
      >
        {initials}
      </div>
      <span className="text-white font-medium text-sm">{profile.name}</span>
      <span className="text-slate-400 text-xs">Age {age}</span>
    </button>
  )
}
```

- [ ] **Step 4: Write failing tests for ProfileGrid**

```typescript
// __tests__/components/profile/ProfileGrid.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProfileGrid from '@/components/profile/ProfileGrid'

const profiles = [
  { id: '1', family_id: 'f1', name: 'Emma', date_of_birth: '2017-03-01', avatar_color: '#7c3aed', created_at: '' },
  { id: '2', family_id: 'f1', name: 'Lucas', date_of_birth: '2019-07-14', avatar_color: '#1d4ed8', created_at: '' },
]

describe('ProfileGrid', () => {
  it('renders all profiles', () => {
    render(<ProfileGrid profiles={profiles} onSelect={() => {}} onAdd={() => {}} />)
    expect(screen.getByText('Emma')).toBeInTheDocument()
    expect(screen.getByText('Lucas')).toBeInTheDocument()
  })

  it('shows add button when fewer than 4 profiles', () => {
    render(<ProfileGrid profiles={profiles} onSelect={() => {}} onAdd={() => {}} />)
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
  })

  it('hides add button when 4 profiles exist', () => {
    const fourProfiles = [...profiles,
      { id: '3', family_id: 'f1', name: 'Zara', date_of_birth: '2020-01-01', avatar_color: '#166534', created_at: '' },
      { id: '4', family_id: 'f1', name: 'Sam', date_of_birth: '2015-06-30', avatar_color: '#b45309', created_at: '' },
    ]
    render(<ProfileGrid profiles={fourProfiles} onSelect={() => {}} onAdd={() => {}} />)
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Create components/profile/ProfileGrid.tsx**

```typescript
'use client'
import { ChildProfile } from '@/lib/types'
import ProfileCard from './ProfileCard'

interface Props {
  profiles: ChildProfile[]
  onSelect: (profile: ChildProfile) => void
  onAdd: () => void
}

export default function ProfileGrid({ profiles, onSelect, onAdd }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {profiles.map(profile => (
        <ProfileCard key={profile.id} profile={profile} onClick={() => onSelect(profile)} />
      ))}
      {profiles.length < 4 && (
        <button
          onClick={onAdd}
          className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-slate-800 transition-colors w-32"
        >
          <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-400 text-3xl">
            +
          </div>
          <span className="text-slate-400 text-sm">Add dreamer</span>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Run all profile tests**

```bash
npx jest __tests__/components/profile/ -v
```
Expected: PASS — 5 tests passing.

- [ ] **Step 7: Commit**

```bash
git add components/profile/ __tests__/components/profile/
git commit -m "feat: add ProfileCard and ProfileGrid components"
```

---

## Task 7: Select profile page and create profile page

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/select-profile/page.tsx`
- Create: `app/(app)/create-profile/page.tsx`
- Create: `app/(app)/map/page.tsx`

- [ ] **Step 0: Confirm root app/layout.tsx exists**

`create-next-app` generates `app/layout.tsx` automatically. Verify it exists and contains at minimum:
```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```
Do not delete or overwrite this file — it is required for Next.js App Router to function.

- [ ] **Step 1: Create app/(app)/layout.tsx**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
```

- [ ] **Step 2: Create app/(app)/select-profile/page.tsx**

```typescript
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
    // Store selected profile in sessionStorage for this session
    sessionStorage.setItem('activeProfileId', profile.id)
    sessionStorage.setItem('activeProfileName', profile.name)
    router.push('/map')
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-400">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
      <h1 className="text-2xl font-bold text-white mb-2">Who's exploring tonight?</h1>
      <p className="text-slate-400 mb-10">Choose your dreamer</p>
      <ProfileGrid
        profiles={profiles}
        onSelect={handleSelect}
        onAdd={() => router.push('/create-profile')}
      />
    </main>
  )
}
```

- [ ] **Step 3: Create app/(app)/create-profile/page.tsx**

```typescript
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
    // Enforce 4-profile cap at application layer (SQL CHECK constraints cannot use subqueries in PostgreSQL)
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
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
      <h1 className="text-2xl font-bold text-white mb-2">Add a dreamer</h1>
      <p className="text-slate-400 mb-8">Tell us about your child</p>
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

- [ ] **Step 4: Create map shell — app/(app)/map/page.tsx**

```typescript
'use client'
import { useEffect, useState } from 'react'

export default function MapPage() {
  const [profileName, setProfileName] = useState('')

  useEffect(() => {
    const name = sessionStorage.getItem('activeProfileName') ?? 'Dreamer'
    setProfileName(name)
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
      <h1 className="text-white text-xl font-bold mb-2">
        {profileName}'s Dream World
      </h1>
      <p className="text-slate-400 text-sm">The map is coming soon...</p>
    </main>
  )
}
```

- [ ] **Step 5: Create root page redirect — app/page.tsx**

```typescript
import { redirect } from 'next/navigation'
export default function RootPage() {
  redirect('/select-profile')
}
```

- [ ] **Step 6: Manual smoke test**

```
1. Visit http://localhost:3000 — should redirect to /login
2. Sign up with a test email + password
3. Should redirect to /select-profile — should show empty grid + "Add dreamer" button
4. Click "Add dreamer" — fill in name + DOB + colour — submit
5. Should return to /select-profile showing the new profile
6. Click the profile — should land on /map showing "[Name]'s Dream World"
7. Try adding a 5th profile (create 4 first) — Add button should disappear
```

- [ ] **Step 7: Run all tests**

```bash
npx jest -v
```
Expected: PASS — all tests passing.

- [ ] **Step 8: Commit**

```bash
git add app/ components/ __tests__/
git commit -m "feat: add select-profile, create-profile, and map shell pages"
```

---

## Task 8: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Connect to Vercel**

1. Go to vercel.com → New Project → Import from GitHub → select `fo-dream-stories`
2. Framework preset: Next.js (auto-detected)
3. Add environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

- [ ] **Step 3: Verify live deployment**

Visit the Vercel URL. Repeat the manual smoke test from Task 7 Step 6 on the live URL.

- [ ] **Step 4: Commit any fixes needed**

If the live deployment has issues, fix and push — Vercel auto-deploys on every push to main.

---

## Plan 1 Complete

At the end of this plan you have:
- A live Next.js web app deployed on Vercel
- Supabase auth (email/password signup + login)
- Family accounts auto-created on signup
- Up to 4 child profiles per family, with name, DOB, avatar colour
- Profile selection landing page
- Empty map shell with the active child's name
- Full test coverage for all components and utilities

**Known limitation:** The active child profile is stored in `sessionStorage`, which is cleared when the browser tab is closed. If a user opens the app in a new tab, `activeProfileId` will be absent and the map will show "Dreamer" as the name. This is acceptable for Plan 1. Plan 2 will replace this with a URL-based or cookie-based approach so the profile persists properly.

**Next:** Plan 2 — The Map (hex grid, tile states, fog of war, unlock logic)
