// components/admin/user-manager.tsx
'use client'

import { useState, useTransition } from 'react'
import { resetPasswordAction, removeUserAction } from '@/actions/admin-actions'

export interface AdminUser {
  id: string
  username: string
  isAdmin: boolean
}

export function UserManager({ users }: { users: AdminUser[] }) {
  const [list, setList] = useState(users)
  const [resetting, setResetting] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  function handleReset(userId: string) {
    startTransition(async () => {
      const result = await resetPasswordAction(userId, newPw)
      setFeedback((f) => ({ ...f, [userId]: result.error ?? 'Password reset.' }))
      setResetting(null)
      setNewPw('')
    })
  }

  function handleRemove(userId: string) {
    if (!confirm('Remove this user? This cannot be undone.')) return
    startTransition(async () => {
      const result = await removeUserAction(userId)
      if (!result.error) {
        setList((l) => l.filter((u) => u.id !== userId))
      } else {
        setFeedback((f) => ({ ...f, [userId]: result.error! }))
      }
    })
  }

  return (
    <div className="space-y-3">
      {list.map((user) => (
        <div key={user.id} className="bg-gray-800 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{user.username}{user.isAdmin && ' 👑'}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setResetting(resetting === user.id ? null : user.id)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Reset pw
              </button>
              {!user.isAdmin && (
                <button
                  onClick={() => handleRemove(user.id)}
                  disabled={isPending}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {resetting === user.id && (
            <div className="flex gap-2 mt-2">
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password"
                className="flex-1 bg-gray-700 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none"
              />
              <button
                onClick={() => handleReset(user.id)}
                disabled={isPending || !newPw}
                className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-1 rounded"
              >
                Save
              </button>
            </div>
          )}
          {feedback[user.id] && (
            <p className="text-xs text-green-400 mt-1">{feedback[user.id]}</p>
          )}
        </div>
      ))}
    </div>
  )
}
