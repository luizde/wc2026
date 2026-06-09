// db/seed.ts
// Run once: npx tsx db/seed.ts
// Requires .env.local to be populated

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const adminUsername = process.argv[2] ?? 'admin'
  const adminPassword = process.argv[3] ?? randomBytes(8).toString('hex')
  const inviteCode = process.argv[4] ?? randomBytes(4).toString('hex').toUpperCase()

  console.log('Creating admin user:', adminUsername)
  const password_hash = await bcrypt.hash(adminPassword, 10)

  const { data: user, error: userErr } = await db
    .from('users')
    .insert({ username: adminUsername, password_hash, is_admin: true })
    .select('id')
    .single()

  if (userErr) {
    console.error('Failed to create admin user:', userErr.message)
    process.exit(1)
  }

  console.log('Admin user created:', user.id)
  console.log('  Username:', adminUsername)
  console.log('  Password:', adminPassword)

  const { error: codeErr } = await db
    .from('invite_codes')
    .insert({ code: inviteCode })

  if (codeErr) {
    console.error('Failed to create invite code:', codeErr.message)
    process.exit(1)
  }

  console.log('\nInvite code:', inviteCode)
  console.log('\nDone. Share the invite code with your friends.')
}

main().catch(console.error)
