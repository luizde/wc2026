# Matches Page: Today Section + Prediction Sub-row

**Date:** 2026-06-23
**Branch:** feat/matches-today-prediction-subrow

---

## Summary

Two UI additions to the matches page. No database schema changes. Pure read, pure display.

1. **Today section** — a new section pinned above the existing stage groups showing only today's matches, so users can quickly see who's playing (or who played) without scrolling through the full list.
2. **Prediction sub-row** — below every match row in every section (including Today), show the current user's predicted score and the red/yellow/green outcome icon (for finished matches).

---

## Data Fetching

**File:** `app/matches/page.tsx`

Two additions to the existing server component:

1. Call `getSession()` to obtain `session.userId` — same pattern already used on the match detail page.
2. One additional Supabase query after the matches fetch:
   ```ts
   db.from('predictions')
     .select('match_id, home_score, away_score, points')
     .eq('user_id', session.userId)
   ```
   Build the result into `Map<matchId, prediction>` for O(1) lookup per row. If `session` is null (middleware should prevent this, but defensively), skip the predictions query and use an empty map — sub-rows simply won't render.

**Today filter:**
```ts
const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
const todayMatches = (matches ?? []).filter(m =>
  new Date(m.kickoff_utc).toLocaleDateString('en-US', { timeZone: 'America/Chicago' }) === todayStr
)
```
"Today" is defined in CT (`America/Chicago`) to match the deadline timezone used throughout the app.

---

## Today Section

**Rendered above stage groups, only when `todayMatches.length > 0`.**

- Header: `"Today"` — same sticky style as existing stage headers (`px-4 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-widest sticky top-0 bg-gray-950/90 backdrop-blur`).
- Renders the same `<MatchRow>` components as the stage sections, with the prediction prop passed in.
- Matches that appear in Today also remain in their stage section below — intentional duplication so stage groupings stay complete.

---

## `MatchRow` Component Changes

**File:** `components/matches/match-row.tsx`

### New prop

```ts
prediction?: {
  homeScore: number
  awayScore: number
  points: number | null
} | null
```

### Structure change

`border-b border-gray-800/50` moves from the `<Link>` to a new wrapping `<div>`, so the prediction sub-row sits inside the border:

```
<div border-b>
  <Link>   ← existing match row, visually unchanged
  <div>    ← new prediction sub-row (conditional)
</div>
```

### Prediction sub-row rendering (`px-4 py-1 text-xs`)

| Condition | Display |
|---|---|
| Finished, points = 3 | `My pick: H – A` + `🎯 +3` in green |
| Finished, points = 1 | `My pick: H – A` + `✅ +1` in yellow |
| Finished, points = 0 | `My pick: H – A` + `❌ 0` in red |
| Not finished, has prediction | `My pick: H – A` in gray (no icon) |
| Finished, no prediction | `No pick` in dark gray |
| Not finished, no prediction | Nothing rendered |

"Finished" = `match.status === 'FINISHED'`. Points come from `predictions.points` (already computed during sync — no on-the-fly calculation needed).

---

## What Does Not Change

- Database schema — no new columns or tables.
- Scoring logic — predictions and points are read-only here.
- Stage section structure — same grouping, same order, same headers.
- Match row visual for the match itself — teams, crests, score/time display unchanged.
- Admin and other pages — no changes outside `app/matches/page.tsx` and `components/matches/match-row.tsx`.
