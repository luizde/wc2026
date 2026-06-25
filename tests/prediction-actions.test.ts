// tests/prediction-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough-32chars!')
vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')

vi.mock('@/lib/db', () => {
  const mockFrom = vi.fn()
  return { db: { from: mockFrom } }
})
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue(null),
}))

import { submitPredictionsAction } from '@/actions/prediction-actions'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

const mockFrom = vi.mocked(db.from)
const mockGetSession = vi.mocked(getSession)

const FUTURE_KICKOFF = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
const PAST_KICKOFF = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

function mockTwoQueries(
  stageData: { id: string; stage: string; home_team?: string; away_team?: string }[],
  kickoffData: { stage: string; kickoff_utc: string }[]
) {
  // Default to resolved teams so existing deadline-focused tests stay valid;
  // tests exercising TBD locking pass home_team/away_team explicitly.
  const withTeams = stageData.map((m) => ({ home_team: 'Home', away_team: 'Away', ...m }))
  const stageChain = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: withTeams, error: null }),
  }
  const kickoffChain = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: kickoffData, error: null }),
  }
  mockFrom.mockReturnValueOnce(stageChain as never).mockReturnValueOnce(kickoffChain as never)
}

describe('submitPredictionsAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    const result = await submitPredictionsAction([
      { matchId: 'match-1', homeScore: 1, awayScore: 0 },
    ])
    expect(result.error).toMatch(/not authenticated/i)
  })

  it('rejects predictions when phase is locked (first match kicked off > 1h ago)', async () => {
    mockGetSession.mockResolvedValue({ userId: 'user-1', isAdmin: false })
    mockTwoQueries(
      [{ id: 'match-1', stage: 'GROUP_STAGE' }],
      [{ stage: 'GROUP_STAGE', kickoff_utc: PAST_KICKOFF }]
    )

    const result = await submitPredictionsAction([
      { matchId: 'match-1', homeScore: 1, awayScore: 0 },
    ])
    expect(result.skipped).toContain('match-1')
    expect(result.saved).toBe(0)
  })

  it('rejects predictions for a match with a TBD team, even when the phase is open', async () => {
    mockGetSession.mockResolvedValue({ userId: 'user-1', isAdmin: false })
    mockTwoQueries(
      [{ id: 'match-1', stage: 'LAST_32', home_team: 'Brazil', away_team: '' }],
      [{ stage: 'LAST_32', kickoff_utc: FUTURE_KICKOFF }]
    )

    const result = await submitPredictionsAction([
      { matchId: 'match-1', homeScore: 1, awayScore: 0 },
    ])
    expect(result.skipped).toContain('match-1')
    expect(result.saved).toBe(0)
  })

  it('locks a later match once the stage\'s earliest match has passed its deadline', async () => {
    // Submitting a future match, but an earlier match in the same stage already
    // kicked off > 1h ago — the phase deadline is governed by the earliest match.
    mockGetSession.mockResolvedValue({ userId: 'user-1', isAdmin: false })
    mockTwoQueries(
      [{ id: 'match-late', stage: 'GROUP_STAGE', home_team: 'Mexico', away_team: 'France' }],
      [
        { stage: 'GROUP_STAGE', kickoff_utc: PAST_KICKOFF },
        { stage: 'GROUP_STAGE', kickoff_utc: FUTURE_KICKOFF },
      ]
    )

    const result = await submitPredictionsAction([
      { matchId: 'match-late', homeScore: 1, awayScore: 0 },
    ])
    expect(result.skipped).toContain('match-late')
    expect(result.saved).toBe(0)
  })

  it('accepts predictions when phase is not yet locked', async () => {
    mockGetSession.mockResolvedValue({ userId: 'user-1', isAdmin: false })
    mockTwoQueries(
      [{ id: 'match-1', stage: 'GROUP_STAGE' }],
      [{ stage: 'GROUP_STAGE', kickoff_utc: FUTURE_KICKOFF }]
    )
    const upsertChain = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }
    mockFrom.mockReturnValueOnce(upsertChain as never)

    const result = await submitPredictionsAction([
      { matchId: 'match-1', homeScore: 1, awayScore: 0 },
    ])
    expect(result.saved).toBe(1)
    expect(result.skipped).toHaveLength(0)
  })
})
