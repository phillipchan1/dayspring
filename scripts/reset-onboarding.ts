// Dev-only: reset a test account so the FULL onboarding flow replays.
//
//   npx tsx scripts/reset-onboarding.ts                  # reset in place (keep
//        the auth user; wipe data + reset onboarded_at/has_seen_welcome)
//   npx tsx scripts/reset-onboarding.ts --delete         # DELETE the auth user
//        entirely (cascade-wipes everything) → next sign-in = a genuinely new
//        account: fresh profile, fresh trial grant. Truest "I have no account".
//   npx tsx scripts/reset-onboarding.ts you@example.com [--delete]
//
// Always clears the desktop app's local state (macOS). For web, use a fresh
// incognito tab. Runs locally with the service-role key from .env.

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { homedir } from 'node:os'
import { createClient } from '@supabase/supabase-js'

function loadDotEnv(): void {
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
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv()

const ARGS = process.argv.slice(2)
const DELETE = ARGS.includes('--delete')
const EMAIL = ARGS.find((a) => !a.startsWith('--')) ?? 'phillipchan1@gmail.com'
const BUNDLE = 'com.phillipchan.dayspring'

// Owner-keyed tables to wipe. Child tables (thread_members, item_subjects,
// altar_candidate_dismissals) cascade from their parents.
const OWNER_TABLES = [
  'entries',
  'insights',
  'processing_jobs',
  'spiritual_items',
  'reminders',
  'echo_candidates',
  'echo_dismissals',
  'resurface_dismissals',
  'scripture_refs',
  'prayer_threads',
  'threads',
  'encounters',
  'ropes',
  'altar_candidates',
  'attachments',
]

async function main() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Find the auth user.
  const { data: list } = await sb.auth.admin.listUsers()
  const user = list.users.find((u) => u.email === EMAIL)
  if (!user) {
    console.log(`No auth user for ${EMAIL} — sign in once first, or pass a different email.`)
    return
  }
  // Delete mode: drop the auth user — every owner-keyed table cascades, so this
  // wipes everything and the next sign-in is a brand-new account.
  if (DELETE) {
    console.log(`DELETING account ${EMAIL} (${user.id}) — cascade wipes all data`)
    const { error } = await sb.auth.admin.deleteUser(user.id)
    console.log(error ? `  ⚠️  ${error.message}` : '  ✓ auth user deleted (data cascaded)')
    clearDesktopLocal()
    console.log('\n✅ Done. Open a FRESH incognito tab → sign in → brand-new account, full onboarding.')
    return
  }

  console.log(`Resetting ${EMAIL} (${user.id})`)

  // 2. Wipe the account's data.
  for (const table of OWNER_TABLES) {
    const { error } = await sb.from(table).delete().eq('owner', user.id)
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      console.log(`  ⚠️  ${table}: ${error.message}`)
    } else {
      console.log(`  cleared ${table}`)
    }
  }

  // 3. Reset onboarding flags (keep plan/trial so the account stays entitled).
  const { error: pErr } = await sb
    .from('profiles')
    .update({ onboarded_at: null, has_seen_welcome: false })
    .eq('owner', user.id)
  console.log(pErr ? `  ⚠️  profiles: ${pErr.message}` : '  reset onboarded_at + has_seen_welcome')

  // 4. Clear the desktop app's local state.
  clearDesktopLocal()

  console.log('\n✅ Done. Reopen Dayspring (or use a fresh web incognito tab) and sign in → full onboarding.')
}

/** Quit the desktop app and clear its macOS local state (session + webview data). */
function clearDesktopLocal() {
  try {
    execSync('osascript -e \'tell application "Dayspring" to quit\' 2>/dev/null || true')
    execSync('pkill -f "/Applications/Dayspring.app/Contents/MacOS" 2>/dev/null || true')
    const base = `${homedir()}/Library`
    execSync(`rm -f "${base}/Application Support/${BUNDLE}/auth.json"`)
    execSync(`rm -rf "${base}/WebKit/${BUNDLE}" "${base}/Caches/${BUNDLE}"`)
    console.log('  cleared desktop local state (auth + localStorage + IndexedDB)')
  } catch {
    console.log('  (desktop app not found / not on macOS — skip local clear)')
  }
}

void main()
