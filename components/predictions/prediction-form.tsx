// components/predictions/prediction-form.tsx
'use client'

import { useState, useTransition } from 'react'
import { submitPredictionsAction, PredictionInput } from '@/actions/prediction-actions'

export interface MatchForForm {
  id: string
  homeTeam: string
  awayTeam: string
  homeCrest: string | null
  awayCrest: string | null
  groupName: string | null
  kickoffUtc: string
  deadlineUtc: string
  existingHome: number | null
  existingAway: number | null
  isLocked: boolean
}

function TeamFlag({ crest, name }: { crest: string | null; name: string }) {
  if (crest) {
    return (
      <img
        src={crest}
        alt={name}
        className="w-6 h-6 object-contain rounded-sm flex-shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    )
  }
  return <span className="w-6 h-6 text-center text-sm leading-6">🏳</span>
}

export function PredictionForm({ matches, stage }: {
  matches: MatchForForm[]
  stage: string
}) {
  const [scores, setScores] = useState<Record<string, { home: string; away: string }>>(() => {
    const init: Record<string, { home: string; away: string }> = {}
    for (const m of matches) {
      init[m.id] = {
        home: m.existingHome !== null ? String(m.existingHome) : '',
        away: m.existingAway !== null ? String(m.existingAway) : '',
      }
    }
    return init
  })
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ saved: number; skipped: string[] } | null>(null)

  function setScore(matchId: string, side: 'home' | 'away', value: string) {
    const num = value.replace(/\D/g, '').slice(0, 2)
    setScores((prev) => ({ ...prev, [matchId]: { ...prev[matchId], [side]: num } }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const inputs: PredictionInput[] = []
    for (const match of matches) {
      if (match.isLocked) continue
      const s = scores[match.id]
      if (s.home === '' || s.away === '') continue
      inputs.push({ matchId: match.id, homeScore: Number(s.home), awayScore: Number(s.away) })
    }
    startTransition(async () => {
      const res = await submitPredictionsAction(inputs)
      setResult(res)
    })
  }

  // Group by group_name for group stage
  const groups = [...new Set(matches.map((m) => m.groupName ?? stage))]

  return (
    <form onSubmit={handleSubmit}>
      {result && (
        <div className="mx-4 mt-3 px-3 py-2 bg-green-950 border border-green-800 rounded-lg text-green-400 text-sm">
          Saved {result.saved} prediction{result.saved !== 1 ? 's' : ''}.
          {result.skipped.length > 0 && ` ${result.skipped.length} skipped (deadline passed).`}
        </div>
      )}

      {groups.map((group) => (
        <div key={group}>
          {group && (
            <div className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-widest">
              {group}
            </div>
          )}
          {matches
            .filter((m) => (m.groupName ?? stage) === group)
            .map((match) => {
              const s = scores[match.id]
              const deadline = new Date(match.deadlineUtc)
              const now = new Date()
              const minutesLeft = Math.floor((deadline.getTime() - now.getTime()) / 60000)
              const soonDeadline = !match.isLocked && minutesLeft < 60 && minutesLeft > 0

              return (
                <div
                  key={match.id}
                  className={`flex items-center gap-2 px-4 py-3 border-b border-gray-800/50 ${
                    match.isLocked ? 'opacity-60' : ''
                  }`}
                >
                  <TeamFlag crest={match.homeCrest} name={match.homeTeam} />
                  <span className="flex-1 text-sm font-medium truncate">{match.homeTeam}</span>

                  {match.isLocked ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="w-7 text-center font-bold">
                        {match.existingHome !== null ? match.existingHome : '–'}
                      </span>
                      <span className="text-gray-600">–</span>
                      <span className="w-7 text-center font-bold">
                        {match.existingAway !== null ? match.existingAway : '–'}
                      </span>
                      <span className="ml-1 text-xs text-gray-600">🔒</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {soonDeadline && (
                        <span className="text-xs text-orange-400">{minutesLeft}m left</span>
                      )}
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={s.home}
                        onChange={(e) => setScore(match.id, 'home', e.target.value)}
                        placeholder="?"
                        className="w-9 bg-gray-800 border border-gray-700 rounded text-center text-white text-base font-bold py-1 focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-gray-600 font-bold">–</span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={s.away}
                        onChange={(e) => setScore(match.id, 'away', e.target.value)}
                        placeholder="?"
                        className="w-9 bg-gray-800 border border-gray-700 rounded text-center text-white text-base font-bold py-1 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  <span className="flex-1 text-sm font-medium truncate text-right">{match.awayTeam}</span>
                  <TeamFlag crest={match.awayCrest} name={match.awayTeam} />
                </div>
              )
            })}
        </div>
      ))}

      <div className="sticky bottom-20 px-4 pb-4 pt-3 bg-gray-950/90 backdrop-blur border-t border-gray-800 mt-4">
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
        >
          {isPending ? 'Saving…' : 'Save Predictions'}
        </button>
      </div>
    </form>
  )
}
