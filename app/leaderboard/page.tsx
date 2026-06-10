import { db } from '@/lib/db'
import { Rules } from '@/components/leaderboard/rules'
import { getSession } from '@/lib/auth'
import { syncIfStale } from '@/lib/sync'
import { LeaderboardTable, LeaderboardRow } from '@/components/leaderboard/leaderboard-table'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  await syncIfStale()

  const session = await getSession()

  const { data: users } = await db
    .from('users')
    .select('id, username')

  const { data: predictions } = await db
    .from('predictions')
    .select('user_id, points')

  const { data: finishedMatches } = await db
    .from('matches')
    .select('id')
    .eq('status', 'FINISHED')

  const finishedCount = finishedMatches?.length ?? 0

  const rows: LeaderboardRow[] = (users ?? []).map((user) => {
    const userPreds = (predictions ?? []).filter((p) => p.user_id === user.id)
    const totalPoints = userPreds.reduce((sum, p) => sum + (p.points ?? 0), 0)
    const exact = userPreds.filter((p) => p.points === 3).length
    const correct = userPreds.filter((p) => p.points === 1).length
    const wrong = userPreds.filter((p) => p.points === 0).length
    const predicted = userPreds.filter((p) => p.points !== null).length
    const missing = finishedCount - predicted
    return { rank: 0, username: user.username, totalPoints, exact, correct, wrong, missing }
  })

  rows.sort((a, b) => b.totalPoints - a.totalPoints)

  // Assign shared ranks for ties
  let rank = 1
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].totalPoints < rows[i - 1].totalPoints) rank = i + 1
    rows[i].rank = rank
  }

  const { data: currentUser } = await db
    .from('users')
    .select('username')
    .eq('id', session!.userId)
    .single()

  return (
    <div className="max-w-2xl mx-auto px-0">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Standings</h1>
        <p className="text-gray-500 text-sm mt-1">{finishedCount} matches played</p>
      </div>
      <LeaderboardTable rows={rows} currentUsername={currentUser?.username ?? ''} />
      <Rules />
    </div>
  )
}
