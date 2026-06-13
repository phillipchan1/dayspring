/**
 * Verify getRopesAtHorizon — STEP 1 gate (read-only).
 *
 * Logs heft / lenses / pools / repLine per warmth band per horizon against the
 * real thread_members, using the SAME pure buildBands the client seam uses, so
 * the numbers here are exactly what the converged Ascent will render.
 *
 *   npx tsx scripts/verify-horizons.ts
 *
 * No writes. No LLM. Just aggregation you can eyeball before any UI work.
 */

import { readFileSync } from 'node:fs'
import { buildBands, type RawThread, type RawRope, type RawMember } from '../src/features/threads/data/bands.ts'
import type { Horizon } from '../src/features/threads/data/types.ts'

function loadDotEnv(): void {
  let raw = ''
  try { raw = readFileSync('.env', 'utf8') } catch { return }
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv()

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) { console.error(`Missing env: ${missing.join(', ')}`); process.exit(1) }

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { requireOwner } = await import('./_owner.ts')
const owner = await requireOwner()
const sb = supabaseAdmin()

// ── load (service role bypasses RLS → filter by owner explicitly) ──────────────

const { data: tdata, error: terr } = await sb
  .from('threads')
  .select('id, lens, domain, rope_id, label, label_ai, label_user, private, dismissed')
  .eq('owner', owner)
  .eq('dismissed', false)
if (terr) { console.error('threads:', terr.message); process.exit(1) }
const threads = (tdata ?? []) as RawThread[]

const { data: rdata, error: rerr } = await sb
  .from('ropes')
  .select('id, label, label_user')
  .eq('owner', owner)
if (rerr) { console.error('ropes:', rerr.message); process.exit(1) }
const ropes = (rdata ?? []) as RawRope[]

const threadIds = threads.map((t) => t.id)
const { data: mdata, error: merr } = await sb
  .from('thread_members')
  .select('thread_id, entry_id, entries(created_at, body_markdown, superseded)')
  .in('thread_id', threadIds)
if (merr) { console.error('thread_members:', merr.message); process.exit(1) }

type MRow = {
  thread_id: string
  entry_id: string
  entries: { created_at: string; body_markdown: string; superseded: boolean } | null
}
const members: RawMember[] = ((mdata ?? []) as unknown as MRow[])
  .filter((m) => m.entries && !m.entries.superseded)
  .map((m) => ({ thread_id: m.thread_id, entry_id: m.entry_id, created_at: m.entries!.created_at, body: m.entries!.body_markdown }))

console.log(`\nloaded — threads:${threads.length}  ropes:${ropes.length}  members:${members.length}  (owner ${owner.slice(0, 8)}…)`)

// ── report per horizon ─────────────────────────────────────────────────────────

const now = Date.now()
const ALT: { h: Horizon; name: string }[] = [
  { h: 0, name: 'VALLEY · 7d' },
  { h: 1, name: 'HILLSIDE · month' },
  { h: 2, name: 'RIDGE · quarter' },
  { h: 3, name: 'SUMMIT · year' },
]
const sparkChars = ' ▁▂▃▄▅▆▇█'
const spark = (pools: number[]) => pools.map((p) => sparkChars[Math.round(p * (sparkChars.length - 1))]).join('')

for (const { h, name } of ALT) {
  const bands = buildBands(threads, ropes, members, h, now)
  console.log(`\n━━ ${name} — ${bands.length} band${bands.length === 1 ? '' : 's'} ${'━'.repeat(40)}`)
  for (const b of bands) {
    const tag = b.private ? '🔒' : b.kind === 'rope' ? '⊕' : ' '
    console.log(`${tag} ${b.label}`)
    console.log(`    heft ${String(b.heft).padStart(3)}  ·  ${b.lenses.join(' · ') || '—'}`)
    console.log(`    pools [${spark(b.pools)}]  ${b.pools.map((p) => p.toFixed(2)).join(' ')}`)
    if (b.repLine) console.log(`    repLine (${b.repLine.date.slice(0, 10)}): "${b.repLine.excerpt.slice(0, 110)}"`)
  }
}
console.log('')
