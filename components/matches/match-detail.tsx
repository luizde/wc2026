// components/matches/match-detail.tsx

export interface UserPrediction {
  username: string
  homeScore: number | null
  awayScore: number | null
  points: number | null
  isCurrentUser: boolean
}

export function MatchComparison({
  predictions,
  actualHome,
  actualAway,
}: {
  predictions: UserPrediction[]
  actualHome: number | null
  actualAway: number | null
}) {
  return (
    <div className="px-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest py-3">
        All Predictions
      </div>
      {predictions.map((pred) => (
        <div
          key={pred.username}
          className={`flex items-center gap-3 py-2.5 border-b border-gray-800/50 ${
            pred.isCurrentUser ? 'text-blue-300' : ''
          }`}
        >
          <span className="w-24 truncate text-sm font-medium">
            {pred.username}
            {pred.isCurrentUser && <span className="text-xs text-blue-500 ml-1">(you)</span>}
          </span>
          <span className="font-mono text-sm font-bold">
            {pred.homeScore !== null ? `${pred.homeScore} – ${pred.awayScore}` : '–'}
          </span>
          <span className="ml-auto text-sm font-bold">
            {pred.points === 3 && <span className="text-green-400">+3 🎯</span>}
            {pred.points === 1 && <span className="text-yellow-400">+1 ✅</span>}
            {pred.points === 0 && <span className="text-red-400">0 ❌</span>}
            {pred.points === null && pred.homeScore !== null && (
              <span className="text-gray-600">–</span>
            )}
            {pred.homeScore === null && <span className="text-gray-700">no pick</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
