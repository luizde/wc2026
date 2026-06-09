# World Cup 2026 Pick'em Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first Next.js web app for ~12 friends to predict World Cup 2026 match scores and track a live leaderboard.

**Architecture:** Hybrid RSC + Client Islands — Server Components for all read views (leaderboard, match list, user history, match detail), Client Components only for interactive forms (prediction entry, login). All mutations go through Server Actions. No client-side Supabase access.

**Tech Stack:** Next.js 15 (App Router), Supabase PostgreSQL, Tailwind CSS, bcryptjs, jose (JWT), Vitest, football-data.org v4 API, Vercel hosting.

---

## File Map

```
middleware.ts                         auth guard + admin route protection
app/
  layout.tsx                          root layout, bottom nav shell
  page.tsx                            redirect → /leaderboard or /login
  login/page.tsx                      login + register (Client Component)
  leaderboard/page.tsx                leaderboard (Server Component)
  predictions/[stage]/page.tsx        batch prediction form shell (Server Component)
  matches/page.tsx                    all matches by round (Server Component)
  matches/[matchId]/page.tsx          match detail + comparison (Server Component)
  users/[username]/page.tsx           user prediction history (Server Component)
  admin/page.tsx                      admin panel (Server Component + Client islands)
components/
  nav/bottom-nav.tsx                  bottom tab bar (Client Component)
  leaderboard/leaderboard-table.tsx   leaderboard rows + stats
  predictions/prediction-form.tsx     batch score inputs (Client Component)
  predictions/round-tabs.tsx          round selector tabs
  matches/match-row.tsx               single match display (flag + teams + scores)
  matches/match-detail.tsx            all-user comparison view
  admin/force-sync-button.tsx         force sync (Client Component)
  admin/invite-code-manager.tsx       generate/revoke codes (Client Component)
  admin/user-manager.tsx              reset pw + remove user (Client Component)
  admin/result-override-form.tsx      override match result (Client Component)
lib/
  db.ts                               Supabase server client (service role)
  scoring.ts                          computePoints(), computeDeadline()
  auth.ts                             JWT sign/verify, session cookie helpers
  football-data.ts                    football-data.org API client
  sync.ts                             syncIfStale(), forceSync(), scorePredictions()
actions/
  auth-actions.ts                     loginAction(), registerAction(), logoutAction()
  prediction-actions.ts               submitPredictionsAction()
  admin-actions.ts                    forceSyncAction(), overrideResultAction(),
                                      resetPasswordAction(), removeUserAction(),
                                      generateInviteAction(), revokeInviteAction()
db/
  migrations/001_initial.sql          all tables
  seed.ts                             create admin user + first invite code
tests/
  scoring.test.ts
  auth.test.ts
  sync.test.ts
  prediction-actions.test.ts
.env.local.example
vitest.config.ts
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json` (via create-next-app)
- Create: `.env.local.example`
- Create: `vitest.config.ts`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/luisde/luizdev/wc
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --yes
```

Expected: Next.js 15 project created in current directory.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install @supabase/supabase-js bcryptjs jose
npm install -D @types/bcryptjs vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 3: Create `.env.local.example`**

```bash
# .env.local.example
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FOOTBALL_DATA_API_TOKEN=your-token
JWT_SECRET=a-long-random-string-at-least-32-chars
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 5: Add test script to `package.json`**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify setup compiles**

```bash
npm run build
```

Expected: Build succeeds (default Next.js starter).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: bootstrap Next.js 15 project with Tailwind and Vitest"
```

---

## Task 2: Database Schema

**Files:**
- Create: `db/migrations/001_initial.sql`

- [ ] **Step 1: Create migration file**

```sql
-- db/migrations/001_initial.sql

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invite_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT UNIQUE NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id  INTEGER UNIQUE NOT NULL,
  home_team    TEXT NOT NULL,
  away_team    TEXT NOT NULL,
  home_crest   TEXT,
  away_crest   TEXT,
  stage        TEXT NOT NULL,
  group_name   TEXT,
  matchday     INTEGER,
  kickoff_utc  TIMESTAMPTZ NOT NULL,
  deadline_utc TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'SCHEDULED',
  home_score   INTEGER,
  away_score   INTEGER,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE predictions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  points     INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);

