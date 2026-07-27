/**
 * Derive DECLARED threads — the recurring SUBJECTS in /pray and /sense — into the
 * unified Threads model (threads.kind='declared', members via
 * thread_members.spiritual_item_id).
 *
 * This is a thin CLI over api/_lib/declared.ts. It deliberately holds NO clustering
 * logic of its own: an earlier version of this script kept a "sharpened" private
 * copy of the tagging prompt while the cron ran a different, older algorithm, and
 * the two silently disagreed for weeks — the register-magnet bug that made the
 * Altar unreadable. One implementation, two entry points.
 *
 * Tagging is the only priced step, and it persists (spiritual_items.subject_tags),
 * so tuning the GROUPING is free and repeatable:
 *
 *   npx tsx scripts/derive-declared.ts --owner me@x.com --tag        # read untagged lines (costs money)
 *   npx tsx scripts/derive-declared.ts --owner me@x.com --dry        # group + report, write nothing (free)
 *   npx tsx scripts/derive-declared.ts --owner me@x.com              # tag any remainder, then write threads
 *   npx tsx scripts/derive-declared.ts --owner me@x.com --retag      # clear tags and re-read everything
 *
 * Tune MIN_TOUCHES / MIN_WEEKS / SUBJECT_MERGE in api/_lib/declared.ts, then
 * re-run --dry. No model calls, so iterate freely.
 */

import { readFileSync } from 'node:fs'

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

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const TAG_ONLY = args.includes('--tag')
const RETAG = args.includes('--retag')
const maxIdx = args.indexOf('--max')
const MAX = maxIdx >= 0 ? Number(args[maxIdx + 1]) || 0 : 0

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) { console.error(`Missing env: ${missing.join(', ')}`); process.exit(1) }

const {
  tagPlan, tagSubjects, planDeclared, regroupDeclared,
  MIN_TOUCHES, MIN_WEEKS, SUBJECT_MERGE,
} = await import('../api/_lib/declared.ts')
const { resetSubjectTags } = await import('../api/_lib/altar.ts')
const { requireOwner } = await import('./_owner.ts')
const owner = await requireOwner()

function snip(text: string, max = 90): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim()
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

// ── retag ────────────────────────────────────────────────────────────────────
if (RETAG) {
  const { cleared } = await resetSubjectTags(owner)
  console.log(`Cleared subject tags on ${cleared} lines — they will be re-read.`)
}

// ── tag (priced; each line is read once) ─────────────────────────────────────
if (!DRY) {
  let { untagged } = await tagPlan(owner)
  console.log(`Untagged prayer/sense lines: ${untagged}`)
  const budget = MAX || Infinity
  let read = 0
  while (untagged > 0 && read < budget) {
    const batch = Math.min(untagged, budget - read, 500)
    const res = await tagSubjects(owner, { max: batch })
    read += res.read
    untagged = res.remaining
    console.log(`  tagged ${read} (kept ${res.kept} in the last batch) · ${untagged} remaining`)
    if (res.read === 0) break // nothing progressed — don't spin
  }
}

// ── group + report (free) ────────────────────────────────────────────────────
const plan = await planDeclared(owner)
console.log(`\n── Declared subject threads ─────────────────────────────────────`)
console.log(`  Lines tagged:      ${plan.taggedItems}`)
console.log(`  Kept (non-filler): ${plan.keptItems}  (dropped ${plan.taggedItems - plan.keptItems})`)
console.log(`  Distinct labels:   ${plan.distinctLabels} → ${plan.canonicalSubjects} canonical (merge ≥ ${SUBJECT_MERGE})`)
console.log(`  Threads:           ${plan.subjects.length}  (≥${MIN_TOUCHES} touches, ≥${MIN_WEEKS} distinct weeks)`)
console.log(`  Below the gate:    ${plan.belowGate} groups dropped\n`)

const shown = plan.subjects.slice(0, 40)
for (const s of shown) {
  console.log(
    `  [${s.type}·${s.subjectKind}] ${s.label} — ${s.itemIds.length} touches · ${s.weeks}w · ` +
    `${s.spanStart.slice(0, 10)} → ${s.spanEnd.slice(0, 10)}`,
  )
}
if (plan.subjects.length > shown.length) {
  console.log(`  … and ${plan.subjects.length - shown.length} more`)
}

const heftiest = plan.subjects[0]
if (heftiest) {
  console.log(`\n  Largest thread: "${heftiest.label}" with ${heftiest.itemIds.length} touches.`)
  console.log(`  (If one thread holds a large share of all touches, the vocabulary is still`)
  console.log(`   collapsing — raise SUBJECT_MERGE rather than lowering the gates.)`)
}

if (DRY || TAG_ONLY) {
  console.log(`\n${DRY ? '--dry' : '--tag'}: no threads written.`)
  process.exit(0)
}

// ── write ────────────────────────────────────────────────────────────────────
console.log(`\nSyncing threads…`)
const res = await regroupDeclared(owner)
console.log(`  subjects:        ${res.subjects}`)
console.log(`  created:         ${res.created}`)
console.log(`  updated:         ${res.updated}`)
console.log(`  members +${res.membersAdded} / -${res.membersRemoved}`)
console.log(`  pruned:          ${res.pruned}`)
console.log(`  preserved:       ${res.preserved}  (encounter named, user-renamed, or dismissed)`)
console.log(`  left dismissed:  ${res.skippedDismissed}`)
console.log(`\nDone.`)
