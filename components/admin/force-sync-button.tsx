// components/admin/force-sync-button.tsx
'use client'

import { useTransition } from 'react'
import { forceSyncAction } from '@/actions/admin-actions'

export function ForceSyncButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(async () => { await forceSyncAction() })}
      disabled={isPending}
      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
    >
      {isPending ? 'Syncing…' : 'Force Sync Results'}
    </button>
  )
}
