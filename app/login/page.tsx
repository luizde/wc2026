// app/login/page.tsx
'use client'

import { useState, useTransition } from 'react'
import { loginAction, registerAction } from '@/actions/auth-actions'

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await loginAction({
        username: fd.get('username') as string,
        password: fd.get('password') as string,
      })
      if (result?.error) setError(result.error)
    })
  }

  function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await registerAction({
        inviteCode: fd.get('inviteCode') as string,
        username: fd.get('username') as string,
        password: fd.get('password') as string,
      })
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white text-center mb-6">
          ⚽ WC 2026 Pick&apos;em
        </h1>

        {/* Tabs */}
        <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-gray-400'
              }`}
            >
              {t === 'login' ? 'Sign In' : 'Join'}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input name="username" placeholder="Username" required autoComplete="username"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="password" type="password" placeholder="Password" required autoComplete="current-password"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition-colors">
              {isPending ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <input name="inviteCode" placeholder="Invite code" required
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="username" placeholder="Choose a username" required autoComplete="username"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input name="password" type="password" placeholder="Choose a password" required autoComplete="new-password"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" disabled={isPending}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition-colors">
              {isPending ? 'Joining…' : 'Join the Group'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