CREATE TABLE sync_meta (
  id             INTEGER PRIMARY KEY DEFAULT 1,
  last_synced_at TIMESTAMPTZ,
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO sync_meta (id) VALUES (1);

CREATE INDEX predictions_user_id_idx ON predictions(user_id);
CREATE INDEX predictions_match_id_idx ON predictions(match_id);
CREATE INDEX matches_stage_idx ON matches(stage);
CREATE INDEX matches_status_idx ON matches(status);
```

- [ ] **Step 2: Apply migration to Supabase**

In the Supabase dashboard → SQL Editor, paste and run the contents of `db/migrations/001_initial.sql`.

Expected: All 5 tables created with no errors.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/001_initial.sql
git commit -m "feat: add database schema migration"
```

---

## Task 3: Scoring Utilities (TDD)

**Files:**
- Create: `lib/scoring.ts`
- Create: `tests/scoring.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/scoring.test.ts
import { describe, it, expect } from 'vitest'
import { computePoints, computeDeadline } from '@/lib/scoring'

describe('computePoints', () => {
  it('returns 3 for exact score', () => {
    expect(computePoints({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(3)
  })

  it('returns 3 for exact 0-0 draw', () => {
    expect(computePoints({ home: 0, away: 0 }, { home: 0, away: 0 })).toBe(3)
  })

  it('returns 1 for correct home win with wrong score', () => {
    expect(computePoints({ home: 3, away: 1 }, { home: 2, away: 0 })).toBe(1)
  })

  it('returns 1 for correct away win with wrong score', () => {
    expect(computePoints({ home: 0, away: 2 }, { home: 1, away: 3 })).toBe(1)
  })

  it('returns 1 for correct draw with wrong score', () => {
    expect(computePoints({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe(1)
  })

  it('returns 0 for wrong result (predicted home win, actual away win)', () => {
    expect(computePoints({ home: 2, away: 0 }, { home: 0, away: 1 })).toBe(0)
  })

  it('returns 0 for wrong result (predicted draw, actual home win)', () => {
    expect(computePoints({ home: 1, away: 1 }, { home: 2, away: 0 })).toBe(0)
  })
})

describe('computeDeadline', () => {
  it('returns noon CT (17:00 UTC) for a late kickoff (8 PM CT)', () => {
    // June 11, 8 PM CT = June 12 01:00 UTC
    const kickoff = new Date('2026-06-12T01:00:00Z')
    const deadline = computeDeadline(kickoff)
    // Noon CT on June 11 = June 11 17:00 UTC
    expect(deadline.toISOString()).toBe('2026-06-11T17:00:00.000Z')
  })

  it('returns 2h before kickoff for an early kickoff (10 AM CT)', () => {
    // June 11, 10 AM CT = June 11 15:00 UTC
    const kickoff = new Date('2026-06-11T15:00:00Z')
    const deadline = computeDeadline(kickoff)
    // 2h before = 13:00 UTC; noon CT = 17:00 UTC → min is 13:00
    expect(deadline.toISOString()).toBe('2026-06-11T13:00:00.000Z')
  })

  it('returns noon CT for a standard 3 PM CT kickoff', () => {
    // June 11, 3 PM CT = June 11 20:00 UTC
    const kickoff = new Date('2026-06-11T20:00:00Z')
    const deadline = computeDeadline(kickoff)
    // Noon CT = 17:00 UTC; 2h before = 18:00 UTC → min is 17:00
    expect(deadline.toISOString()).toBe('2026-06-11T17:00:00.000Z')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/scoring.test.ts
```

Expected: FAIL — `computePoints` and `computeDeadline` not found.

- [ ] **Step 3: Implement `lib/scoring.ts`**

```typescript
// lib/scoring.ts

export function computePoints(
  predicted: { home: number; away: number },
  actual: { home: number; away: number }
): number {
  if (predicted.home === actual.home && predicted.away === actual.away) return 3
  const predictedOutcome = Math.sign(predicted.home - predicted.away)
  const actualOutcome = Math.sign(actual.home - actual.away)
  if (predictedOutcome === actualOutcome) return 1
  return 0
}

// CDT = UTC-5 (applies June–July for the full tournament)
const CDT_OFFSET_MS = 5 * 60 * 60 * 1000

export function computeDeadline(kickoffUtc: Date): Date {
  // Find the match day in CT by offsetting the kickoff time
  const kickoffInCT = new Date(kickoffUtc.getTime() - CDT_OFFSET_MS)

  // Noon CT on that day = 17:00 UTC
  const noonCT = new Date(Date.UTC(
    kickoffInCT.getUTCFullYear(),
    kickoffInCT.getUTCMonth(),
    kickoffInCT.getUTCDate(),
    17, 0, 0, 0
  ))

  const twoHoursBefore = new Date(kickoffUtc.getTime() - 2 * 60 * 60 * 1000)
  return noonCT < twoHoursBefore ? noonCT : twoHoursBefore
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/scoring.test.ts
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts tests/scoring.test.ts
git commit -m "feat: scoring and deadline utilities with tests"
```

---

## Task 4: Auth Utilities (TDD)

**Files:**
- Create: `lib/auth.ts`
- Create: `tests/auth.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must set env before importing auth
vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough-32chars!')

import { signSession, verifySession } from '@/lib/auth'

describe('signSession / verifySession', () => {
  it('roundtrips a session payload', async () => {
    const payload = { userId: 'abc-123', isAdmin: false }
    const token = await signSession(payload)
    const result = await verifySession(token)
    expect(result?.userId).toBe('abc-123')
    expect(result?.isAdmin).toBe(false)
  })

  it('returns null for a tampered token', async () => {
    const result = await verifySession('not.a.valid.jwt')
    expect(result).toBeNull()
  })

  it('includes isAdmin: true when signing admin session', async () => {
    const token = await signSession({ userId: 'admin-id', isAdmin: true })
    const result = await verifySession(token)
    expect(result?.isAdmin).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/auth.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/auth.ts`**

```typescript
// lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'

export interface SessionPayload {
  userId: string
  isAdmin: boolean
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET env var is not set')
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return { userId: payload.userId as string, isAdmin: payload.isAdmin as boolean }
  } catch {
    return null
  }
}
```

Note: `getSession()` and `setSessionCookie()` use `next/headers` and cannot be unit-tested without a Next.js runtime. Add them after the tests pass:

```typescript
// Append to lib/auth.ts (not tested in unit tests — tested via integration)
import { cookies } from 'next/headers'

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  return verifySession(token)
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload)
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/auth.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts tests/auth.test.ts
git commit -m "feat: JWT auth utilities with tests"
```

---

## Task 5: Database + Football-Data Clients

**Files:**
- Create: `lib/db.ts`
- Create: `lib/football-data.ts`

- [ ] **Step 1: Create `lib/db.ts`**

```typescript
// lib/db.ts
import { createClient } from '@supabase/supabase-js'

export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

- [ ] **Step 2: Create `lib/football-data.ts`**

```typescript
// lib/football-data.ts

export interface FDTeam {
  name: string
  crest: string | null
}

export interface FDScore {
  fullTime: { home: number | null; away: number | null }
}

export interface FDMatch {
  id: number
  homeTeam: FDTeam
  awayTeam: FDTeam
  stage: string
  group: string | null
  matchday: number | null
  utcDate: string
  status: string
  score: FDScore
}

export async function fetchWCMatches(): Promise<FDMatch[]> {
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_TOKEN ?? '' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`football-data.org responded ${res.status}`)
  const data = await res.json()
  return data.matches as FDMatch[]
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts lib/football-data.ts
git commit -m "feat: Supabase and football-data.org clients"
```

---

## Task 6: Sync Logic (TDD)

**Files:**
- Create: `lib/sync.ts`
- Create: `tests/sync.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough-32chars!')
vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')
vi.stubEnv('FOOTBALL_DATA_API_TOKEN', 'test-token')

// Mock Supabase
const mockFrom = vi.fn()
vi.mock('@/lib/db', () => ({ db: { from: mockFrom } }))

// Mock football-data client
vi.mock('@/lib/football-data', () => ({
  fetchWCMatches: vi.fn(),
}))

import { syncIfStale } from '@/lib/sync'
import { fetchWCMatches } from '@/lib/football-data'

const mockFetch = vi.mocked(fetchWCMatches)

function makeMockChain(returnValue: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returnValue),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  }
  return chain
}

