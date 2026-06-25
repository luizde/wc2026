export function computePoints(
  predicted: { home: number; away: number },
  actual: { home: number; away: number }
): number {
  if (predicted.home === actual.home && predicted.away === actual.away) return 3
  const predictedOutcome = Math.sign(predicted.home - predicted.away)
  const actualOutcome = Math.sign(actual.home - actual.away)
  if (predictedOutcome === actualOutcome) return 1
  return 0
}

// CDT = UTC-5 (applies June–July for the full tournament)
const CDT_OFFSET_MS = 5 * 60 * 60 * 1000

export function computeDeadline(kickoffUtc: Date): Date {
  // Find the match day in CT by offsetting the kickoff time
  const kickoffInCT = new Date(kickoffUtc.getTime() - CDT_OFFSET_MS)

  // Noon CT on that day = 17:00 UTC
  const noonCT = new Date(Date.UTC(
    kickoffInCT.getUTCFullYear(),
    kickoffInCT.getUTCMonth(),
    kickoffInCT.getUTCDate(),
    17, 0, 0, 0
  ))

  const twoHoursBefore = new Date(kickoffUtc.getTime() - 2 * 60 * 60 * 1000)
  return noonCT < twoHoursBefore ? noonCT : twoHoursBefore
}

// A stage locks 1 hour before its earliest kickoff. Pass every kickoff in the
// stage (including TBD matches, which still have scheduled times) so the lock
// instant doesn't drift when the earliest match resolves last. With no
// kickoffs the result is the epoch, i.e. effectively locked.
export function computePhaseDeadline(kickoffsUtc: string[]): Date {
  const min = kickoffsUtc.reduce<Date | null>((m, k) => {
    const d = new Date(k)
    return m === null || d < m ? d : m
  }, null)
  return min ? new Date(min.getTime() - 60 * 60 * 1000) : new Date(0)
}
