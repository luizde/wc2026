// app/matches/[matchId]/page.tsx
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { syncIfStale } from '@/lib/sync'
import { MatchComparison, UserPrediction } from '@/components/matches/match-detail'

export const dynamic = 'force-dynamic'

function formatKickoff(utc: string): string {
  return new Date(utc).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  })
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>
}) {
  const { matchId } = await params
  await syncIfStale()

  const session = await getSession()

  const { data: match } = await db
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (!match) notFound()

  const isPastDeadline = new Date() >= new Date(match.deadline_utc)

  // Only show all predictions after deadline
  const { data: allPredictions } = isPastDeadline
    ? await db
        .from('predictions')
        .select('user_id, home_score, away_score, points')
        .eq('match_id', matchId)
    : { data: [] }

  const { data: myPrediction } = await db
    .from('predictions')
    .select('home_score, away_score, points')
    .eq('match_id', matchId)
    .eq('user_id', session!.userId)
    .single()

  const { data: users } = await db.from('users').select('id, username')

  const { data: currentUser } = await db
    .from('users')
    .select('username')
    .eq('id', session!.userId)
    .single()

  let comparisonRows: UserPrediction[] = []
  if (isPastDeadline) {
    const predMap = new Map(
      (allPredictions ?? []).map((p) => [p.user_id, p])
    )
    comparisonRows = (users ?? []).map((u) => {
      const pred = predMap.get(u.id)
      return {
        username: u.username,
        homeScore: pred?.home_score ?? null,
        awayScore: pred?.away_score ?? null,
        points: pred?.points ?? null,
        isCurrentUser: u.id === session!.userId,
      }
    }).sort((a, b) => (b.points ?? -1) - (a.points ?? -1))
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Match header */}
      <div className="px-4 py-6 border-b border-gray-800 text-center">
        <p className="text-xs text-gray-500 mb-3">{match.stage.replace(/_/g, ' ')}</p>
        <div className="flex items-center justify-center gap-4 mb-3">
          {match.home_crest && (
            <img src={match.home_crest} alt={match.home_team} className="w-10 h-10 object-contain" />
          )}
          <div className="text-2xl font-bold tabular-nums">
            {match.status === 'FINISHED' && match.home_score !== null && match.away_score !== null
              ? `${match.home_score} – ${match.away_score}`
              : '– : –'}
          </div>
          {match.away_crest && (
            <img src={match.away_crest} alt={match.away_team} className="w-10 h-10 object-contain" />
          )}
        </div>
        <div className="flex justify-between text-sm font-medium px-8">
          <span>{match.home_team}</span>
          <span>{match.away_team}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">{formatKickoff(match.kickoff_utc)}</p>
      </div>

      {/* Before deadline: show only own prediction */}
      {!isPastDeadline && (
        <div className="px-4 py-4">
          <p className="text-sm text-gray-500 mb-2">Your prediction</p>
          {myPrediction ? (
            <p className="text-lg font-bold">
              {myPrediction.home_score} – {myPrediction.away_score}
            </p>
          ) : (
            <p className="text-gray-600">No prediction submitted yet.</p>
          )}
          <p className="text-xs text-gray-600 mt-2">
            Predictions are hidden until the deadline passes.
          </p>
        </div>
      )}

      {/* After deadline: full comparison */}
      {isPastDeadline && (
        <MatchComparison
          predictions={comparisonRows}
          actualHome={match.home_score}
          actualAway={match.away_score}
        />
      )}
    </div>
  )
}
