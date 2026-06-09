# World Cup 2026 Pick'em — Design Spec

**Date:** 2026-06-09
**Status:** Approved

---

## Overview

A mobile-first web app for ~12 friends to predict the score of every 2026 FIFA World Cup match. Users earn points based on 90-minute results (3 pts exact score, 1 pt correct outcome, 0 pts wrong). A leaderboard tracks totals across all 104 matches. One admin manages the group; everyone else joins via invite code.

---

## 1. Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | Fullstack, free Vercel hosting |
| Database | Supabase PostgreSQL (free tier) | Relational queries, zero cost |
| Styling | Tailwind CSS | Mobile-first, fast to build |
| Match data | football-data.org v4 | Free, WC included permanently |
| Hosting | Vercel free tier | Zero-config deploys from GitHub |

**Rendering split:**
- **Server Components** — leaderboard, match list, user prediction history, match detail/comparison, admin panel shell
- **Client Components** — prediction entry form (batch per round), login/register form, admin action buttons
- **Server Actions** — all mutations: submit predictions, admin overrides, user management, force sync

The football-data.org API token and Supabase credentials never leave the server. No client SDK in the browser.

---

## 2. Data Model

```sql
users
  id            UUID (PK)
  username      TEXT UNIQUE NOT NULL
  password_hash TEXT NOT NULL           -- bcrypt
  is_admin      BOOLEAN DEFAULT false
  created_at    TIMESTAMPTZ DEFAULT now()

invite_codes
  id         UUID (PK)
  code       TEXT UNIQUE NOT NULL
  is_active  BOOLEAN DEFAULT true
  created_at TIMESTAMPTZ DEFAULT now()

matches
  id           UUID (PK)
  external_id  INTEGER UNIQUE NOT NULL   -- from football-data.org
  home_team    TEXT NOT NULL
  away_team    TEXT NOT NULL
  home_crest   TEXT                      -- nullable, URL from API
  away_crest   TEXT                      -- nullable, URL from API
  stage        TEXT NOT NULL             -- GROUP_STAGE | ROUND_OF_32 | ROUND_OF_16
                                         -- QUARTER_FINALS | SEMI_FINALS | THIRD_PLACE | FINAL
  group_name   TEXT                      -- nullable, e.g. "Group A"
  matchday     INTEGER                   -- nullable
  kickoff_utc  TIMESTAMPTZ NOT NULL
  deadline_utc TIMESTAMPTZ NOT NULL      -- min(noon CT on match day, kickoff - 2h)
  status       TEXT NOT NULL             -- SCHEDULED | LIVE | IN_PLAY | PAUSED
                                         -- FINISHED | POSTPONED | CANCELLED | SUSPENDED
  home_score   INTEGER                   -- nullable, set when FINISHED
  away_score   INTEGER                   -- nullable, set when FINISHED
  updated_at   TIMESTAMPTZ DEFAULT now()

predictions
  id         UUID (PK)
  user_id    UUID NOT NULL REFERENCES users(id)
  match_id   UUID NOT NULL REFERENCES matches(id)
  home_score INTEGER NOT NULL
  away_score INTEGER NOT NULL
  points     INTEGER                     -- nullable; set when match finishes
  created_at TIMESTAMPTZ DEFAULT now()
  updated_at TIMESTAMPTZ DEFAULT now()
  UNIQUE(user_id, match_id)

sync_meta                               -- singleton row (id = 1)
  id             INTEGER DEFAULT 1 PRIMARY KEY
  last_synced_at TIMESTAMPTZ
```

**Deadline calculation** (computed at sync time, stored on the `matches` row):
```
deadline_utc = MIN(
  kickoff_day at 17:00 UTC,   -- noon CT = 17:00 UTC during CDT (Jun–Jul)
  kickoff_utc - INTERVAL '2 hours'
)
```

**Scoring** (written to `predictions.points` during sync, when a match transitions to FINISHED):
```
predicted == actual              → 3 pts
sign(pred_home - pred_away)
  == sign(actual_home - actual_away)  → 1 pt
otherwise                        → 0 pts
```

---

## 3. Routes & Views

All views are mobile-first. Navigation is a bottom tab bar (Leaderboard, Predictions, Matches, Admin — Admin tab only shown to admins).