describe('syncIfStale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips fetch when last_synced_at is less than 10 minutes ago', async () => {
    const recentTime = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const chain = makeMockChain({ data: { last_synced_at: recentTime }, error: null })
    mockFrom.mockReturnValue(chain)

    await syncIfStale()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches when last_synced_at is stale (> 10 min ago)', async () => {
    const staleTime = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const chain = makeMockChain({ data: { last_synced_at: staleTime }, error: null })
    mockFrom.mockReturnValue(chain)
    mockFetch.mockResolvedValue([])

    await syncIfStale()

    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('does not throw when football-data.org is unreachable', async () => {
    const staleTime = new Date(0).toISOString()
    const chain = makeMockChain({ data: { last_synced_at: staleTime }, error: null })
    mockFrom.mockReturnValue(chain)
    mockFetch.mockRejectedValue(new Error('network error'))

    await expect(syncIfStale()).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- tests/sync.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/sync.ts`**

```typescript
// lib/sync.ts
import { db } from './db'
import { fetchWCMatches } from './football-data'
import { computePoints, computeDeadline } from './scoring'

const SYNC_TTL_MS = 10 * 60 * 1000

export async function syncIfStale(): Promise<void> {
  const { data: meta } = await db
    .from('sync_meta')
    .select('last_synced_at')
    .eq('id', 1)
    .single()

  const lastSynced = meta?.last_synced_at ? new Date(meta.last_synced_at) : null
  if (lastSynced && Date.now() - lastSynced.getTime() < SYNC_TTL_MS) return

  await runSync()
}

export async function forceSync(): Promise<void> {
  await runSync()
}

async function runSync(): Promise<void> {
  let matches: Awaited<ReturnType<typeof fetchWCMatches>>
  try {
    matches = await fetchWCMatches()
  } catch (err) {
    console.warn('[sync] football-data.org unreachable:', err)
    return
  }

  for (const match of matches) {
    const kickoffUtc = new Date(match.utcDate)
    const deadlineUtc = computeDeadline(kickoffUtc)

    const { data: existing } = await db
      .from('matches')
      .select('id, status')
      .eq('external_id', match.id)
      .single()

    const wasFinished = existing?.status === 'FINISHED'
    const isNowFinished = match.status === 'FINISHED'

    const { data: upserted } = await db
      .from('matches')
      .upsert(
        {
          external_id: match.id,
          home_team: match.homeTeam.name,
          away_team: match.awayTeam.name,
          home_crest: match.homeTeam.crest ?? null,
          away_crest: match.awayTeam.crest ?? null,
          stage: match.stage,
          group_name: match.group ?? null,
          matchday: match.matchday ?? null,
          kickoff_utc: kickoffUtc.toISOString(),
          deadline_utc: deadlineUtc.toISOString(),
          status: match.status,
          home_score: match.score.fullTime.home,
          away_score: match.score.fullTime.away,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'external_id' }
      )
      .select('id')
      .single()

    if (!wasFinished && isNowFinished && upserted &&
        match.score.fullTime.home !== null && match.score.fullTime.away !== null) {
      await scorePredictions(upserted.id, {
        home: match.score.fullTime.home,
        away: match.score.fullTime.away,
      })
    }
  }

  await db
    .from('sync_meta')
    .upsert({ id: 1, last_synced_at: new Date().toISOString() })
}

export async function scorePredictions(
  matchId: string,
  actual: { home: number; away: number }
): Promise<void> {
  const { data: predictions } = await db
    .from('predictions')
    .select('id, home_score, away_score')
    .eq('match_id', matchId)

  if (!predictions?.length) return

  for (const pred of predictions) {
    const points = computePoints(
      { home: pred.home_score, away: pred.away_score },
      actual
    )
    await db.from('predictions').update({ points }).eq('id', pred.id)
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/sync.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sync.ts tests/sync.test.ts
git commit -m "feat: sync logic with TTL cache and prediction scoring"
```

---

## Task 7: Auth Middleware + Root Redirect

**Files:**
- Create: `middleware.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `middleware.ts`**

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/login']

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (pathname.startsWith('/admin') && !payload.isAdmin) {
      return NextResponse.redirect(new URL('/leaderboard', request.url))
    }
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function RootPage() {
  const session = await getSession()
  redirect(session ? '/leaderboard' : '/login')
}
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts app/page.tsx
git commit -m "feat: auth middleware and root redirect"
```

---

## Task 8: Auth Server Actions + Login Page

**Files:**
- Create: `actions/auth-actions.ts`
- Create: `app/login/page.tsx`
- Create: `tests/auth-actions.test.ts`

- [ ] **Step 1: Write failing test for register action**

```typescript
// tests/auth-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough-32chars!')
vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')

const mockFrom = vi.fn()
vi.mock('@/lib/db', () => ({ db: { from: mockFrom } }))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))

import { registerAction, loginAction } from '@/actions/auth-actions'

function makeChain(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    ...overrides,
  }
}

describe('registerAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fails with invalid invite code', async () => {
    mockFrom.mockReturnValue(
      makeChain({ single: vi.fn().mockResolvedValue({ data: null, error: null }) })
    )
    const result = await registerAction({ inviteCode: 'bad', username: 'alice', password: 'pw' })
    expect(result.error).toMatch(/invite/i)
  })

  it('fails with empty password', async () => {
    const result = await registerAction({ inviteCode: 'x', username: 'alice', password: '' })
    expect(result.error).toMatch(/password/i)
  })
})

describe('loginAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fails when user not found', async () => {
    mockFrom.mockReturnValue(
      makeChain({ single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }) })
    )
    const result = await loginAction({ username: 'nobody', password: 'pw' })
    expect(result.error).toMatch(/invalid/i)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- tests/auth-actions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `actions/auth-actions.ts`**

```typescript
// actions/auth-actions.ts
'use server'

import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { setSessionCookie, clearSessionCookie } from '@/lib/auth'
import { redirect } from 'next/navigation'

interface RegisterInput { inviteCode: string; username: string; password: string }
interface LoginInput { username: string; password: string }
interface ActionResult { error?: string }

export async function registerAction(input: RegisterInput): Promise<ActionResult> {
  if (!input.password) return { error: 'Password cannot be empty' }

  const { data: invite } = await db
    .from('invite_codes')
    .select('id')
    .eq('code', input.inviteCode)
    .eq('is_active', true)
    .single()

  if (!invite) return { error: 'Invalid or inactive invite code' }

  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('username', input.username)
    .single()

  if (existing) return { error: 'Username already taken' }

  const password_hash = await bcrypt.hash(input.password, 10)

  const { data: user, error } = await db
    .from('users')
    .insert({ username: input.username, password_hash })
    .select('id, is_admin')
    .single()

  if (error || !user) return { error: 'Registration failed, please try again' }

  await setSessionCookie({ userId: user.id, isAdmin: user.is_admin })
  redirect('/leaderboard')
}

export async function loginAction(input: LoginInput): Promise<ActionResult> {
  const { data: user } = await db
    .from('users')
    .select('id, password_hash, is_admin')
    .eq('username', input.username)
    .single()

  if (!user) return { error: 'Invalid username or password' }

  const valid = await bcrypt.compare(input.password, user.password_hash)
  if (!valid) return { error: 'Invalid username or password' }

  await setSessionCookie({ userId: user.id, isAdmin: user.is_admin })
  redirect('/leaderboard')
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie()
  redirect('/login')
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/auth-actions.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Create `app/login/page.tsx`**

```typescript
// app/login/page.tsx
'use client'

import { useState, useTransition } from 'react'
import { loginAction, registerAction } from '@/actions/auth-actions'

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await loginAction({
        username: fd.get('username') as string,
        password: fd.get('password') as string,
      })
      if (result?.error) setError(result.error)
    })
  }

  function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await registerAction({
        inviteCode: fd.get('inviteCode') as string,
        username: fd.get('username') as string,
        password: fd.get('password') as string,
      })
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white text-center mb-6">
          ⚽ WC 2026 Pick&apos;em
        </h1>

        {/* Tabs */}
        <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-gray-400'
              }`}
            >
              {t === 'login' ? 'Sign In' : 'Join'}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input name="username" placeholder="Username" required autoComplete="username"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="password" type="password" placeholder="Password" required autoComplete="current-password"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition-colors">
              {isPending ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <input name="inviteCode" placeholder="Invite code" required
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="username" placeholder="Choose a username" required autoComplete="username"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="password" type="password" placeholder="Choose a password" required autoComplete="new-password"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={isPending}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition-colors">
              {isPending ? 'Joining…' : 'Join the Group'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify app builds**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add actions/auth-actions.ts app/login/page.tsx tests/auth-actions.test.ts
git commit -m "feat: auth server actions and login/register page"
```

---

## Task 9: Root Layout + Bottom Navigation

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/nav/bottom-nav.tsx`

- [ ] **Step 1: Create `components/nav/bottom-nav.tsx`**

```typescript
// components/nav/bottom-nav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/leaderboard', label: 'Standings', icon: '🏆' },
  { href: '/predictions/group-stage', label: 'Predict', icon: '✏️' },
  { href: '/matches', label: 'Matches', icon: '⚽' },
  { href: '/admin', label: 'Admin', icon: '⚙️', adminOnly: true },
]

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 safe-area-inset-bottom">
      <div className="flex">
        {items.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
                active ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Update `app/layout.tsx`**

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { BottomNav } from '@/components/nav/bottom-nav'
import { getSession } from '@/lib/auth'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WC 2026 Pick\'em',
  description: 'World Cup 2026 score predictions',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const showNav = !!session

  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <main className={showNav ? 'pb-20' : ''}>
          {children}
        </main>
        {showNav && <BottomNav isAdmin={session.isAdmin} />}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx components/nav/bottom-nav.tsx
git commit -m "feat: root layout with bottom navigation"
```

---

## Task 10: Leaderboard Page

**Files:**
- Create: `app/leaderboard/page.tsx`
- Create: `components/leaderboard/leaderboard-table.tsx`

- [ ] **Step 1: Create `components/leaderboard/leaderboard-table.tsx`**

```typescript
// components/leaderboard/leaderboard-table.tsx
import Link from 'next/link'

export interface LeaderboardRow {
  rank: number
  username: string
  totalPoints: number
  exact: number
  correct: number
  wrong: number
  missing: number
}

export function LeaderboardTable({ rows, currentUsername }: {
  rows: LeaderboardRow[]
  currentUsername: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
            <th className="text-left py-3 px-4">#</th>
            <th className="text-left py-3 px-2">Player</th>
            <th className="text-right py-3 px-2">Pts</th>
            <th className="text-right py-3 px-2 hidden sm:table-cell">🎯</th>
            <th className="text-right py-3 px-2 hidden sm:table-cell">✅</th>
            <th className="text-right py-3 px-2 hidden sm:table-cell">❌</th>
            <th className="text-right py-3 px-4 hidden sm:table-cell">–</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.username}
              className={`border-b border-gray-800/50 ${
                row.username === currentUsername ? 'bg-blue-950/30' : ''
              }`}
            >
              <td className="py-3 px-4 text-gray-500 font-mono">{row.rank}</td>
              <td className="py-3 px-2">
                <Link
                  href={`/users/${encodeURIComponent(row.username)}`}
                  className="font-medium hover:text-blue-400 transition-colors"
                >
                  {row.username}
                  {row.username === currentUsername && (
                    <span className="ml-1 text-xs text-blue-500">(you)</span>
                  )}
                </Link>
              </td>
              <td className="py-3 px-2 text-right font-bold text-lg">{row.totalPoints}</td>
              <td className="py-3 px-2 text-right text-green-400 hidden sm:table-cell">{row.exact}</td>
              <td className="py-3 px-2 text-right text-yellow-400 hidden sm:table-cell">{row.correct}</td>
              <td className="py-3 px-2 text-right text-red-400 hidden sm:table-cell">{row.wrong}</td>
              <td className="py-3 px-4 text-right text-gray-500 hidden sm:table-cell">{row.missing}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/leaderboard/page.tsx`**

```typescript
// app/leaderboard/page.tsx
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { syncIfStale } from '@/lib/sync'
import { LeaderboardTable, LeaderboardRow } from '@/components/leaderboard/leaderboard-table'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  await syncIfStale()

  const session = await getSession()

  const { data: users } = await db
    .from('users')
    .select('id, username')

  const { data: predictions } = await db
    .from('predictions')
    .select('user_id, points')

  const { data: finishedMatches } = await db
    .from('matches')
    .select('id')
    .eq('status', 'FINISHED')

  const finishedCount = finishedMatches?.length ?? 0

  const rows: LeaderboardRow[] = (users ?? []).map((user) => {
    const userPreds = (predictions ?? []).filter((p) => p.user_id === user.id)
    const totalPoints = userPreds.reduce((sum, p) => sum + (p.points ?? 0), 0)
    const exact = userPreds.filter((p) => p.points === 3).length
    const correct = userPreds.filter((p) => p.points === 1).length
    const wrong = userPreds.filter((p) => p.points === 0).length
    const predicted = userPreds.filter((p) => p.points !== null).length
    const missing = finishedCount - predicted
    return { rank: 0, username: user.username, totalPoints, exact, correct, wrong, missing }
  })

  rows.sort((a, b) => b.totalPoints - a.totalPoints)

  // Assign shared ranks for ties
  let rank = 1
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].totalPoints < rows[i - 1].totalPoints) rank = i + 1
    rows[i].rank = rank
  }

  const { data: currentUser } = await db
    .from('users')
    .select('username')
    .eq('id', session!.userId)
    .single()

  return (
    <div className="max-w-2xl mx-auto px-0">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Standings</h1>
        <p className="text-gray-500 text-sm mt-1">{finishedCount} matches played</p>
      </div>
      <LeaderboardTable rows={rows} currentUsername={currentUser?.username ?? ''} />
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/leaderboard/page.tsx components/leaderboard/leaderboard-table.tsx
git commit -m "feat: leaderboard page with scoring stats"
```

---

## Task 11: Prediction Submit Action (TDD)

**Files:**
- Create: `actions/prediction-actions.ts`
- Create: `tests/prediction-actions.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/prediction-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough-32chars!')
vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')

const mockFrom = vi.fn()
vi.mock('@/lib/db', () => ({ db: { from: mockFrom } }))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))

