// components/admin/force-sync-button.tsx
'use client'

import { useState, useTransition } from 'react'
import { forceSyncAction } from '@/actions/admin-actions'

export function ForceSyncButton() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <button
        onClick={() => startTransition(async () => {
          const result = await forceSyncAction()
          setError(result.error ?? null)
        })}
        disabled={isPending}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
      >
        {isPending ? 'Syncing…' : 'Force Sync Results'}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </>
  )
}
