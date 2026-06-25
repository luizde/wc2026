// app/predictions/[stage]/page.tsx
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { syncIfStale } from '@/lib/sync'
import { RoundTabs } from '@/components/predictions/round-tabs'
import { PredictionForm, MatchForForm } from '@/components/predictions/prediction-form'

export const dynamic = 'force-dynamic'

const STAGE_MAP: Record<string, string> = {
  'group-stage': 'GROUP_STAGE',
  'round-of-32': 'LAST_32',
  'round-of-16': 'LAST_16',
  'quarter-finals': 'QUARTER_FINALS',
  'semi-finals': 'SEMI_FINALS',
  'third-place': 'THIRD_PLACE',
  'final': 'FINAL',
}

export default async function PredictionsPage({
  params,
}: {
  params: Promise<{ stage: string }>
}) {
  const { stage: stageSlug } = await params
  const dbStage = STAGE_MAP[stageSlug]
  if (!dbStage) notFound()

  await syncIfStale()
  const session = await getSession()

  const { data: matches } = await db
    .from('matches')
    .select('id, home_team, away_team, home_crest, away_crest, group_name, kickoff_utc, deadline_utc')
    .eq('stage', dbStage)
    .not('home_team', 'eq', '')
    .not('away_team', 'eq', '')
    .order('kickoff_utc', { ascending: true })

  const matchIds = (matches ?? []).map((m) => m.id)
  const { data: predictions } = matchIds.length
    ? await db
        .from('predictions')
        .select('match_id, home_score, away_score')
        .eq('user_id', session!.userId)
        .in('match_id', matchIds)
    : { data: [] }

  const predMap = new Map(
    (predictions ?? []).map((p) => [p.match_id, { home: p.home_score, away: p.away_score }])
  )

  const now = new Date()
  const minKickoff = (matches ?? []).reduce<Date | null>((min, m) => {
    const k = new Date(m.kickoff_utc)
    return min === null || k < min ? k : min
  }, null)
  const phaseDeadline = minKickoff ? new Date(minKickoff.getTime() - 60 * 60 * 1000) : new Date(0)
  const phaseIsLocked = now >= phaseDeadline

  const formMatches: MatchForForm[] = (matches ?? []).map((m) => ({
    id: m.id,
    homeTeam: m.home_team,
    awayTeam: m.away_team,
    homeCrest: m.home_crest,
    awayCrest: m.away_crest,
    groupName: m.group_name,
    kickoffUtc: m.kickoff_utc,
    deadlineUtc: m.deadline_utc,
    existingHome: predMap.get(m.id)?.home ?? null,
    existingAway: predMap.get(m.id)?.away ?? null,
    isLocked: phaseIsLocked,
  }))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">My Predictions</h1>
      </div>
      <RoundTabs />
      {formMatches.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          No matches available yet for this round.
        </p>
      ) : (
        <PredictionForm matches={formMatches} stage={stageSlug} />
      )}
    </div>
  )
}
