// tests/auth-actions.test.ts
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
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { registerAction, loginAction } from '@/actions/auth-actions'
import { db } from '@/lib/db'

const mockFrom = vi.mocked(db.from)

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn(),
    ...overrides,
  }
  for (const key of Object.keys(chain)) {
    if (key !== 'single') {
      chain[key].mockReturnValue(chain)
    }
  }
  return chain
}

describe('registerAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fails with invalid invite code', async () => {
    mockFrom.mockReturnValue(makeChain() as never)
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
      makeChain({ single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }) }) as never
    )
    const result = await loginAction({ username: 'nobody', password: 'pw' })
    expect(result.error).toMatch(/invalid/i)
  })
})
