import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { syncIfStale } from '@/lib/sync'

export const dynamic = 'force-dynamic'

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Group Stage',
  LAST_32: 'Round of 32',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarterfinals',
  SEMI_FINALS: 'Semifinals',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
}

export default async function UserHistoryPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username: rawUsername } = await params
  const username = decodeURIComponent(rawUsername).toLowerCase()

  await syncIfStale()

  const { data: user } = await db
    .from('users')
    .select('id, username')
    .ilike('username', username)
    .single()

  if (!user) notFound()

  const { data: predictions } = await db
    .from('predictions')
    .select('match_id, home_score, away_score, points')
    .eq('user_id', user.id)

  const { data: matches } = await db
    .from('matches')
    .select('id, home_team, away_team, home_crest, away_crest, stage, group_name, kickoff_utc, status, home_score, away_score')
    .order('kickoff_utc', { ascending: true })

  const predMap = new Map(
    (predictions ?? []).map((p) => [p.match_id, p])
  )

  const totalPoints = (predictions ?? []).reduce((s, p) => s + (p.points ?? 0), 0)

  type Match = NonNullable<typeof matches>[number]

  const byStage = new Map<string, Match[]>()
  for (const m of matches ?? []) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push(m)
  }

  function groupByGroup(stageMatches: Match[]): Map<string | null, Match[]> {
    const grouped = new Map<string | null, Match[]>()
    for (const m of stageMatches) {
      const key = m.group_name ?? null
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(m)
    }
    return grouped
  }

  const STAGE_ORDER = Object.keys(STAGE_LABELS)

  const now = new Date()

  // Phase deadline = earliest kickoff in the stage - 1 hour
  const minKickoffPerStage = new Map<string, Date>()
  for (const m of matches ?? []) {
    const k = new Date(m.kickoff_utc)
    const existing = minKickoffPerStage.get(m.stage)
    if (!existing || k < existing) minKickoffPerStage.set(m.stage, k)
  }
  const phaseDeadlines = new Map<string, Date>()
  for (const [stage, minKickoff] of minKickoffPerStage) {
    phaseDeadlines.set(stage, new Date(minKickoff.getTime() - 60 * 60 * 1000))
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">{user.username}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{totalPoints} total points</p>
      </div>

      {STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => {
        const stageMatches = byStage.get(stage)!
        const groups = groupByGroup(stageMatches)
        const isGroupStage = stage === 'GROUP_STAGE'

        return (
          <div key={stage}>
            <div className="px-4 pt-5 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-widest">
              {STAGE_LABELS[stage]}
            </div>

            {[...groups.entries()].sort(([a], [b]) => (a ?? '').localeCompare(b ?? '')).map(([groupName, groupMatches]) => (
              <div key={groupName ?? '_'}>
                {isGroupStage && groupName && (
                  <div className="px-4 pt-6 pb-0.5 text-xs text-gray-600 font-medium">
                    {groupName}
                  </div>
                )}
                {groupMatches.map((match) => {
                  const pred = predMap.get(match.id)
                  const isPast = now >= (phaseDeadlines.get(match.stage) ?? new Date(0))
                  const showPred = isPast && pred

                  let ptsBadge: React.ReactNode = null
                  if (showPred && match.status === 'FINISHED') {
                    if (pred.points === 3) ptsBadge = <span className="text-xs font-bold text-emerald-400 w-8 text-right">3 pt</span>
                    else if (pred.points === 1) ptsBadge = <span className="text-xs font-bold text-yellow-400 w-8 text-right">1 pt</span>
                    else ptsBadge = <span className="text-xs font-bold text-gray-600 w-8 text-right">0 pt</span>
                  } else if (showPred) {
                    ptsBadge = <span className="w-8" />
                  } else {
                    ptsBadge = <span className="w-8" />
                  }

                  return (
                    <div key={match.id} className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/50 text-sm">
                      {match.home_crest && (
                        <img src={match.home_crest} alt={match.home_team} className="w-5 h-5 object-contain flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate">{match.home_team}</span>

                      <div className="text-center min-w-[90px] flex-shrink-0">
                        {match.status === 'FINISHED' && (
                          <div className="font-bold tabular-nums text-white">
                            {match.home_score} – {match.away_score}
                          </div>
                        )}
                        {showPred ? (
                          <div className="text-xs text-gray-400 mt-0.5 tabular-nums">
                            pick: {pred.home_score}–{pred.away_score}
                          </div>
                        ) : isPast ? (
                          <div className="text-xs text-gray-700">no pick</div>
                        ) : null}
                      </div>

                      <span className="flex-1 truncate text-right">{match.away_team}</span>
                      {match.away_crest && (
                        <img src={match.away_crest} alt={match.away_team} className="w-5 h-5 object-contain flex-shrink-0" />
                      )}
                      {ptsBadge}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
