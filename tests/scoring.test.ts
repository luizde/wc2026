import { describe, it, expect } from 'vitest'
import { computePoints, computeDeadline, computePhaseDeadline } from '@/lib/scoring'

describe('computePoints', () => {
  it('returns 3 for exact score', () => {
    expect(computePoints({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(3)
  })

  it('returns 3 for exact 0-0 draw', () => {
    expect(computePoints({ home: 0, away: 0 }, { home: 0, away: 0 })).toBe(3)
  })

  it('returns 1 for correct home win with wrong score', () => {
    expect(computePoints({ home: 3, away: 1 }, { home: 2, away: 0 })).toBe(1)
  })

  it('returns 1 for correct away win with wrong score', () => {
    expect(computePoints({ home: 0, away: 2 }, { home: 1, away: 3 })).toBe(1)
  })

  it('returns 1 for correct draw with wrong score', () => {
    expect(computePoints({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe(1)
  })

  it('returns 0 for wrong result (predicted home win, actual away win)', () => {
    expect(computePoints({ home: 2, away: 0 }, { home: 0, away: 1 })).toBe(0)
  })

  it('returns 0 for wrong result (predicted draw, actual home win)', () => {
    expect(computePoints({ home: 1, away: 1 }, { home: 2, away: 0 })).toBe(0)
  })
})

describe('computeDeadline', () => {
  it('returns noon CT (17:00 UTC) for a late kickoff (8 PM CT)', () => {
    // June 11, 8 PM CT = June 12 01:00 UTC
    const kickoff = new Date('2026-06-12T01:00:00Z')
    const deadline = computeDeadline(kickoff)
    // Noon CT on June 11 = June 11 17:00 UTC
    expect(deadline.toISOString()).toBe('2026-06-11T17:00:00.000Z')
  })

  it('returns 2h before kickoff for an early kickoff (10 AM CT)', () => {
    // June 11, 10 AM CT = June 11 15:00 UTC
    const kickoff = new Date('2026-06-11T15:00:00Z')
    const deadline = computeDeadline(kickoff)
    // 2h before = 13:00 UTC; noon CT = 17:00 UTC → min is 13:00
    expect(deadline.toISOString()).toBe('2026-06-11T13:00:00.000Z')
  })

  it('returns noon CT for a standard 3 PM CT kickoff', () => {
    // June 11, 3 PM CT = June 11 20:00 UTC
    const kickoff = new Date('2026-06-11T20:00:00Z')
    const deadline = computeDeadline(kickoff)
    // Noon CT = 17:00 UTC; 2h before = 18:00 UTC → min is 17:00
    expect(deadline.toISOString()).toBe('2026-06-11T17:00:00.000Z')
  })
})

describe('computePhaseDeadline', () => {
  it('returns 1 hour before the earliest kickoff in the stage', () => {
    const deadline = computePhaseDeadline([
      '2026-06-30T01:00:00Z',
      '2026-06-28T19:00:00Z', // earliest
      '2026-06-29T17:00:00Z',
    ])
    expect(deadline.toISOString()).toBe('2026-06-28T18:00:00.000Z')
  })

  it('is independent of array order', () => {
    const deadline = computePhaseDeadline([
      '2026-06-28T19:00:00Z',
      '2026-06-30T01:00:00Z',
    ])
    expect(deadline.toISOString()).toBe('2026-06-28T18:00:00.000Z')
  })

  it('returns the epoch (effectively locked) when there are no kickoffs', () => {
    expect(computePhaseDeadline([]).getTime()).toBe(0)
  })
})
