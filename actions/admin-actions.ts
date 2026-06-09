// actions/admin-actions.ts
'use server'

import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { forceSync, scorePredictions } from '@/lib/sync'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const session = await getSession()
  if (!session?.isAdmin) throw new Error('Unauthorized')
}

export async function forceSyncAction(): Promise<{ error?: string }> {
  try {
    await assertAdmin()
    await forceSync()
    revalidatePath('/', 'layout')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function overrideResultAction(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<{ error?: string }> {
  try {
    await assertAdmin()
    await db.from('matches').update({
      home_score: homeScore,
      away_score: awayScore,
      status: 'FINISHED',
      updated_at: new Date().toISOString(),
    }).eq('id', matchId)
    await scorePredictions(matchId, { home: homeScore, away: awayScore })
    revalidatePath('/', 'layout')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function generateInviteAction(): Promise<{ code?: string; error?: string }> {
  try {
    await assertAdmin()
    const code = randomBytes(4).toString('hex').toUpperCase()
    await db.from('invite_codes').insert({ code })
    return { code }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function revokeInviteAction(codeId: string): Promise<{ error?: string }> {
  try {
    await assertAdmin()
    await db.from('invite_codes').update({ is_active: false }).eq('id', codeId)
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function resetPasswordAction(
  userId: string,
  newPassword: string
): Promise<{ error?: string }> {
  try {
    await assertAdmin()
    if (!newPassword) return { error: 'Password cannot be empty' }
    const password_hash = await bcrypt.hash(newPassword, 10)
    await db.from('users').update({ password_hash }).eq('id', userId)
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function removeUserAction(userId: string): Promise<{ error?: string }> {
  try {
    await assertAdmin()
    await db.from('users').delete().eq('id', userId)
    revalidatePath('/', 'layout')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}
