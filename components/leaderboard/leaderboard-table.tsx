import Link from 'next/link'

export interface LeaderboardRow {
  rank: number
  username: string
  totalPoints: number
  exact: number
  correct: number
  wrong: number
  missing: number
}

export function LeaderboardTable({ rows, currentUsername }: {
  rows: LeaderboardRow[]
  currentUsername: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
            <th className="text-left py-3 px-4">#</th>
            <th className="text-left py-3 px-2">Player</th>
            <th className="text-right py-3 px-2">Pts</th>
            <th className="text-right py-3 px-2 hidden sm:table-cell">🎯</th>
            <th className="text-right py-3 px-2 hidden sm:table-cell">✅</th>
            <th className="text-right py-3 px-2 hidden sm:table-cell">❌</th>
            <th className="text-right py-3 px-4 hidden sm:table-cell">–</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.username}
              className={`border-b border-gray-800/50 ${
                row.username === currentUsername ? 'bg-blue-950/30' : ''
              }`}
            >
              <td className="py-3 px-4 text-gray-500 font-mono">{row.rank}</td>
              <td className="py-3 px-2">
                <Link
                  href={`/users/${encodeURIComponent(row.username)}`}
                  className="font-medium hover:text-blue-400 transition-colors"
                >
                  {row.username}
                  {row.username === currentUsername && (
                    <span className="ml-1 text-xs text-blue-500">(you)</span>
                  )}
                </Link>
              </td>
              <td className="py-3 px-2 text-right font-bold text-lg">{row.totalPoints}</td>
              <td className="py-3 px-2 text-right text-green-400 hidden sm:table-cell">{row.exact}</td>
              <td className="py-3 px-2 text-right text-yellow-400 hidden sm:table-cell">{row.correct}</td>
              <td className="py-3 px-2 text-right text-red-400 hidden sm:table-cell">{row.wrong}</td>
              <td className="py-3 px-4 text-right text-gray-500 hidden sm:table-cell">{row.missing}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
