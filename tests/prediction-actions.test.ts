// tests/prediction-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough-32chars!')
vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')

vi.mock('@/lib/db', () => {
  const mockFrom = vi.fn()
  return { db: { from: mockFrom } }
})
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

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString()

describe('submitPredictionsAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    const result = await submitPredictionsAction([
      { matchId: 'match-1', homeScore: 1, awayScore: 0 },
    ])
    expect(result.error).toMatch(/not authenticated/i)
  })

  it('rejects predictions for matches past their deadline', async () => {
    mockGetSession.mockResolvedValue({ userId: 'user-1', isAdmin: false })
    const chain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'match-1', deadline_utc: PAST }],
        error: null,
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }
    mockFrom.mockReturnValue(chain as never)

    const result = await submitPredictionsAction([
      { matchId: 'match-1', homeScore: 1, awayScore: 0 },
    ])
    expect(result.skipped).toContain('match-1')
    expect(result.saved).toBe(0)
  })
})
