import { db } from '@/lib/db'
import { syncIfStale } from '@/lib/sync'
import { MatchRow, MatchRowData } from '@/components/matches/match-row'

export const dynamic = 'force-dynamic'

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Group Stage',
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINALS: 'Quarterfinals',
  SEMI_FINALS: 'Semifinals',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
}

const STAGE_ORDER = Object.keys(STAGE_LABELS)

export default async function MatchesPage() {
  await syncIfStale()

  const { data: matches } = await db
    .from('matches')
    .select('id, home_team, away_team, home_crest, away_crest, kickoff_utc, deadline_utc, status, home_score, away_score, stage, group_name')
    .order('kickoff_utc', { ascending: true })

  const byStage = new Map<string, MatchRowData[]>()
  for (const m of matches ?? []) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push({
      id: m.id,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      homeCrest: m.home_crest,
      awayCrest: m.away_crest,
      kickoffUtc: m.kickoff_utc,
      status: m.status,
      homeScore: m.home_score,
      awayScore: m.away_score,
      deadlineUtc: m.deadline_utc,
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Matches</h1>
      </div>
      {STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => (
        <div key={stage}>
          <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-widest sticky top-0 bg-gray-950/90 backdrop-blur">
            {STAGE_LABELS[stage]}
          </div>
          {byStage.get(stage)!.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </div>
      ))}
    </div>
  )
}
