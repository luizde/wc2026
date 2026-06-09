// actions/prediction-actions.ts
'use server'

import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export interface PredictionInput {
  matchId: string
  homeScore: number
  awayScore: number
}

export interface SubmitResult {
  saved: number
  skipped: string[]
  error?: string
}

export async function submitPredictionsAction(
  inputs: PredictionInput[]
): Promise<SubmitResult> {
  const session = await getSession()
  if (!session) return { saved: 0, skipped: [], error: 'Not authenticated' }

  const matchIds = inputs.map((i) => i.matchId)
  const { data: matches } = await db
    .from('matches')
    .select('id, deadline_utc')
    .in('id', matchIds)

  const now = new Date()
  const deadlineMap = new Map((matches ?? []).map((m) => [m.id, new Date(m.deadline_utc)]))

  const valid: PredictionInput[] = []
  const skipped: string[] = []

  for (const input of inputs) {
    const deadline = deadlineMap.get(input.matchId)
    if (!deadline || now >= deadline) {
      skipped.push(input.matchId)
    } else {
      valid.push(input)
    }
  }

  if (valid.length > 0) {
    await db.from('predictions').upsert(
      valid.map((v) => ({
        user_id: session.userId,
        match_id: v.matchId,
        home_score: v.homeScore,
        away_score: v.awayScore,
        updated_at: now.toISOString(),
      })),
      { onConflict: 'user_id,match_id' }
    )
  }

  return { saved: valid.length, skipped }
}
