// components/predictions/round-tabs.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ROUNDS = [
  { slug: 'group-stage', label: 'Groups' },
  { slug: 'round-of-32', label: 'R32' },
  { slug: 'round-of-16', label: 'R16' },
  { slug: 'quarter-finals', label: 'QF' },
  { slug: 'semi-finals', label: 'SF' },
  { slug: 'third-place', label: '3rd' },
  { slug: 'final', label: 'Final' },
]

export function RoundTabs() {
  const pathname = usePathname()
  return (
    <div className="flex overflow-x-auto gap-2 px-4 py-3 border-b border-gray-800 scrollbar-hide">
      {ROUNDS.map((r) => {
        const active = pathname.includes(r.slug)
        return (
          <Link
            key={r.slug}
            href={`/predictions/${r.slug}`}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {r.label}
          </Link>
        )
      })}
    </div>
  )
}
