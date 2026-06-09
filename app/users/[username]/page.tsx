import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { syncIfStale } from '@/lib/sync'

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

export default async function UserHistoryPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username: rawUsername } = await params
  const username = decodeURIComponent(rawUsername)

  await syncIfStale()

  const { data: user } = await db
    .from('users')
    .select('id, username')
    .eq('username', username)
    .single()

  if (!user) notFound()

  const { data: predictions } = await db
    .from('predictions')
    .select('match_id, home_score, away_score, points')
    .eq('user_id', user.id)

  const { data: matches } = await db
    .from('matches')
    .select('id, home_team, away_team, home_crest, away_crest, stage, kickoff_utc, deadline_utc, status, home_score, away_score')
    .order('kickoff_utc', { ascending: true })

  const predMap = new Map(
    (predictions ?? []).map((p) => [p.match_id, p])
  )

  const totalPoints = (predictions ?? []).reduce((s, p) => s + (p.points ?? 0), 0)

  const byStage = new Map<string, typeof matches>()
  for (const m of matches ?? []) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push(m)
  }

  const STAGE_ORDER = Object.keys(STAGE_LABELS)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">{user.username}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{totalPoints} total points</p>
      </div>

      {STAGE_ORDER.filter((s) => byStage.has(s)).map((stage) => (
        <div key={stage}>
          <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-widest">
            {STAGE_LABELS[stage]}
          </div>
          {byStage.get(stage)!.map((match) => {
            const pred = predMap.get(match.id)
            const isPast = new Date() >= new Date(match.deadline_utc)
            const showPred = isPast && pred

            return (
              <div key={match.id} className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/50 text-sm">
                {match.home_crest && (
                  <img src={match.home_crest} alt={match.home_team} className="w-5 h-5 object-contain" />
                )}
                <span className="flex-1 truncate">{match.home_team}</span>

                <div className="text-center min-w-[80px]">
                  {match.status === 'FINISHED' && (
                    <div className="font-bold tabular-nums">
                      {match.home_score} – {match.away_score}
                    </div>
                  )}
                  {showPred && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      pick: {pred.home_score} – {pred.away_score}
                      {pred.points === 3 && ' 🎯'}
                      {pred.points === 1 && ' ✅'}
                      {pred.points === 0 && ' ❌'}
                    </div>
                  )}
                  {isPast && !pred && (
                    <div className="text-xs text-gray-700">no pick</div>
                  )}
                </div>

                <span className="flex-1 truncate text-right">{match.away_team}</span>
                {match.away_crest && (
                  <img src={match.away_crest} alt={match.away_team} className="w-5 h-5 object-contain" />
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
