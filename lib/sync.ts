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
      .select('id, status, home_score, away_score')
      .eq('external_id', match.id)
      .single()

    // Use regularTime (90-min score) for prediction scoring. For regular-duration
    // matches the API omits regularTime, so fall back to fullTime which is correct
    // for those. For EXTRA_TIME / PENALTY_SHOOTOUT matches fullTime adds ET/penalty
    // goals to the total, making it wrong for scoring.
    const regularHome = match.score.regularTime?.home ?? match.score.fullTime.home
    const regularAway = match.score.regularTime?.away ?? match.score.fullTime.away
    const scoresReady = regularHome !== null && regularAway !== null

    const etHome = match.score.extraTime?.home ?? null
    const etAway = match.score.extraTime?.away ?? null
    const pensHome = match.score.penalties?.home ?? null
    const pensAway = match.score.penalties?.away ?? null
    const scoreDuration = match.score.duration ?? 'REGULAR'

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

    // Detect when the stored 90-min score differs from what the API now reports.
    // This handles games that were stored with the wrong fullTime value (which
    // included ET/penalty goals) before this fix was deployed.
    const scoresDiffer =
      existing?.home_score !== regularHome || existing?.away_score !== regularAway

    const { data: upserted } = await db
      .from('matches')
      .upsert(
        {
          external_id: match.id,
          // Knockout fixtures arrive with TBD (null) teams. Store '' so the
          // NOT NULL row persists; a later sync upserts the resolved name onto
          // the same external_id rather than creating a new record.
          home_team: match.homeTeam?.name ?? '',
          away_team: match.awayTeam?.name ?? '',
          home_crest: match.homeTeam?.crest ?? null,
          away_crest: match.awayTeam?.crest ?? null,
          stage: match.stage,
          group_name: match.group ?? null,
          matchday: match.matchday ?? null,
          kickoff_utc: kickoffUtc.toISOString(),
          deadline_utc: deadlineUtc.toISOString(),
          status: effectiveStatus,
          home_score: regularHome,
          away_score: regularAway,
          home_score_et: etHome,
          away_score_et: etAway,
          home_score_pens: pensHome,
          away_score_pens: pensAway,
          score_duration: scoreDuration,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'external_id' }
      )
      .select('id')
      .single()

    // Rescore when the match just finished, or when a previously-wrong score
    // (e.g. stored from fullTime including ET/pens) is being corrected.
    if (isNowFinished && (!wasFinished || scoresDiffer) && upserted && scoresReady) {
      await scorePredictions(upserted.id, {
        home: regularHome!,
        away: regularAway!,
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
