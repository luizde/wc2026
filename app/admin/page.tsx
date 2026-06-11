// app/admin/page.tsx
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { ForceSyncButton } from '@/components/admin/force-sync-button'
import { InviteCodeManager } from '@/components/admin/invite-code-manager'
import { UserManager } from '@/components/admin/user-manager'
import { ResultOverrideForm } from '@/components/admin/result-override-form'

export const dynamic = 'force-dynamic'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-800 px-4 py-5">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </div>
  )
}

export default async function AdminPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/leaderboard')

  const [{ data: users }, { data: codes }, { data: matches }] = await Promise.all([
    db.from('users').select('id, username, is_admin').order('created_at'),
    db.from('invite_codes').select('id, code, is_active').order('created_at', { ascending: false }),
    db.from('matches')
      .select('id, home_team, away_team, kickoff_utc, home_score, away_score, status')
      .gte('kickoff_utc', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('kickoff_utc', { ascending: false }),
  ])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold">Admin</h1>
      </div>

      <Section title="Sync">
        <ForceSyncButton />
      </Section>

      <Section title="Override Result">
        <ResultOverrideForm
          matches={(matches ?? []).map((m) => ({
            id: m.id,
            homeTeam: m.home_team,
            awayTeam: m.away_team,
            kickoffUtc: m.kickoff_utc,
            homeScore: m.home_score,
            awayScore: m.away_score,
          }))}
        />
      </Section>

      <Section title="Invite Codes">
        <InviteCodeManager
          initialCodes={(codes ?? []).map((c) => ({
            id: c.id,
            code: c.code,
            isActive: c.is_active,
          }))}
        />
      </Section>

      <Section title="Users">
        <UserManager
          users={(users ?? []).map((u) => ({
            id: u.id,
            username: u.username,
            isAdmin: u.is_admin,
          }))}
        />
      </Section>
    </div>
  )
}
