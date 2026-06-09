// components/admin/invite-code-manager.tsx
'use client'

import { useState, useTransition } from 'react'
import { generateInviteAction, revokeInviteAction } from '@/actions/admin-actions'

export interface InviteCode {
  id: string
  code: string
  isActive: boolean
}

export function InviteCodeManager({ initialCodes }: { initialCodes: InviteCode[] }) {
  const [codes, setCodes] = useState(initialCodes)
  const [isPending, startTransition] = useTransition()
  const [newCode, setNewCode] = useState<string | null>(null)

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateInviteAction()
      if (result.code) {
        setNewCode(result.code)
        setCodes((prev) => [{ id: 'new', code: result.code!, isActive: true }, ...prev])
      }
    })
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      await revokeInviteAction(id)
      setCodes((prev) => prev.map((c) => c.id === id ? { ...c, isActive: false } : c))
    })
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
        >
          Generate Code
        </button>
        {newCode && <span className="font-mono text-green-400 font-bold text-sm">{newCode} ← share this</span>}
      </div>
      <div className="space-y-2">
        {codes.map((c) => (
          <div key={c.id} className="flex items-center gap-3 text-sm">
            <span className={`font-mono font-bold ${c.isActive ? 'text-white' : 'text-gray-600 line-through'}`}>
              {c.code}
            </span>
            {c.isActive && (
              <button
                onClick={() => handleRevoke(c.id)}
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Revoke
              </button>
            )}
            {!c.isActive && <span className="text-xs text-gray-600">revoked</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
