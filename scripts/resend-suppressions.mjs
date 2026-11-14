#!/usr/bin/env node
// Import Dayspring's Resend unsubscribes into Neon public.email_suppressions (0008).
//
// Read-only against Resend: GET /segments and GET /segments/{id}/contacts only, and
// only for Dayspring segments (name starting "Dayspring", or RESEND_SEGMENT_ID).
// Other segments in the shared Resend account (e.g. Drove) are never listed for
// contacts, and their names are not printed. Addresses are never printed.
//
//   RESEND_API_KEY_FILE=/path/0600 node scripts/resend-suppressions.mjs            # dry-run (default): counts only
//   RESEND_API_KEY_FILE=… DATABASE_URL_FILE=/path/0600 node scripts/resend-suppressions.mjs --apply
//
// Keys come from 0600 files (or RESEND_API_KEY / DATABASE_URL env), never argv.
// --apply inserts with ON CONFLICT DO NOTHING (idempotent; source 'resend').
import { readFileSync } from 'node:fs'

const RESEND = 'https://api.resend.com'
const apply = process.argv.includes('--apply')

function secret(name) {
  const file = process.env[`${name}_FILE`]
  const v = file ? readFileSync(file, 'utf8').trim() : (process.env[name] ?? '').trim()
  if (!v) throw new Error(`${name} (or ${name}_FILE) is required`)
  return v
}

export function isDayspringSegment(seg, pinnedId) {
  if (pinnedId) return seg.id === pinnedId
  return typeof seg.name === 'string' && /^dayspring\b/i.test(seg.name.trim())
}

export function unsubscribedEmails(contacts) {
  const out = new Set()
  for (const c of contacts) {
    if (c && c.unsubscribed === true && typeof c.email === 'string' && c.email.includes('@')) out.add(c.email.trim().toLowerCase())
  }
  return [...out]
}

async function get(key, path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${RESEND}${path}`, { headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'dayspring-suppression-export/1' } })
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 600 * (attempt + 1))); continue }
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(`Resend GET ${path.split('?')[0]} -> ${res.status} ${json?.message ?? ''}`.trim())
    return json
  }
  throw new Error(`Resend GET ${path} rate-limited`)
}

async function listAll(key, path) {
  const out = []
  let after = null
  for (;;) {
    const q = `${path}${path.includes('?') ? '&' : '?'}limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`
    const page = await get(key, q)
    const batch = Array.isArray(page?.data) ? page.data : []
    out.push(...batch)
    if (!page?.has_more || batch.length === 0) break
    after = batch[batch.length - 1].id
  }
  return out
}

async function main() {
  const key = secret('RESEND_API_KEY')
  const pinned = process.env.RESEND_SEGMENT_ID?.trim() || null
  const segments = (await listAll(key, '/segments')).filter((s) => isDayspringSegment(s, pinned))
  if (segments.length === 0) throw new Error('no Dayspring segment found; nothing read')
  const all = new Set()
  for (const seg of segments) {
    const contacts = await listAll(key, `/segments/${encodeURIComponent(seg.id)}/contacts`)
    const unsub = unsubscribedEmails(contacts)
    unsub.forEach((e) => all.add(e))
    console.log(`segment "${seg.name}": ${contacts.length} contacts, ${unsub.length} unsubscribed`)
  }
  console.log(`unsubscribed (distinct, all Dayspring segments): ${all.size}`)
  if (!apply) { console.log('dry-run: nothing written'); return }
  const { default: postgres } = await import('postgres')
  const sql = postgres(secret('DATABASE_URL'), { max: 1, prepare: false, ssl: 'require', onnotice() {} })
  try {
    let added = 0
    for (const email of all) {
      const r = await sql`INSERT INTO public.email_suppressions (email, source) VALUES (${email}, 'resend') ON CONFLICT (email) DO NOTHING`
      added += r.count
    }
    console.log(`applied: ${added} new, ${all.size - added} already present`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
}