| Route | Rendering | Description |
|---|---|---|
| `/` | — | Redirects to `/leaderboard` (authed) or `/login` |
| `/login` | Client Component | Login + registration on one page (tabbed). Registration: invite code → username → password. |
| `/leaderboard` | Server Component | Default home. Rank, username, points, exact/correct/wrong/missing counts. Username links to `/users/[username]`. |
| `/predictions/[stage]` | Client Component | Batch prediction entry form for one round. Round tabs at top. |
| `/matches` | Server Component | All rounds, collapsed/expanded sections. |
| `/matches/[matchId]` | Server Component | Before deadline: shows current user's prediction only. After deadline: all users' predictions side by side with points. |
| `/users/[username]` | Server Component | Full prediction history for any user, grouped by round. Visible to everyone. |
| `/admin` | Server Component + Client Components | Force sync, invite codes, user management, result overrides. Non-admins are redirected to `/leaderboard`. |

**My Predictions (`/predictions/[stage]`) detail:**
- Group Stage (72 matches) sub-grouped by group letter (A–L)
- Score inputs rendered as editable for unlocked matches, read-only for locked ones
- Local React state holds edits; "Save all" button submits the full round via Server Action
- Server Action upserts predictions (`ON CONFLICT DO UPDATE`) after re-checking deadlines server-side
- Matches with both teams TBD are hidden until the API confirms them

---

## 4. Auth

- Registration: validate invite code → unique username check → bcrypt hash password → create user row → set JWT in HTTP-only cookie
- Login: username lookup → bcrypt verify → set JWT cookie (30-day expiry)
- JWT payload: `{ userId, isAdmin }` — self-contained, no DB hit per request
- All Server Components and Server Actions decode the JWT cookie to get identity
- No email, no password recovery flow — admin resets passwords manually via admin panel
- Password minimum: 1 character (empty passwords rejected)

---

## 5. Sync & Scoring Flow

```
syncIfStale():
  1. Read sync_meta.last_synced_at
  2. If < 10 min ago → return (serve from DB)
  3. Fetch GET /v4/competitions/WC/matches from football-data.org
  4. For each match in response:
     a. Upsert matches row (status, scores, teams, crests, kickoff, deadline)
     b. If status just became FINISHED:
        - For each prediction on this match:
            points = computePoints(prediction, actual)
        - Write points to predictions rows
  5. Update sync_meta.last_synced_at = now()
  6. On fetch error: log warning, skip step 4–5, serve stale data
```

`syncIfStale()` is called at the top of any Server Component that displays results or the leaderboard. The admin "Force Sync" button calls the same function unconditionally (bypasses the TTL check).

Admin result override: writes directly to the `matches` row then re-scores all predictions for that match — same `computePoints()` logic as sync.

---

## 6. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| football-data.org unreachable | Log warning, serve stale DB data, `last_synced_at` not updated (retries next load) |
| Prediction submitted past deadline | Server Action rejects it; client also renders form read-only past deadline |
| Duplicate prediction | `ON CONFLICT DO UPDATE` — edit overwrites existing row safely |
| Knockout match with TBD teams | Match not shown in predictions form until both teams are populated by sync |
| Missing prediction at match time | `points` stays NULL, treated as 0 in leaderboard `SUM` |
| Admin overrides result | Re-scores all predictions for that match immediately |

---

## 7. Testing

| Type | Tool | Coverage |
|---|---|---|
| Unit | Vitest | `computePoints()`, `computeDeadline()`, JWT encode/decode |
| Integration | Vitest + Supabase local | Prediction submit Server Action, sync flow with mocked football-data.org |
| E2E | Manual | Sufficient for a 12-user hobby project |

---

## 8. Deployment

1. Create Supabase project → get `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (service role key is used server-side only; bypasses RLS, which is correct here since we use custom JWT auth rather than Supabase Auth)
2. Create football-data.org account → get free API token
3. Push Next.js app to GitHub → connect to Vercel
4. Set env vars in Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_API_TOKEN`, `JWT_SECRET`
5. Run DB migrations (SQL files in `/db/migrations/`)
6. Seed initial admin user and first invite code via a one-time script
7. Share URL + invite code with friends

---

## 9. Out of Scope (MVP)

- Email / push notifications
- Multiple groups
- Player or tournament winner predictions
- Dark mode
- Internationalization (English only)
- Self-service password recovery
- Rate limiting
