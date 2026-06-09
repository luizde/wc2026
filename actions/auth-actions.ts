// actions/auth-actions.ts
'use server'

import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { setSessionCookie, clearSessionCookie } from '@/lib/auth'
import { redirect } from 'next/navigation'

interface RegisterInput { inviteCode: string; username: string; password: string }
interface LoginInput { username: string; password: string }
interface ActionResult { error?: string }

export async function registerAction(input: RegisterInput): Promise<ActionResult> {
  if (!input.password) return { error: 'Password cannot be empty' }

  const { data: invite } = await db
    .from('invite_codes')
    .select('id')
    .eq('code', input.inviteCode)
    .eq('is_active', true)
    .single()

  if (!invite) return { error: 'Invalid or inactive invite code' }

  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('username', input.username)
    .single()

  if (existing) return { error: 'Username already taken' }

  const password_hash = await bcrypt.hash(input.password, 10)

  const { data: user, error } = await db
    .from('users')
    .insert({ username: input.username, password_hash })
    .select('id, is_admin')
    .single()

  if (error || !user) return { error: 'Registration failed, please try again' }

  await setSessionCookie({ userId: user.id, isAdmin: user.is_admin })
  redirect('/leaderboard')
}

export async function loginAction(input: LoginInput): Promise<ActionResult> {
  const { data: user } = await db
    .from('users')
    .select('id, password_hash, is_admin')
    .eq('username', input.username)
    .single()

  if (!user) return { error: 'Invalid username or password' }

  const valid = await bcrypt.compare(input.password, user.password_hash)
  if (!valid) return { error: 'Invalid username or password' }

  await setSessionCookie({ userId: user.id, isAdmin: user.is_admin })
  redirect('/leaderboard')
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie()
  redirect('/login')
}
