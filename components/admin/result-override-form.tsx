// components/admin/result-override-form.tsx
'use client'

import { useState, useTransition } from 'react'
import { overrideResultAction } from '@/actions/admin-actions'

export interface AdminMatch {
  id: string
  homeTeam: string
  awayTeam: string
  kickoffUtc: string
  homeScore: number | null
  awayScore: number | null
}

export function ResultOverrideForm({ matches }: { matches: AdminMatch[] }) {
  const [selectedId, setSelectedId] = useState('')
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId || home === '' || away === '') return
    startTransition(async () => {
      const res = await overrideResultAction(selectedId, Number(home), Number(away))
      setResult(res.error ?? 'Result saved and predictions re-scored.')
    })
  }

  const finishedAndRecent = matches
    .filter((m) => new Date(m.kickoffUtc) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime())

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select a match…</option>
        {finishedAndRecent.map((m) => (
          <option key={m.id} value={m.id}>
            {m.homeTeam} vs {m.awayTeam}
            {m.homeScore !== null ? ` (${m.homeScore}–${m.awayScore})` : ''}
          </option>
        ))}
      </select>
      <div className="flex gap-2 items-center">
        <input type="number" min={0} max={99} value={home} onChange={(e) => setHome(e.target.value)}
          placeholder="Home" className="w-16 bg-gray-800 text-white rounded px-2 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-600 font-bold">–</span>
        <input type="number" min={0} max={99} value={away} onChange={(e) => setAway(e.target.value)}
          placeholder="Away" className="w-16 bg-gray-800 text-white rounded px-2 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" disabled={isPending || !selectedId || home === '' || away === ''}
          className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-lg flex-1">
          {isPending ? 'Saving…' : 'Override & Re-score'}
        </button>
      </div>
      {result && <p className="text-sm text-green-400">{result}</p>}
    </form>
  )
}
