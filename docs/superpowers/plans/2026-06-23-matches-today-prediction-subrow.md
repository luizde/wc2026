# Matches: Today Section + Prediction Sub-row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Today" section at the top of the matches page and show the current user's prediction (with score indicator) below every match row.

**Architecture:** Extract a pure `isSameDayCT` helper for the today-filter logic (testable), extend `MatchRow` with an optional `prediction` prop that renders a compact sub-row, then wire up the matches page to fetch the current user's predictions and inject them into each row alongside a new Today section.

**Tech Stack:** Next.js App Router (server components), Supabase client, Vitest (node environment), Tailwind CSS

## Global Constraints

- No database schema changes — read-only use of existing `predictions` table
- "Today" is defined in `America/Chicago` timezone throughout (matches existing deadline logic)
- Component tests are not possible in this project's node-only Vitest environment — UI verified by running the dev server
- Touch only: `lib/date-utils.ts` (new), `tests/date-utils.test.ts` (new), `components/matches/match-row.tsx`, `app/matches/page.tsx`

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `lib/date-utils.ts` | **Create** | Pure `isSameDayCT` helper |
| `tests/date-utils.test.ts` | **Create** | Unit tests for `isSameDayCT` |
| `components/matches/match-row.tsx` | **Modify** | Add `PredictionData` type + `prediction` prop + sub-row |
| `app/matches/page.tsx` | **Modify** | Session fetch, prediction query, Today section, pass prediction prop |

---

### Task 1: Create git branch

- [ ] **Step 1: Create and switch to new branch**

```bash
git checkout -b feat/matches-today-prediction-subrow
```

Expected: `Switched to a new branch 'feat/matches-today-prediction-subrow'`

---

### Task 2: Add and test `isSameDayCT` helper

**Files:**
- Create: `lib/date-utils.ts`
- Create: `tests/date-utils.test.ts`

**Interfaces:**
- Produces: `isSameDayCT(kickoffUtc: string, now?: Date): boolean` — returns true if `kickoffUtc` falls on the same calendar day as `now` (defaults to current time), both evaluated in `America/Chicago`.

- [ ] **Step 1: Write the failing tests**

Create `tests/date-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isSameDayCT } from '@/lib/date-utils'

describe('isSameDayCT', () => {
  it('returns true when kickoff is on the same day in CT', () => {
    // June 23, 7 PM CT = June 24 00:00 UTC
    const now = new Date('2026-06-23T20:00:00-05:00') // 8 PM CT June 23
    const kickoff = '2026-06-23T19:00:00-05:00'       // 7 PM CT June 23
    expect(isSameDayCT(kickoff, now)).toBe(true)
  })

  it('returns false when kickoff is on a different day in CT', () => {
    const now = new Date('2026-06-23T20:00:00-05:00') // June 23 CT
    const kickoff = '2026-06-24T01:00:00-05:00'       // June 24 CT
    expect(isSameDayCT(kickoff, now)).toBe(false)
  })

  it('returns true for a UTC kickoff that crosses midnight into today CT', () => {
    // 1:00 AM UTC June 24 = 8:00 PM CT June 23
    const now = new Date('2026-06-23T22:00:00-05:00') // 10 PM CT June 23
    const kickoff = '2026-06-24T01:00:00Z'            // 8 PM CT June 23
    expect(isSameDayCT(kickoff, now)).toBe(true)
  })

  it('returns false for a UTC kickoff that is tomorrow in CT', () => {
    // 8:00 AM UTC June 24 = 3:00 AM CT June 24 — different day from June 23 CT
    const now = new Date('2026-06-23T20:00:00-05:00') // June 23 CT
    const kickoff = '2026-06-24T08:00:00Z'            // June 24 CT
    expect(isSameDayCT(kickoff, now)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/date-utils.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/date-utils'`

- [ ] **Step 3: Implement `isSameDayCT`**

Create `lib/date-utils.ts`:

```ts
const CT = 'America/Chicago'

export function isSameDayCT(kickoffUtc: string, now: Date = new Date()): boolean {
  const opts: Intl.DateTimeFormatOptions = { timeZone: CT }
  const fmt = (d: Date) => d.toLocaleDateString('en-US', opts)
  return fmt(new Date(kickoffUtc)) === fmt(now)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/date-utils.test.ts
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/date-utils.ts tests/date-utils.test.ts
git commit -m "Add isSameDayCT helper with tests"
```

---

### Task 3: Extend `MatchRow` with prediction sub-row

**Files:**
- Modify: `components/matches/match-row.tsx`

**Interfaces:**
- Consumes: nothing new from prior tasks
- Produces:
  - `PredictionData` interface exported from this file
  - Updated `MatchRow` signature: `({ match, prediction }: { match: MatchRowData; prediction?: PredictionData | null })`

The sub-row renders below the `<Link>` inside a wrapper `<div>` that now carries the `border-b`. Display rules:

| `prediction` value | `isFinished` | Renders |
|---|---|---|
| `{ ..., points: 3 }` | true | `My pick: H – A` + `🎯 +3` green |
| `{ ..., points: 1 }` | true | `My pick: H – A` + `✅ +1` yellow |
| `{ ..., points: 0 }` | true | `My pick: H – A` + `❌ 0` red |
| `{ ..., points: null }` | false | `My pick: H – A` (gray, no icon) |
| `null` | true | `No pick` dark gray |
| `null` | false | nothing |
| `undefined` | any | nothing |

