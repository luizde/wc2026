// tests/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must set env before importing auth
vi.stubEnv('JWT_SECRET', 'test-secret-that-is-long-enough-32chars!')

// Mock next/headers since it's a Next.js runtime module
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))

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
