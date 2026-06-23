import Link from 'next/link'

export interface PredictionData {
  homeScore: number
  awayScore: number
  points: number | null
}

export interface MatchRowData {
  id: string
  homeTeam: string
  awayTeam: string
  homeCrest: string | null
  awayCrest: string | null
  kickoffUtc: string
  status: string
  homeScore: number | null
  awayScore: number | null
  deadlineUtc: string
}

function Flag({ crest, name }: { crest: string | null; name: string }) {
  if (crest) {
    return <img src={crest} alt={name} className="w-5 h-5 object-contain rounded-sm flex-shrink-0" />
  }
  return <span className="text-sm">🏳</span>
}

function formatKickoff(utc: string): string {
  return new Date(utc).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function MatchRow({
  match,
  prediction,
}: {
  match: MatchRowData
  prediction?: PredictionData | null
}) {
  const isFinished = match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null
  const isLive = match.status === 'IN_PLAY' || match.status === 'LIVE' || match.status === 'PAUSED'

  return (
    <div className="border-b border-gray-800/50">
      <Link
        href={`/matches/${match.id}`}
        className="flex items-center gap-2 px-4 py-3 hover:bg-gray-900/50 transition-colors"
      >
        <Flag crest={match.homeCrest} name={match.homeTeam} />
        <span className="flex-1 text-sm font-medium truncate">{match.homeTeam}</span>

        <div className="flex flex-col items-center min-w-[64px]">
          {isFinished ? (
            <span className="text-base font-bold tabular-nums">
              {match.homeScore} – {match.awayScore}
            </span>
          ) : isLive ? (
            <span className="text-xs font-bold text-green-400 animate-pulse">LIVE</span>
          ) : (
            <span className="text-xs text-gray-500">{formatKickoff(match.kickoffUtc)}</span>
          )}
          <span
            className={`text-xs mt-0.5 ${
              isFinished ? 'text-gray-600' : isLive ? 'text-green-600' : 'text-gray-700'
            }`}
          >
            {isFinished ? 'FT' : isLive ? '●' : 'CT'}
          </span>
        </div>

        <span className="flex-1 text-sm font-medium truncate text-right">{match.awayTeam}</span>
        <Flag crest={match.awayCrest} name={match.awayTeam} />
      </Link>

      {prediction !== undefined && (
        prediction !== null ? (
          <div className="px-4 py-1 flex items-center gap-2 text-xs text-gray-500">
            <span>My pick: {prediction.homeScore} – {prediction.awayScore}</span>
            {isFinished && prediction.points === 3 && <span className="text-green-400">🎯 +3</span>}
            {isFinished && prediction.points === 1 && <span className="text-yellow-400">✅ +1</span>}
            {isFinished && prediction.points === 0 && <span className="text-red-400">❌ 0</span>}
          </div>
        ) : isFinished ? (
          <div className="px-4 py-1 text-xs text-gray-700">No pick</div>
        ) : null
      )}
    </div>
  )
}
