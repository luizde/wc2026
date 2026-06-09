import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { BottomNav } from '@/components/nav/bottom-nav'
import { getSession } from '@/lib/auth'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WC 2026 Pick\'em',
  description: 'World Cup 2026 score predictions',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const showNav = !!session

  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} bg-gray-950 text-gray-100 min-h-screen`}>
        <main className={showNav ? 'pb-20' : ''}>
          {children}
        </main>
        {showNav && <BottomNav isAdmin={session.isAdmin} />}
      </body>
    </html>
  )
}
