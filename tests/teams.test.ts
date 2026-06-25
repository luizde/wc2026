import { describe, it, expect } from 'vitest'
import { displayTeamName } from '@/lib/teams'

describe('displayTeamName', () => {
  it('returns the team name when it is resolved', () => {
    expect(displayTeamName('Brazil')).toBe('Brazil')
  })

  it('returns "TBD" when the team is not yet resolved (empty string)', () => {
    expect(displayTeamName('')).toBe('TBD')
  })
})
