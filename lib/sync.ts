// lib/sync.ts
import { db } from './db'
import { fetchWCMatches } from './football-data'
import { computePoints, computeDeadline } from './scoring'

const SYNC_TTL_MS = 10 * 60 * 1000

export async function syncIfStale(): Promise<void> {
  const { data: meta } = await db
    .from('sync_meta')
    .select('last_synced_at')
    .eq('id', 1)
    .single()

  const lastSynced = meta?.last_synced_at ? new Date(meta.last_synced_at) : null
  if (lastSynced && Date.now() - lastSynced.getTime() < SYNC_TTL_MS) return

  await runSync()
}

export async function forceSync(): Promise<void> {
  await runSync()
}

async function runSync(): Promise<void> {
  let matches: Awaited<ReturnType<typeof fetchWCMatches>>
  try {
    matches = await fetchWCMatches()
  } catch (err) {
    console.warn('[sync] football-data.org unreachable:', err)
    return
  }

  for (const match of matches) {
    const kickoffUtc = new Date(match.utcDate)
    const deadlineUtc = computeDeadline(kickoffUtc)

    const { data: existing } = await db
      .from('matches')
      .select('id, status')
      .eq('external_id', match.id)
      .single()

    const homeScore = match.score.fullTime.home
    const awayScore = match.score.fullTime.away
    const scoresReady = homeScore !== null && awayScore !== null

    // football-data.org marks matches FINISHED before populating scores.
    // Hold the status at IN_PLAY until scores are available so the UI
    // never renders "null – null".
    const effectiveStatus = match.status === 'FINISHED' && !scoresReady
      ? 'IN_PLAY'
      : match.status

    const wasFinished = existing?.status === 'FINISHED'

    // If the match is already FINISHED in the DB (e.g. via admin override) but
    // the API hasn't populated scores yet, skip the update entirely. Overwriting
    // with null scores would undo the manual result and corrupt prediction scoring.
    if (wasFinished && !scoresReady) continue

    const isNowFinished = effectiveStatus === 'FINISHED'

    const { data: upserted } = await db
      .from('matches')
      .upsert(
        {
          external_id: match.id,
          home_team: match.homeTeam.name,
          away_team: match.awayTeam.name,
          home_crest: match.homeTeam.crest ?? null,
          away_crest: match.awayTeam.crest ?? null,
          stage: match.stage,
          group_name: match.group ?? null,
          matchday: match.matchday ?? null,
          kickoff_utc: kickoffUtc.toISOString(),
          deadline_utc: deadlineUtc.toISOString(),
          status: effectiveStatus,
          home_score: homeScore,
          away_score: awayScore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'external_id' }
      )
      .select('id')
      .single()

    if (!wasFinished && isNowFinished && upserted && scoresReady) {
      await scorePredictions(upserted.id, {
        home: homeScore!,
        away: awayScore!,
      })
    }
  }

  await db
    .from('sync_meta')
    .upsert({ id: 1, last_synced_at: new Date().toISOString() })
}

export async function scorePredictions(
  matchId: string,
  actual: { home: number; away: number }
): Promise<void> {
  const { data: predictions } = await db
    .from('predictions')
    .select('id, home_score, away_score')
    .eq('match_id', matchId)

  if (!predictions?.length) return

  for (const pred of predictions) {
    const points = computePoints(
      { home: pred.home_score, away: pred.away_score },
      actual
    )
    await db.from('predictions').update({ points }).eq('id', pred.id)
  }
}
