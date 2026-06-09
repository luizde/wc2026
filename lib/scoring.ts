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
