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
})
