/**
 * Grant full app access to an App Store review account (entitled, not paywalled).
 *
 *   npx tsx scripts/grant-review-access.ts kai.chan.claw@gmail.com
 *   npx tsx scripts/grant-review-access.ts kai.chan.claw@gmail.com 365
 *
 * Sets plan='active' with plan_expires_at one year out (or <days> from now).
 * Run once before submitting a build whose ASC demo credentials point at this
 * email. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  let raw = ''
  try {
    raw = readFileSync('.env', 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    if (k && process.env[k] === undefined) process.env[k] = v
  }
}
loadEnv()

const email = process.argv[2]
if (!email) {
  console.error('Usage: npx tsx scripts/grant-review-access.ts <email> [days=365]')
  process.exit(1)
}
const days = Number(process.argv[3] ?? '365')

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const { data: listed, error: listErr } = await sb.auth.admin.listUsers()
if (listErr) {
  console.error(listErr.message)
  process.exit(1)
}
const user = listed.users.find((x) => x.email?.toLowerCase() === email.toLowerCase())
if (!user) {
  console.error(`No Supabase user for ${email}. Create the account first (email sign-up or OAuth).`)
  process.exit(1)
}

const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
const { error } = await sb
  .from('profiles')
  .upsert(
    {
      owner: user.id,
      plan: 'active',
      plan_source: null,
      plan_expires_at: expires,
      trial_ends_at: null,
    },
    { onConflict: 'owner' },
  )

if (error) {
  console.error(error.message)
  process.exit(1)
}

console.log(`Granted review access to ${email} until ${expires}`)
