'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/leaderboard', label: 'Standings', icon: '🏆' },
  { href: '/predictions/group-stage', label: 'Predict', icon: '✏️' },
  { href: '/matches', label: 'Matches', icon: '⚽' },
  { href: '/admin', label: 'Admin', icon: '⚙️', adminOnly: true },
]

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 safe-area-inset-bottom">
      <div className="flex">
        {items.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
                active ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
