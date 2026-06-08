/**
 * Move a user's trial end date to test the paywall (LockedScreen) flow.
 *
 *   npx tsx scripts/expire-trial.ts                 # expire now (trial_ends_at = yesterday)
 *   npx tsx scripts/expire-trial.ts me@x.com -1     # expired yesterday
 *   npx tsx scripts/expire-trial.ts me@x.com 14     # restore: 14 days left
 *
 * Sets plan='trialing' so the gate hits the trial path, then sets trial_ends_at
 * to now + <days>. Refresh the app afterward — negative/0 days → LockedScreen.
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

const email = process.argv[2] || 'phillipchan1@gmail.com'
const days = Number(process.argv[3] ?? '-1')

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const { data: u } = await sb.auth.admin.listUsers()
const user = u.users.find((x) => x.email === email)
if (!user) {
  console.log(`No user for ${email} — sign in once first.`)
  process.exit(0)
}

const ends = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
const { error } = await sb
  .from('profiles')
  .update({ plan: 'trialing', trial_ends_at: ends })
  .eq('owner', user.id)
if (error) {
  console.log('Update failed:', error.message)
  process.exit(1)
}

console.log(`✅ ${email}: plan=trialing, trial_ends_at=${ends} (${days >= 0 ? days + ' days left' : 'EXPIRED'})`)
console.log('   Refresh the app → ' + (days > 0 ? 'trial banner' : 'LockedScreen / paywall'))
