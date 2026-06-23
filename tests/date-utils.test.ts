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
