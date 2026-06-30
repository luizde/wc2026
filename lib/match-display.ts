export interface MatchScoreData {
  homeScore: number | null
  awayScore: number | null
  homeScoreEt: number | null
  awayScoreEt: number | null
  homeScorePens: number | null
  awayScorePens: number | null
  scoreDuration: string | null
}

export interface MatchScoreDisplay {
  /** Displayed score — ET score when ET goals exist, otherwise 90-min score */
  displayHome: number
  displayAway: number
  /** Penalty shootout result (null if no penalties) */
  pensHome: number | null
  pensAway: number | null
  /** True when ET goals changed the score vs. the 90-min result */
  hasEtGoals: boolean
  /** "FT" | "AET" | "PENS" */
  label: string
  /** 90-min score — differs from display only when hasEtGoals is true */
  regularHome: number
  regularAway: number
}

/**
 * Returns null when the match is not yet finished (homeScore or awayScore is null).
 * The returned display reflects the rules:
 *   - Scoring is always based on the 90-min result (homeScore / awayScore).
 *   - Display shows the ET score when ET goals were scored (hasEtGoals = true),
 *     plus an asterisk is expected in the UI.
 *   - Penalty results are shown in parentheses separately.
 */
export function getMatchScoreDisplay(m: MatchScoreData): MatchScoreDisplay | null {
  if (m.homeScore === null || m.awayScore === null) return null

  const isET = m.scoreDuration === 'EXTRA_TIME'
  const isPens = m.scoreDuration === 'PENALTY_SHOOTOUT'
  const etHome = m.homeScoreEt ?? 0
  const etAway = m.awayScoreEt ?? 0
  const hasEtGoals = etHome > 0 || etAway > 0

  return {
    displayHome: isET || isPens ? m.homeScore + etHome : m.homeScore,
    displayAway: isET || isPens ? m.awayScore + etAway : m.awayScore,
    pensHome: isPens ? (m.homeScorePens ?? null) : null,
    pensAway: isPens ? (m.awayScorePens ?? null) : null,
    hasEtGoals,
    label: isPens ? 'PENS' : isET ? 'AET' : 'FT',
    regularHome: m.homeScore,
    regularAway: m.awayScore,
  }
}
