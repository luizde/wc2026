export interface FDTeam {
  // null until the knockout matchup is resolved
  name: string | null
  crest: string | null
}

export interface FDScore {
  fullTime: { home: number | null; away: number | null }
}

export interface FDMatch {
  id: number
  homeTeam: FDTeam
  awayTeam: FDTeam
  stage: string
  group: string | null
  matchday: number | null
  utcDate: string
  status: string
  score: FDScore
}

export async function fetchWCMatches(): Promise<FDMatch[]> {
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_TOKEN ?? '' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`football-data.org responded ${res.status}`)
  const data = await res.json()
  return data.matches as FDMatch[]
}