No unit tests — component JSX is not testable in this project's node-only Vitest env. Verified by running the dev server in Task 4.

- [ ] **Step 1: Replace the contents of `components/matches/match-row.tsx`**

```tsx
import Link from 'next/link'

export interface PredictionData {
  homeScore: number
  awayScore: number
  points: number | null
}

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

export function MatchRow({
  match,
  prediction,
}: {
  match: MatchRowData
  prediction?: PredictionData | null
}) {
  const isFinished = match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null
  const isLive = match.status === 'IN_PLAY' || match.status === 'LIVE' || match.status === 'PAUSED'

  return (
    <div className="border-b border-gray-800/50">
      <Link
        href={`/matches/${match.id}`}
        className="flex items-center gap-2 px-4 py-3 hover:bg-gray-900/50 transition-colors"
      >
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
          <span
            className={`text-xs mt-0.5 ${
              isFinished ? 'text-gray-600' : isLive ? 'text-green-600' : 'text-gray-700'
            }`}
          >
            {isFinished ? 'FT' : isLive ? '●' : 'CT'}
          </span>
        </div>

        <span className="flex-1 text-sm font-medium truncate text-right">{match.awayTeam}</span>
        <Flag crest={match.awayCrest} name={match.awayTeam} />
      </Link>

      {prediction !== undefined && (
        prediction !== null ? (
          <div className="px-4 py-1 flex items-center gap-2 text-xs text-gray-500">
            <span>My pick: {prediction.homeScore} – {prediction.awayScore}</span>
            {isFinished && prediction.points === 3 && <span className="text-green-400">🎯 +3</span>}
            {isFinished && prediction.points === 1 && <span className="text-yellow-400">✅ +1</span>}
            {isFinished && prediction.points === 0 && <span className="text-red-400">❌ 0</span>}
          </div>
        ) : isFinished ? (
          <div className="px-4 py-1 text-xs text-gray-700">No pick</div>
        ) : null
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/matches/match-row.tsx
git commit -m "Extend MatchRow with optional prediction sub-row"
```

---

### Task 4: Wire up the matches page

**Files:**
- Modify: `app/matches/page.tsx`

**Interfaces:**
- Consumes:
  - `getSession(): Promise<SessionPayload | null>` from `@/lib/auth`
  - `isSameDayCT(kickoffUtc: string): boolean` from `@/lib/date-utils`
  - `PredictionData` from `@/components/matches/match-row`

- [ ] **Step 1: Replace the contents of `app/matches/page.tsx`**

```tsx
import { db } from '@/lib/db'
import { syncIfStale } from '@/lib/sync'
import { getSession } from '@/lib/auth'
import { isSameDayCT } from '@/lib/date-utils'
import { MatchRow, MatchRowData, PredictionData } from '@/components/matches/match-row'

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

  const session = await getSession()

  const { data: matches } = await db
    .from('matches')
    .select('id, home_team, away_team, home_crest, away_crest, kickoff_utc, deadline_utc, status, home_score, away_score, stage, group_name')
    .order('kickoff_utc', { ascending: true })

  let predictionMap = new Map<string, PredictionData>()
  if (session) {
    const { data: myPredictions } = await db
      .from('predictions')
      .select('match_id, home_score, away_score, points')
      .eq('user_id', session.userId)
    predictionMap = new Map(
      (myPredictions ?? []).map((p) => [
        p.match_id,
        { homeScore: p.home_score, awayScore: p.away_score, points: p.points },
      ])
    )
  }

  const allMatches = matches ?? []

  const toRowData = (m: (typeof allMatches)[number]): MatchRowData => ({
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

  const getPrediction = (id: string): PredictionData | null | undefined =>
    session ? (predictionMap.get(id) ?? null) : undefined

  const todayMatches = allMatches.filter((m) => isSameDayCT(m.kickoff_utc))

  const byStage = new Map<string, (typeof allMatches)[number][]>()
  for (const m of allMatches) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push(m)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Matches</h1>
      </div>

      {todayMatches.length > 0 && (
        <div>
          <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-widest sticky top-0 bg-gray-950/90 backdrop-blur">
            Today
          </div>
          {todayMatches.map((m) => (
            <MatchRow key={m.id} match={toRowData(m)} prediction={getPrediction(m.id)} />
          ))}
        </div>
      )}

      {STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => (
        <div key={stage}>
          <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-widest sticky top-0 bg-gray-950/90 backdrop-blur">
            {STAGE_LABELS[stage]}
          </div>
          {byStage.get(stage)!.map((m) => (
            <MatchRow key={m.id} match={toRowData(m)} prediction={getPrediction(m.id)} />
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass (including the new date-utils tests)

- [ ] **Step 4: Start the dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:3000/matches` and confirm:
- A "Today" section appears at the top (if today has matches)
- Each match row shows a compact prediction sub-row below it
- Finished matches with a pick show the correct colored icon (🎯 / ✅ / ❌)
- Finished matches with no pick show "No pick"
- Upcoming matches with a pick show "My pick: X – Y" with no icon
- Upcoming matches without a pick show nothing below the row
- Stage sections below still render all matches correctly

- [ ] **Step 5: Commit**

```bash
git add app/matches/page.tsx
git commit -m "Add Today section and prediction sub-rows to matches page"
```
