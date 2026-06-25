// actions/prediction-actions.ts
'use server'

import { revalidatePath } from 'next/cache'
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

  const { data: submittedMatches } = await db
    .from('matches')
    .select('id, stage, home_team, away_team')
    .in('id', matchIds)

  const stages = [...new Set((submittedMatches ?? []).map((m) => m.stage))]

  const { data: stageMatches } = stages.length
    ? await db.from('matches').select('stage, kickoff_utc').in('stage', stages)
    : { data: [] }

  // Phase deadline = earliest kickoff in the stage - 1 hour
  const minKickoffPerStage = new Map<string, Date>()
  for (const m of stageMatches ?? []) {
    const kickoff = new Date(m.kickoff_utc)
    const existing = minKickoffPerStage.get(m.stage)
    if (!existing || kickoff < existing) minKickoffPerStage.set(m.stage, kickoff)
  }
  const phaseDeadlines = new Map<string, Date>()
  for (const [stage, minKickoff] of minKickoffPerStage) {
    phaseDeadlines.set(stage, new Date(minKickoff.getTime() - 60 * 60 * 1000))
  }

  const matchById = new Map((submittedMatches ?? []).map((m) => [m.id, m]))
  const now = new Date()
  const valid: PredictionInput[] = []
  const skipped: string[] = []

  for (const input of inputs) {
    const match = matchById.get(input.matchId)
    // Reject matches whose teams aren't resolved yet (knockout fixtures arrive
    // with TBD sides). A prediction is only valid once both teams are known.
    if (!match || !match.home_team || !match.away_team) {
      skipped.push(input.matchId)
      continue
    }
    const phaseDeadline = phaseDeadlines.get(match.stage)
    if (!phaseDeadline || now >= phaseDeadline) {
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
        points: null,
        updated_at: now.toISOString(),
      })),
      { onConflict: 'user_id,match_id' }
    )
  }

  if (valid.length > 0) {
    revalidatePath('/predictions', 'layout')
  }

  return { saved: valid.length, skipped }
}
