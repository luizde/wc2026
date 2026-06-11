// tests/sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough-32chars!')
vi.stubEnv('SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')
vi.stubEnv('FOOTBALL_DATA_API_TOKEN', 'test-token')

// Mock Supabase — factory uses no outer variables (hoisting-safe)
vi.mock('@/lib/db', () => {
  const mockFrom = vi.fn()
  return { db: { from: mockFrom } }
})

// Mock football-data client
vi.mock('@/lib/football-data', () => ({
  fetchWCMatches: vi.fn(),
}))

import { syncIfStale } from '@/lib/sync'
import { fetchWCMatches } from '@/lib/football-data'
import { db } from '@/lib/db'

const mockFrom = vi.mocked(db.from)
const mockFetch = vi.mocked(fetchWCMatches)

function makeMockChain(returnValue: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(returnValue),
    upsert: vi.fn(),
    update: vi.fn(),
  }
  // Make all methods except single return the chain itself for fluent chaining
  for (const key of Object.keys(chain)) {
    if (key !== 'single') {
      chain[key].mockReturnValue(chain)
    }
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
    mockFrom.mockReturnValue(chain as never)

    await syncIfStale()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches when last_synced_at is stale (> 10 min ago)', async () => {
    const staleTime = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const chain = makeMockChain({ data: { last_synced_at: staleTime }, error: null })
    mockFrom.mockReturnValue(chain as never)
    mockFetch.mockResolvedValue([])

    await syncIfStale()

    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('does not throw when football-data.org is unreachable', async () => {
    const staleTime = new Date(0).toISOString()
    const chain = makeMockChain({ data: { last_synced_at: staleTime }, error: null })
    mockFrom.mockReturnValue(chain as never)
    mockFetch.mockRejectedValue(new Error('network error'))

    await expect(syncIfStale()).resolves.not.toThrow()
  })

  it('stores IN_PLAY when API says FINISHED but scores are null', async () => {
    const staleTime = new Date(0).toISOString()
    const metaChain = makeMockChain({ data: { last_synced_at: staleTime }, error: null })
    const existingChain = makeMockChain({ data: null, error: null })
    const upsertChain = makeMockChain({ data: { id: 'match-uuid' }, error: null })
    const metaUpsertChain = makeMockChain({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(metaChain as never)    // sync_meta select
      .mockReturnValueOnce(existingChain as never) // matches select (existing)
      .mockReturnValueOnce(upsertChain as never)  // matches upsert
      .mockReturnValueOnce(metaUpsertChain as never) // sync_meta upsert

    mockFetch.mockResolvedValue([{
      id: 1,
      utcDate: '2026-06-11T19:00:00Z',
      status: 'FINISHED',
      stage: 'GROUP_STAGE',
      group: 'GROUP_A',
      matchday: 1,
      homeTeam: { name: 'Mexico', crest: null },
      awayTeam: { name: 'South Africa', crest: null },
      score: { fullTime: { home: null, away: null } },
    }])

    await syncIfStale()

    const upsertCall = upsertChain.upsert.mock.calls[0][0]
    expect(upsertCall.status).toBe('IN_PLAY')
    expect(upsertCall.home_score).toBeNull()
    expect(upsertCall.away_score).toBeNull()
  })

  it('stores FINISHED and scores predictions when API provides scores', async () => {
    const staleTime = new Date(0).toISOString()
    const metaChain = makeMockChain({ data: { last_synced_at: staleTime }, error: null })
    const existingChain = makeMockChain({ data: { id: 'match-uuid', status: 'IN_PLAY' }, error: null })
    const upsertChain = makeMockChain({ data: { id: 'match-uuid' }, error: null })
    const predsChain = makeMockChain({ data: [], error: null })
    const metaUpsertChain = makeMockChain({ data: null, error: null })

    mockFrom
      .mockReturnValueOnce(metaChain as never)
      .mockReturnValueOnce(existingChain as never)
      .mockReturnValueOnce(upsertChain as never)
      .mockReturnValueOnce(predsChain as never)   // scorePredictions select
      .mockReturnValueOnce(metaUpsertChain as never)

    mockFetch.mockResolvedValue([{
      id: 1,
      utcDate: '2026-06-11T19:00:00Z',
      status: 'FINISHED',
      stage: 'GROUP_STAGE',
      group: 'GROUP_A',
      matchday: 1,
      homeTeam: { name: 'Mexico', crest: null },
      awayTeam: { name: 'South Africa', crest: null },
      score: { fullTime: { home: 2, away: 1 } },
    }])

    await syncIfStale()

    const upsertCall = upsertChain.upsert.mock.calls[0][0]
    expect(upsertCall.status).toBe('FINISHED')
    expect(upsertCall.home_score).toBe(2)
    expect(upsertCall.away_score).toBe(1)
  })
})