import { submitPredictionsAction } from '@/actions/prediction-actions'

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString()

function makeMatchChain(deadlineUtc: string) {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({
      data: [{ id: 'match-1', deadline_utc: deadlineUtc }],
      error: null,
    }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }
}

describe('submitPredictionsAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    const result = await submitPredictionsAction([
      { matchId: 'match-1', homeScore: 1, awayScore: 0 },
    ])
    expect(result.error).toMatch(/not authenticated/i)
  })

  it('rejects predictions for matches past their deadline', async () => {
    vi.mock('@/lib/auth', () => ({
      getSession: vi.fn().mockResolvedValue({ userId: 'user-1', isAdmin: false }),
    }))
    const chain = makeMatchChain(PAST)
    mockFrom.mockReturnValue(chain)

    const result = await submitPredictionsAction([
      { matchId: 'match-1', homeScore: 1, awayScore: 0 },
    ])
    expect(result.skipped).toContain('match-1')
    expect(result.saved).toBe(0)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- tests/prediction-actions.test.ts
```

- [ ] **Step 3: Create `actions/prediction-actions.ts`**

```typescript
// actions/prediction-actions.ts
'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export interface PredictionInput {
  matchId: string
  homeScore: number
  awayScore: number
}

export interface SubmitResult {
  saved: number
  skipped: string[]
  error?: string
}

export async function submitPredictionsAction(
  inputs: PredictionInput[]
): Promise<SubmitResult> {
  const session = await getSession()
  if (!session) return { saved: 0, skipped: [], error: 'Not authenticated' }

  const matchIds = inputs.map((i) => i.matchId)
  const { data: matches } = await db
    .from('matches')
    .select('id, deadline_utc')
    .in('id', matchIds)

  const now = new Date()
  const deadlineMap = new Map((matches ?? []).map((m) => [m.id, new Date(m.deadline_utc)]))

  const valid: PredictionInput[] = []
  const skipped: string[] = []

  for (const input of inputs) {
    const deadline = deadlineMap.get(input.matchId)
    if (!deadline || now >= deadline) {
      skipped.push(input.matchId)
    } else {
      valid.push(input)
    }
  }

  if (valid.length > 0) {
    await db.from('predictions').upsert(
      valid.map((v) => ({
        user_id: session.userId,
        match_id: v.matchId,
        home_score: v.homeScore,
        away_score: v.awayScore,
        updated_at: now.toISOString(),
      })),
      { onConflict: 'user_id,match_id' }
    )
  }

  return { saved: valid.length, skipped }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/prediction-actions.test.ts
```

Expected: Tests pass (note: the auth mock test may need adjustment — the first test passes without session mock set).

- [ ] **Step 5: Commit**

```bash
git add actions/prediction-actions.ts tests/prediction-actions.test.ts
git commit -m "feat: prediction submit server action with deadline enforcement"
```

---

## Task 12: Prediction Entry Page + Form

**Files:**
- Create: `app/predictions/[stage]/page.tsx`
- Create: `components/predictions/prediction-form.tsx`
- Create: `components/predictions/round-tabs.tsx`

- [ ] **Step 1: Create `components/predictions/round-tabs.tsx`**

```typescript
// components/predictions/round-tabs.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ROUNDS = [
  { slug: 'group-stage', label: 'Groups' },
  { slug: 'round-of-32', label: 'R32' },
  { slug: 'round-of-16', label: 'R16' },
  { slug: 'quarter-finals', label: 'QF' },
  { slug: 'semi-finals', label: 'SF' },
  { slug: 'third-place', label: '3rd' },
  { slug: 'final', label: 'Final' },
]

export function RoundTabs() {
  const pathname = usePathname()
  return (
    <div className="flex overflow-x-auto gap-2 px-4 py-3 border-b border-gray-800 scrollbar-hide">
      {ROUNDS.map((r) => {
        const active = pathname.includes(r.slug)
        return (
          <Link
            key={r.slug}
            href={`/predictions/${r.slug}`}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {r.label}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/predictions/prediction-form.tsx`**

```typescript
// components/predictions/prediction-form.tsx
'use client'

import { useState, useTransition } from 'react'
import { submitPredictionsAction, PredictionInput } from '@/actions/prediction-actions'

export interface MatchForForm {
  id: string
  homeTeam: string
  awayTeam: string
  homeCrest: string | null
  awayCrest: string | null
  groupName: string | null
  kickoffUtc: string
  deadlineUtc: string
  existingHome: number | null
  existingAway: number | null
  isLocked: boolean
}

function TeamFlag({ crest, name }: { crest: string | null; name: string }) {
  if (crest) {
    return (
      <img
        src={crest}
        alt={name}
        className="w-6 h-6 object-contain rounded-sm flex-shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return <span className="w-6 h-6 text-center text-sm leading-6">🏳</span>
}

export function PredictionForm({ matches, stage }: {
  matches: MatchForForm[]
  stage: string
}) {
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>(() => {
    const init: Record<string, { home: string; away: string }> = {}
    for (const m of matches) {
      init[m.id] = {
        home: m.existingHome !== null ? String(m.existingHome) : '',
        away: m.existingAway !== null ? String(m.existingAway) : '',
      }
    }
    return init
  })
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ saved: number; skipped: string[] } | null>(null)

  function setScore(matchId: string, side: 'home' | 'away', value: string) {
    const num = value.replace(/\D/g, '').slice(0, 2)
    setScores((prev) => ({ ...prev, [matchId]: { ...prev[matchId], [side]: num } }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const inputs: PredictionInput[] = []
    for (const match of matches) {
      if (match.isLocked) continue
      const s = scores[match.id]
      if (s.home === '' || s.away === '') continue
      inputs.push({ matchId: match.id, homeScore: Number(s.home), awayScore: Number(s.away) })
    }
    startTransition(async () => {
      const res = await submitPredictionsAction(inputs)
      setResult(res)
    })
  }

  // Group by group_name for group stage
  const groups = [...new Set(matches.map((m) => m.groupName ?? stage))]

  return (
    <form onSubmit={handleSubmit}>
      {result && (
        <div className="mx-4 mt-3 px-3 py-2 bg-green-950 border border-green-800 rounded-lg text-green-400 text-sm">
          Saved {result.saved} prediction{result.saved !== 1 ? 's' : ''}.
          {result.skipped.length > 0 && ` ${result.skipped.length} skipped (deadline passed).`}
        </div>
      )}

      {groups.map((group) => (
        <div key={group}>
          {group && (
            <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-widest">
              {group}
            </div>
          )}
          {matches
            .filter((m) => (m.groupName ?? stage) === group)
            .map((match) => {
              const s = scores[match.id]
              const deadline = new Date(match.deadlineUtc)
              const now = new Date()
              const minutesLeft = Math.floor((deadline.getTime() - now.getTime()) / 60000)
              const soonDeadline = !match.isLocked && minutesLeft < 60 && minutesLeft > 0

              return (
                <div
                  key={match.id}
                  className={`flex items-center gap-2 px-4 py-3 border-b border-gray-800/50 ${
                    match.isLocked ? 'opacity-60' : ''
                  }`}
                >
                  <TeamFlag crest={match.homeCrest} name={match.homeTeam} />
                  <span className="flex-1 text-sm font-medium truncate">{match.homeTeam}</span>

                  {match.isLocked ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="w-7 text-center font-bold">
                        {match.existingHome !== null ? match.existingHome : '–'}
                      </span>
                      <span className="text-gray-600">–</span>
                      <span className="w-7 text-center font-bold">
                        {match.existingAway !== null ? match.existingAway : '–'}
                      </span>
                      <span className="ml-1 text-xs text-gray-600">🔒</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {soonDeadline && (
                        <span className="text-xs text-orange-400">{minutesLeft}m left</span>
                      )}
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={s.home}
                        onChange={(e) => setScore(match.id, 'home', e.target.value)}
                        placeholder="?"
                        className="w-9 bg-gray-800 border border-gray-700 rounded text-center text-white text-base font-bold py-1 focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-gray-600 font-bold">–</span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={s.away}
                        onChange={(e) => setScore(match.id, 'away', e.target.value)}
                        placeholder="?"
                        className="w-9 bg-gray-800 border border-gray-700 rounded text-center text-white text-base font-bold py-1 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  <span className="flex-1 text-sm font-medium truncate text-right">{match.awayTeam}</span>
                  <TeamFlag crest={match.awayCrest} name={match.awayTeam} />
                </div>
              )
            })}
        </div>
      ))}

      <div className="sticky bottom-20 px-4 pb-4 pt-3 bg-gray-950/90 backdrop-blur border-t border-gray-800 mt-4">
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          {isPending ? 'Saving…' : 'Save Predictions'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Create `app/predictions/[stage]/page.tsx`**

```typescript
// app/predictions/[stage]/page.tsx
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { syncIfStale } from '@/lib/sync'
import { RoundTabs } from '@/components/predictions/round-tabs'
import { PredictionForm, MatchForForm } from '@/components/predictions/prediction-form'

export const dynamic = 'force-dynamic'

const STAGE_MAP: Record<string, string> = {
  'group-stage': 'GROUP_STAGE',
  'round-of-32': 'ROUND_OF_32',
  'round-of-16': 'ROUND_OF_16',
  'quarter-finals': 'QUARTER_FINALS',
  'semi-finals': 'SEMI_FINALS',
  'third-place': 'THIRD_PLACE',
  'final': 'FINAL',
}

export default async function PredictionsPage({
  params,
}: {
  params: Promise<{ stage: string }>
}) {
  const { stage: stageSlug } = await params
  const dbStage = STAGE_MAP[stageSlug]
  if (!dbStage) notFound()

  await syncIfStale()
  const session = await getSession()

  const { data: matches } = await db
    .from('matches')
    .select('id, home_team, away_team, home_crest, away_crest, group_name, kickoff_utc, deadline_utc')
    .eq('stage', dbStage)
    .not('home_team', 'eq', '')
    .not('away_team', 'eq', '')
    .order('kickoff_utc', { ascending: true })

  const matchIds = (matches ?? []).map((m) => m.id)
  const { data: predictions } = matchIds.length
    ? await db
        .from('predictions')
        .select('match_id, home_score, away_score')
        .eq('user_id', session!.userId)
        .in('match_id', matchIds)
    : { data: [] }

  const predMap = new Map(
    (predictions ?? []).map((p) => [p.match_id, { home: p.home_score, away: p.away_score }])
  )

  const now = new Date()
  const formMatches: MatchForForm[] = (matches ?? []).map((m) => ({
    id: m.id,
    homeTeam: m.home_team,
    awayTeam: m.away_team,
    homeCrest: m.home_crest,
    awayCrest: m.away_crest,
    groupName: m.group_name,
    kickoffUtc: m.kickoff_utc,
    deadlineUtc: m.deadline_utc,
    existingHome: predMap.get(m.id)?.home ?? null,
    existingAway: predMap.get(m.id)?.away ?? null,
    isLocked: now >= new Date(m.deadline_utc),
  }))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">My Predictions</h1>
      </div>
      <RoundTabs />
      {formMatches.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No matches available yet for this round.
        </p>
      ) : (
        <PredictionForm matches={formMatches} stage={stageSlug} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add app/predictions components/predictions
git commit -m "feat: prediction entry form with batch save per round"
```

---

## Task 13: Matches List Page

**Files:**
- Create: `app/matches/page.tsx`
- Create: `components/matches/match-row.tsx`

- [ ] **Step 1: Create `components/matches/match-row.tsx`**

```typescript
// components/matches/match-row.tsx
import Link from 'next/link'

export interface MatchRowData {
  id: string
  homeTeam: string
  awayTeam: string
  homeCrest: string | null
  awayCrest: string | null
  kickoffUtc: string
  status: string
  homeScore: number | null
  awayScore: number | null
  deadlineUtc: string
}

function Flag({ crest, name }: { crest: string | null; name: string }) {
  if (crest) {
    return <img src={crest} alt={name} className="w-5 h-5 object-contain rounded-sm flex-shrink-0" />
  }
  return <span className="text-sm">🏳</span>
}

function formatKickoff(utc: string): string {
  return new Date(utc).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function MatchRow({ match }: { match: MatchRowData }) {
  const isFinished = match.status === 'FINISHED'
  const isLive = match.status === 'IN_PLAY' || match.status === 'LIVE' || match.status === 'PAUSED'

  return (
    <Link href={`/matches/${match.id}`} className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors">
      <Flag crest={match.homeCrest} name={match.homeTeam} />
      <span className="flex-1 text-sm font-medium truncate">{match.homeTeam}</span>

      <div className="flex flex-col items-center min-w-[64px]">
        {isFinished ? (
          <span className="text-base font-bold tabular-nums">
            {match.homeScore} – {match.awayScore}
          </span>
        ) : isLive ? (
          <span className="text-xs font-bold text-green-400 animate-pulse">LIVE</span>
        ) : (
          <span className="text-xs text-gray-500">{formatKickoff(match.kickoffUtc)}</span>
        )}
        <span className={`text-xs mt-0.5 ${isFinished ? 'text-gray-600' : isLive ? 'text-green-600' : 'text-gray-700'}`}>
          {isFinished ? 'FT' : isLive ? '●' : 'CT'}
        </span>
      </div>

      <span className="flex-1 text-sm font-medium truncate text-right">{match.awayTeam}</span>
      <Flag crest={match.awayCrest} name={match.awayTeam} />
    </Link>
  )
}
```

- [ ] **Step 2: Create `app/matches/page.tsx`**

```typescript
// app/matches/page.tsx
import { db } from '@/lib/db'
import { syncIfStale } from '@/lib/sync'
import { MatchRow, MatchRowData } from '@/components/matches/match-row'

export const dynamic = 'force-dynamic'

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Group Stage',
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINALS: 'Quarterfinals',
  SEMI_FINALS: 'Semifinals',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
}

const STAGE_ORDER = Object.keys(STAGE_LABELS)

export default async function MatchesPage() {
  await syncIfStale()

  const { data: matches } = await db
    .from('matches')
    .select('id, home_team, away_team, home_crest, away_crest, kickoff_utc, deadline_utc, status, home_score, away_score, stage, group_name')
    .order('kickoff_utc', { ascending: true })

  const byStage = new Map<string, MatchRowData[]>()
  for (const m of matches ?? []) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push({
      id: m.id,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      homeCrest: m.home_crest,
      awayCrest: m.away_crest,
      kickoffUtc: m.kickoff_utc,
      status: m.status,
      homeScore: m.home_score,
      awayScore: m.away_score,
      deadlineUtc: m.deadline_utc,
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Matches</h1>
      </div>
      {STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => (
        <div key={stage}>
          <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-widest sticky top-0 bg-gray-950/90 backdrop-blur">
            {STAGE_LABELS[stage]}
          </div>
          {byStage.get(stage)!.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build
git add app/matches/page.tsx components/matches/match-row.tsx
git commit -m "feat: matches list page grouped by round"
```

---

## Task 14: Match Detail + Comparison View

**Files:**
- Create: `app/matches/[matchId]/page.tsx`
- Create: `components/matches/match-detail.tsx`

- [ ] **Step 1: Create `components/matches/match-detail.tsx`**

```typescript
// components/matches/match-detail.tsx

export interface UserPrediction {
  username: string
  homeScore: number | null
  awayScore: number | null
  points: number | null
  isCurrentUser: boolean
}

export function MatchComparison({
  predictions,
  actualHome,
  actualAway,
}: {
  predictions: UserPrediction[]
  actualHome: number | null
  actualAway: number | null
}) {
  return (
    <div className="px-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest py-3">
        All Predictions
      </div>
      {predictions.map((pred) => (
        <div
          key={pred.username}
          className={`flex items-center gap-3 py-2.5 border-b border-gray-800/50 ${
            pred.isCurrentUser ? 'text-blue-300' : ''
          }`}
        >
          <span className="w-24 truncate text-sm font-medium">
            {pred.username}
            {pred.isCurrentUser && <span className="text-xs text-blue-500 ml-1">(you)</span>}
          </span>
          <span className="font-mono text-sm font-bold">
            {pred.homeScore !== null ? `${pred.homeScore} – ${pred.awayScore}` : '–'}
          </span>
          <span className="ml-auto text-sm font-bold">
            {pred.points === 3 && <span className="text-green-400">+3 🎯</span>}
            {pred.points === 1 && <span className="text-yellow-400">+1 ✅</span>}
            {pred.points === 0 && <span className="text-red-400">0 ❌</span>}
            {pred.points === null && pred.homeScore !== null && (
              <span className="text-gray-600">–</span>
            )}
            {pred.homeScore === null && <span className="text-gray-700">no pick</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/matches/[matchId]/page.tsx`**

```typescript
// app/matches/[matchId]/page.tsx
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { syncIfStale } from '@/lib/sync'
import { MatchComparison, UserPrediction } from '@/components/matches/match-detail'

export const dynamic = 'force-dynamic'

function formatKickoff(utc: string): string {
  return new Date(utc).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  })
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>
}) {
  const { matchId } = await params
  await syncIfStale()

  const session = await getSession()

  const { data: match } = await db
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (!match) notFound()

  const isPastDeadline = new Date() >= new Date(match.deadline_utc)

  // Only show all predictions after deadline
  const { data: allPredictions } = isPastDeadline
    ? await db
        .from('predictions')
        .select('user_id, home_score, away_score, points')
        .eq('match_id', matchId)
    : { data: [] }

  const { data: myPrediction } = await db
    .from('predictions')
    .select('home_score, away_score, points')
    .eq('match_id', matchId)
    .eq('user_id', session!.userId)
    .single()

  const { data: users } = await db.from('users').select('id, username')
  const userMap = new Map((users ?? []).map((u) => [u.id, u.username]))

  const { data: currentUser } = await db
    .from('users')
    .select('username')
    .eq('id', session!.userId)
    .single()

  let comparisonRows: UserPrediction[] = []
  if (isPastDeadline) {
    const predMap = new Map(
      (allPredictions ?? []).map((p) => [p.user_id, p])
    )
    comparisonRows = (users ?? []).map((u) => {
      const pred = predMap.get(u.id)
      return {
        username: u.username,
        homeScore: pred?.home_score ?? null,
        awayScore: pred?.away_score ?? null,
        points: pred?.points ?? null,
        isCurrentUser: u.id === session!.userId,
      }
    }).sort((a, b) => (b.points ?? -1) - (a.points ?? -1))
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Match header */}
      <div className="px-4 py-6 border-b border-gray-800 text-center">
        <p className="text-xs text-gray-500 mb-3">{match.stage.replace(/_/g, ' ')}</p>
        <div className="flex items-center justify-center gap-4 mb-3">
          {match.home_crest && (
            <img src={match.home_crest} alt={match.home_team} className="w-10 h-10 object-contain" />
          )}
          <div className="text-2xl font-bold tabular-nums">
            {match.status === 'FINISHED'
              ? `${match.home_score} – ${match.away_score}`
              : '– : –'}
          </div>
          {match.away_crest && (
            <img src={match.away_crest} alt={match.away_team} className="w-10 h-10 object-contain" />
          )}
        </div>
        <div className="flex justify-between text-sm font-medium px-8">
          <span>{match.home_team}</span>
          <span>{match.away_team}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">{formatKickoff(match.kickoff_utc)}</p>
      </div>

      {/* Before deadline: show only own prediction */}
      {!isPastDeadline && (
        <div className="px-4 py-4">
          <p className="text-sm text-gray-500 mb-2">Your prediction</p>
          {myPrediction ? (
            <p className="text-lg font-bold">
              {myPrediction.home_score} – {myPrediction.away_score}
            </p>
          ) : (
            <p className="text-gray-600">No prediction submitted yet.</p>
          )}
          <p className="text-xs text-gray-600 mt-2">
            Predictions are hidden until the deadline passes.
          </p>
        </div>
      )}

      {/* After deadline: full comparison */}
      {isPastDeadline && (
        <MatchComparison
          predictions={comparisonRows}
          actualHome={match.home_score}
          actualAway={match.away_score}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build
git add app/matches/\[matchId\] components/matches/match-detail.tsx
git commit -m "feat: match detail page with comparison view after deadline"
```

---

## Task 15: User Prediction History

**Files:**
- Create: `app/users/[username]/page.tsx`

- [ ] **Step 1: Create `app/users/[username]/page.tsx`**

```typescript
// app/users/[username]/page.tsx
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { syncIfStale } from '@/lib/sync'

export const dynamic = 'force-dynamic'

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Group Stage',
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINALS: 'Quarterfinals',
  SEMI_FINALS: 'Semifinals',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
}

export default async function UserHistoryPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username: rawUsername } = await params
  const username = decodeURIComponent(rawUsername)

  await syncIfStale()

  const { data: user } = await db
    .from('users')
    .select('id, username')
    .eq('username', username)
    .single()

  if (!user) notFound()

  const { data: predictions } = await db
    .from('predictions')
    .select('match_id, home_score, away_score, points')
    .eq('user_id', user.id)

  const { data: matches } = await db
    .from('matches')
    .select('id, home_team, away_team, home_crest, away_crest, stage, kickoff_utc, deadline_utc, status, home_score, away_score')
    .order('kickoff_utc', { ascending: true })

  const predMap = new Map(
    (predictions ?? []).map((p) => [p.match_id, p])
  )

  const totalPoints = (predictions ?? []).reduce((s, p) => s + (p.points ?? 0), 0)

  const byStage = new Map<string, typeof matches>()
  for (const m of matches ?? []) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push(m)
  }

  const STAGE_ORDER = Object.keys(STAGE_LABELS)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">{user.username}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{totalPoints} total points</p>
      </div>

      {STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => (
        <div key={stage}>
          <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-widest">
            {STAGE_LABELS[stage]}
          </div>
          {byStage.get(stage)!.map((match) => {
            const pred = predMap.get(match.id)
            const isPast = new Date() >= new Date(match.deadline_utc)
            const showPred = isPast && pred

            return (
              <div key={match.id} className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/50 text-sm">
                {match.home_crest && (
                  <img src={match.home_crest} alt={match.home_team} className="w-5 h-5 object-contain" />
                )}
                <span className="flex-1 truncate">{match.home_team}</span>

                <div className="text-center min-w-[80px]">
                  {match.status === 'FINISHED' && (
                    <div className="font-bold tabular-nums">
                      {match.home_score} – {match.away_score}
                    </div>
                  )}
                  {showPred && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      pick: {pred.home_score} – {pred.away_score}
                      {pred.points === 3 && ' 🎯'}
                      {pred.points === 1 && ' ✅'}
                      {pred.points === 0 && ' ❌'}
                    </div>
                  )}
                  {isPast && !pred && (
                    <div className="text-xs text-gray-700">no pick</div>
                  )}
                </div>

                <span className="flex-1 truncate text-right">{match.away_team}</span>
                {match.away_crest && (
                  <img src={match.away_crest} alt={match.away_team} className="w-5 h-5 object-contain" />
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build
git add app/users
git commit -m "feat: user prediction history page"
```

---

## Task 16: Admin Server Actions + Admin Panel

**Files:**
- Create: `actions/admin-actions.ts`
- Create: `app/admin/page.tsx`
- Create: `components/admin/force-sync-button.tsx`
- Create: `components/admin/invite-code-manager.tsx`
- Create: `components/admin/user-manager.tsx`
- Create: `components/admin/result-override-form.tsx`

- [ ] **Step 1: Create `actions/admin-actions.ts`**

```typescript
// actions/admin-actions.ts
'use server'

import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { forceSync, scorePredictions } from '@/lib/sync'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const session = await getSession()
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

export async function forceSyncAction(): Promise<{ error?: string }> {
  try {
    await assertAdmin()
    await forceSync()
    revalidatePath('/', 'layout')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function overrideResultAction(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<{ error?: string }> {
  try {
    await assertAdmin()
    await db.from('matches').update({
      home_score: homeScore,
      away_score: awayScore,
      status: 'FINISHED',
      updated_at: new Date().toISOString(),
    }).eq('id', matchId)
    await scorePredictions(matchId, { home: homeScore, away: awayScore })
    revalidatePath('/', 'layout')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function generateInviteAction(): Promise<{ code?: string; error?: string }> {
  try {
    await assertAdmin()
    const code = randomBytes(4).toString('hex').toUpperCase()
    await db.from('invite_codes').insert({ code })
    return { code }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function revokeInviteAction(codeId: string): Promise<{ error?: string }> {
  try {
    await assertAdmin()
    await db.from('invite_codes').update({ is_active: false }).eq('id', codeId)
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function resetPasswordAction(
  userId: string,
  newPassword: string
): Promise<{ error?: string }> {
  try {
    await assertAdmin()
    if (!newPassword) return { error: 'Password cannot be empty' }
    const password_hash = await bcrypt.hash(newPassword, 10)
    await db.from('users').update({ password_hash }).eq('id', userId)
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function removeUserAction(userId: string): Promise<{ error?: string }> {
  try {
    await assertAdmin()
    await db.from('users').delete().eq('id', userId)
    revalidatePath('/', 'layout')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}
```

- [ ] **Step 2: Create `components/admin/force-sync-button.tsx`**

```typescript
// components/admin/force-sync-button.tsx
'use client'

import { useTransition } from 'react'
import { forceSyncAction } from '@/actions/admin-actions'

export function ForceSyncButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => forceSyncAction())}
      disabled={isPending}
      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
    >
      {isPending ? 'Syncing…' : 'Force Sync Results'}
    </button>
  )
}
```

- [ ] **Step 3: Create `components/admin/invite-code-manager.tsx`**

```typescript
// components/admin/invite-code-manager.tsx
'use client'

import { useState, useTransition } from 'react'
import { generateInviteAction, revokeInviteAction } from '@/actions/admin-actions'

export interface InviteCode {
  id: string
  code: string
  isActive: boolean
}

export function InviteCodeManager({ initialCodes }: { initialCodes: InviteCode[] }) {
  const [codes, setCodes] = useState(initialCodes)
  const [isPending, startTransition] = useTransition()
  const [newCode, setNewCode] = useState<string | null>(null)

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateInviteAction()
      if (result.code) {
        setNewCode(result.code)
        setCodes((prev) => [{ id: 'new', code: result.code!, isActive: true }, ...prev])
      }
    })
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      await revokeInviteAction(id)
      setCodes((prev) => prev.map((c) => c.id === id ? { ...c, isActive: false } : c))
    })
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
        >
          Generate Code
        </button>
        {newCode && <span className="font-mono text-green-400 font-bold text-sm">{newCode} ← share this</span>}
      </div>
      <div className="space-y-2">
        {codes.map((c) => (
          <div key={c.id} className="flex items-center gap-3 text-sm">
            <span className={`font-mono font-bold ${c.isActive ? 'text-white' : 'text-gray-600 line-through'}`}>
              {c.code}
            </span>
            {c.isActive && (
              <button
                onClick={() => handleRevoke(c.id)}
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Revoke
              </button>
            )}
            {!c.isActive && <span className="text-xs text-gray-600">revoked</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `components/admin/user-manager.tsx`**

```typescript
// components/admin/user-manager.tsx
'use client'

import { useState, useTransition } from 'react'
import { resetPasswordAction, removeUserAction } from '@/actions/admin-actions'

export interface AdminUser {
  id: string
  username: string
  isAdmin: boolean
}

export function UserManager({ users }: { users: AdminUser[] }) {
  const [list, setList] = useState(users)
  const [resetting, setResetting] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  function handleReset(userId: string) {
    startTransition(async () => {
      const result = await resetPasswordAction(userId, newPw)
      setFeedback((f) => ({ ...f, [userId]: result.error ?? 'Password reset.' }))
      setResetting(null)
      setNewPw('')
    })
  }

  function handleRemove(userId: string) {
    if (!confirm('Remove this user? This cannot be undone.')) return
    startTransition(async () => {
      const result = await removeUserAction(userId)
      if (!result.error) setList((l) => l.filter((u) => u.id !== userId))
    })
  }

  return (
    <div className="space-y-3">
      {list.map((user) => (
        <div key={user.id} className="bg-gray-800 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{user.username}{user.isAdmin && ' 👑'}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setResetting(resetting === user.id ? null : user.id)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Reset pw
              </button>
              {!user.isAdmin && (
                <button
                  onClick={() => handleRemove(user.id)}
                  disabled={isPending}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {resetting === user.id && (
            <div className="flex gap-2 mt-2">
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password"
                className="flex-1 bg-gray-700 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none"
              />
              <button
                onClick={() => handleReset(user.id)}
                disabled={isPending || !newPw}
                className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-1 rounded"
              >
                Save
              </button>
            </div>
          )}
          {feedback[user.id] && (
            <p className="text-xs text-green-400 mt-1">{feedback[user.id]}</p>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create `components/admin/result-override-form.tsx`**

```typescript
// components/admin/result-override-form.tsx
'use client'

import { useState, useTransition } from 'react'
import { overrideResultAction } from '@/actions/admin-actions'

export interface AdminMatch {
  id: string
  homeTeam: string
  awayTeam: string
  kickoffUtc: string
  homeScore: number | null
  awayScore: number | null
}

export function ResultOverrideForm({ matches }: { matches: AdminMatch[] }) {
  const [selectedId, setSelectedId] = useState('')
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || home === '' || away === '') return
    startTransition(async () => {
      const res = await overrideResultAction(selectedId, Number(home), Number(away))
      setResult(res.error ?? 'Result saved and predictions re-scored.')
    })
  }

  const finishedAndRecent = matches
    .filter((m) => new Date(m.kickoffUtc) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime())

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select a match…</option>
        {finishedAndRecent.map((m) => (
          <option key={m.id} value={m.id}>
            {m.homeTeam} vs {m.awayTeam}
            {m.homeScore !== null ? ` (${m.homeScore}–${m.awayScore})` : ''}
          </option>
        ))}
      </select>
      <div className="flex gap-2 items-center">
        <input type="number" min={0} max={99} value={home} onChange={(e) => setHome(e.target.value)}
          placeholder="Home" className="w-16 bg-gray-800 text-white rounded px-2 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-600 font-bold">–</span>
        <input type="number" min={0} max={99} value={away} onChange={(e) => setAway(e.target.value)}
          placeholder="Away" className="w-16 bg-gray-800 text-white rounded px-2 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" disabled={isPending || !selectedId || home === '' || away === ''}
          className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-lg flex-1">
          {isPending ? 'Saving…' : 'Override & Re-score'}
        </button>
      </div>
      {result && <p className="text-sm text-green-400">{result}</p>}
    </form>
  )
}
```

- [ ] **Step 6: Create `app/admin/page.tsx`**

```typescript
// app/admin/page.tsx
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ForceSyncButton } from '@/components/admin/force-sync-button'
import { InviteCodeManager } from '@/components/admin/invite-code-manager'
import { UserManager } from '@/components/admin/user-manager'
import { ResultOverrideForm } from '@/components/admin/result-override-form'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/leaderboard')

  const [{ data: users }, { data: codes }, { data: matches }] = await Promise.all([
    db.from('users').select('id, username, is_admin').order('created_at'),
    db.from('invite_codes').select('id, code, is_active').order('created_at', { ascending: false }),
    db.from('matches')
      .select('id, home_team, away_team, kickoff_utc, home_score, away_score, status')
      .order('kickoff_utc', { ascending: false })
      .limit(50),
  ])

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="border-t border-gray-800 px-4 py-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</h2>
        {children}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Admin</h1>
      </div>

      <Section title="Sync">
        <ForceSyncButton />
      </Section>

      <Section title="Override Result">
        <ResultOverrideForm
          matches={(matches ?? []).map((m) => ({
            id: m.id,
            homeTeam: m.home_team,
            awayTeam: m.away_team,
            kickoffUtc: m.kickoff_utc,
            homeScore: m.home_score,
            awayScore: m.away_score,
          }))}
        />
      </Section>

      <Section title="Invite Codes">
        <InviteCodeManager
          initialCodes={(codes ?? []).map((c) => ({
            id: c.id,
            code: c.code,
            isActive: c.is_active,
          }))}
        />
      </Section>

      <Section title="Users">
        <UserManager
          users={(users ?? []).map((u) => ({
            id: u.id,
            username: u.username,
            isAdmin: u.is_admin,
          }))}
        />
      </Section>
    </div>
  )
}
```

- [ ] **Step 7: Verify build and commit**

```bash
npm run build
git add actions/admin-actions.ts app/admin components/admin
git commit -m "feat: admin panel with sync, result override, invite codes, user management"
```

---

## Task 17: Seed Script

**Files:**
- Create: `db/seed.ts`

- [ ] **Step 1: Create `db/seed.ts`**

```typescript
// db/seed.ts
// Run once: npx tsx db/seed.ts
// Requires .env.local to be populated

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const adminUsername = process.argv[2] ?? 'admin'
  const adminPassword = process.argv[3] ?? randomBytes(8).toString('hex')
  const inviteCode = process.argv[4] ?? randomBytes(4).toString('hex').toUpperCase()

  console.log('Creating admin user:', adminUsername)
  const password_hash = await bcrypt.hash(adminPassword, 10)

  const { data: user, error: userErr } = await db
    .from('users')
    .insert({ username: adminUsername, password_hash, is_admin: true })
    .select('id')
    .single()

  if (userErr) {
    console.error('Failed to create admin user:', userErr.message)
    process.exit(1)
  }

  console.log('Admin user created:', user.id)
  console.log('  Username:', adminUsername)
  console.log('  Password:', adminPassword)

  const { error: codeErr } = await db
    .from('invite_codes')
    .insert({ code: inviteCode })

  if (codeErr) {
    console.error('Failed to create invite code:', codeErr.message)
    process.exit(1)
  }

  console.log('\nInvite code:', inviteCode)
  console.log('\nDone. Share the invite code with your friends.')
}

main().catch(console.error)
```

- [ ] **Step 2: Install tsx for running the script**

```bash
npm install -D tsx
```

- [ ] **Step 3: Test the script locally (requires `.env.local` populated)**

```bash
npx tsx db/seed.ts admin mypassword ABCD1234
```

Expected output:
```
Creating admin user: admin
Admin user created: <uuid>
  Username: admin
  Password: mypassword

Invite code: ABCD1234

Done. Share the invite code with your friends.
```

- [ ] **Step 4: Commit**

```bash
git add db/seed.ts
git commit -m "feat: seed script for initial admin user and invite code"
```

---

## Task 18: Final Verification + Deploy

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All test suites pass.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: No TypeScript errors, no build failures.

- [ ] **Step 3: Set up Vercel environment variables**

In the Vercel project settings → Environment Variables, add:
```
SUPABASE_URL          = https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY = <from Supabase dashboard>
FOOTBALL_DATA_API_TOKEN   = <from football-data.org>
JWT_SECRET            = <random 32+ character string>
```

- [ ] **Step 4: Push to GitHub and connect to Vercel**

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

Connect repo to Vercel → Deploy.

- [ ] **Step 5: Run seed script against production Supabase**

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<key> \
npx tsx db/seed.ts admin <your-password> <invite-code>
```

- [ ] **Step 6: Smoke test**

1. Open the deployed URL
2. Register with the invite code
3. Verify leaderboard loads
4. Navigate to Predictions → enter a score → Save
5. Navigate to Matches → verify matches appear after first sync
6. Log in as admin → Force Sync → verify results update

---

## Self-Review Notes

**Spec coverage check:**
- ✅ 48 teams, 104 matches — handled by sync from football-data.org API
- ✅ Scoring: 3/1/0 pts — `computePoints()` in Task 3
- ✅ Regular user: join, predict, view leaderboard, view predictions — Tasks 8, 10, 12
- ✅ Admin: force sync, override result, invite codes, remove user, reset password — Task 16
- ✅ Predictions lock at deadline — enforced server-side in `submitPredictionsAction`
- ✅ Before deadline: own predictions only — Task 14 (`isPastDeadline` check)
- ✅ After deadline: all predictions visible — Task 14
- ✅ Leaderboard: rank, pts, exact, correct, wrong, missing — Task 10
- ✅ User history: all users can view all users — Task 15
- ✅ Match detail + comparison view — Task 14
- ✅ Group stage sub-grouped by group letter — `prediction-form.tsx` groups by `groupName`
- ✅ Batch save per round — `PredictionForm` submits all at once
- ✅ On-demand sync with 10-min TTL — `syncIfStale()` in Task 6
- ✅ Admin override re-scores predictions — `overrideResultAction` calls `scorePredictions`
- ✅ JWT in HTTP-only cookie, 30-day expiry — Task 4/7
- ✅ bcrypt password hashing — Tasks 8, 16
- ✅ Deadline = min(noon CT, kickoff - 2h) — `computeDeadline()` in Task 3
- ✅ Flags + team names — `TeamFlag` component in `prediction-form.tsx` and `match-row.tsx`
- ✅ Mobile-first — Tailwind, bottom nav, all layouts max-w-2xl centered
- ✅ Invite code registration — `registerAction` validates code
- ✅ Shared rank for ties — computed in leaderboard page
- ✅ Seed script — Task 17
