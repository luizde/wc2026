// actions/prediction-actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { computePhaseDeadline } from '@/lib/scoring'

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

  // Phase deadline = 1 hour before the earliest kickoff in the stage.
  const kickoffsByStage = new Map<string, string[]>()
  for (const m of stageMatches ?? []) {
    if (!kickoffsByStage.has(m.stage)) kickoffsByStage.set(m.stage, [])
    kickoffsByStage.get(m.stage)!.push(m.kickoff_utc)
  }
  const phaseDeadlines = new Map<string, Date>()
  for (const [stage, kickoffs] of kickoffsByStage) {
    phaseDeadlines.set(stage, computePhaseDeadline(kickoffs))
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
