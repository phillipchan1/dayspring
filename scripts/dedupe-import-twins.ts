// Cleanup for EXACT duplicate entries left by the Diarly import running twice.
//
//   npx tsx scripts/dedupe-import-twins.ts               # dry run + backup
//   npx tsx scripts/dedupe-import-twins.ts --apply       # re-point, then delete
//
// Why this is a separate script from dedupe-entries.ts
// ----------------------------------------------------
// dedupe-entries.ts targets two *native* bugs (autosave torn state, conflict
// forks) and its lesserOf() deliberately refuses to nominate an imported row for
// deletion. That guard is correct for the bugs it covers, so it is left alone.
// These twins come from a third cause it was never meant to see: the Diarly
// import ran twice, and the second run's rows carry fresh external_ids, so the
// unique index on (owner, source, external_id) could not collapse them. Both
// halves are source='other', which lesserOf() answers with null — hence the
// 611 rows it reports nothing about.
//
// The bar for deleting here is much higher than "similar": same owner, same
// calendar day, and a byte-identical body_markdown. No fuzzy matching at all.
//
// What is referenced, and what that costs
// ---------------------------------------
//   spiritual_items.entry_id          ON DELETE SET NULL  -> marking survives, loses its page
//   scripture_refs.entry_id           ON DELETE CASCADE   -> destroyed
//   concordance_occurrences.entry_id  ON DELETE CASCADE   -> destroyed (derived, regenerable)
//   concordance_events.entry_id       ON DELETE SET NULL  -> benign (an observation log)
//   thread_members.entry_id           ON DELETE CASCADE   -> destroyed
//   echo_candidates.entry_id          ON DELETE CASCADE   -> ephemeral, cron replaces weekly
//   threads.member_entry_ids          uuid[], NO FK       -> would dangle
//   altar_candidate_dismissals        uuid,   NO FK       -> would dangle
//
// So the survivor is chosen by what points AT it, not by which id sorts first,
// and anything the dropped twin holds that the survivor lacks is re-pointed
// before the delete rather than left to the cascade.
//
// Logs ids, dates and counts only - never entry text (the backup file holds the
// text, because that is the thing being recovered from).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function loadDotEnv(): void {
  let raw = ''
  try {
    raw = readFileSync('.env', 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv()

const APPLY = process.argv.includes('--apply')
const BACKUP_DIR = '/Users/philchan/dayspring-dedupe-backup'

function flagValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const OWNER = flagValue('owner') ?? '847ccda8-396c-4cb6-9800-61053b87da0a'

const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const md5 = (s: string) => createHash('md5').update(s ?? '').digest('hex')

interface Entry {
  id: string
  owner: string
  created_at: string
  updated_at: string
  body_markdown: string
  title: string | null
  mood: string | null
  tags: string[] | null
  word_count: number
  source: string
  external_id: string | null
}

async function fetchEntries(): Promise<Entry[]> {
  const out: Entry[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('entries')
      .select('id, owner, created_at, updated_at, body_markdown, title, mood, tags, word_count, source, external_id')
      .eq('owner', OWNER)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as Entry[]))
    if ((data ?? []).length < 1000) break
  }
  return out
}

/** Rows of `table` whose `col` is one of `ids`, fetched in chunks. */
async function refsFor<T>(table: string, cols: string, col: string, ids: string[]): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from(table).select(cols).in(col, ids.slice(i, i + 200))
    if (error) throw new Error(`${table}.${col}: ${error.message}`)
    out.push(...((data ?? []) as T[]))
  }
  return out
}

const entries = await fetchEntries()
console.log(`owner ${OWNER}`)
console.log(`scanned ${entries.length} entries`)

// --- group: same calendar day + byte-identical body ---
const groups = new Map<string, Entry[]>()
for (const e of entries) {
  const key = `${e.created_at.slice(0, 10)}|${md5(e.body_markdown)}`
  const g = groups.get(key)
  if (g) g.push(e)
  else groups.set(key, [e])
}
const twinGroups = [...groups.values()].filter((g) => g.length > 1)

if (twinGroups.length === 0) {
  console.log('no exact duplicate groups found')
  process.exit(0)
}

const twinIds = twinGroups.flatMap((g) => g.map((e) => e.id))
console.log(`${twinGroups.length} exact duplicate group(s), ${twinIds.length} rows involved`)

// --- what points at these rows ---
type Item = { id: string; entry_id: string; type: string; content: string; metadata: unknown; created_at: string; resolved_at: string | null; owner: string }
type Sref = { id: string; entry_id: string; osis_ref: string }
type Occ = { concordance_id: string; entry_id: string }
type Member = { id: string; entry_id: string; thread_id: string }

const items = await refsFor<Item>('spiritual_items', 'id, owner, entry_id, type, content, metadata, created_at, resolved_at', 'entry_id', twinIds)
const srefs = await refsFor<Sref>('scripture_refs', 'id, entry_id, osis_ref', 'entry_id', twinIds)
const occs = await refsFor<Occ>('concordance_occurrences', 'concordance_id, entry_id', 'entry_id', twinIds)
const members = await refsFor<Member>('thread_members', 'id, entry_id, thread_id', 'entry_id', twinIds)

const index = <T extends { entry_id: string }>(xs: T[]): Map<string, T[]> => {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const g = m.get(x.entry_id)
    if (g) g.push(x)
    else m.set(x.entry_id, [x])
  }
  return m
}
const itemsBy = index(items)
const srefsBy = index(srefs)
const occsBy = index(occs)
const membersBy = index(members)

console.log(`\nreferences held by these rows:`)
console.log(`  spiritual_items         = ${items.length}   (SET NULL)`)
console.log(`  scripture_refs          = ${srefs.length}   (CASCADE)`)
console.log(`  concordance_occurrences = ${occs.length}   (CASCADE, derived)`)
console.log(`  thread_members          = ${members.length}   (CASCADE)`)

// --- decide the survivor by what references it ---
const weight = (id: string) =>
  (itemsBy.get(id)?.length ?? 0) +
  (srefsBy.get(id)?.length ?? 0) +
  (membersBy.get(id)?.length ?? 0) +
  (occsBy.get(id)?.length ?? 0)

interface Plan {
  day: string
  keep: Entry
  drop: Entry[]
  repointItems: string[]
  repointSrefs: string[]
  repointMembers: string[]
  derivedLost: number
}

const plans: Plan[] = []
for (const g of twinGroups) {
  const ranked = [...g].sort((a, b) => weight(b.id) - weight(a.id) || (a.id < b.id ? -1 : 1))
  const keep = ranked[0]!
  const drop = ranked.slice(1)

  // spiritual_items: SET NULL would orphan the marking. Move any the survivor
  // does not already hold (same type + same content).
  const seenItem = new Set((itemsBy.get(keep.id) ?? []).map((i) => `${i.type} ${i.content}`))
  const repointItems: string[] = []
  for (const d of drop) {
    for (const i of itemsBy.get(d.id) ?? []) {
      const sig = `${i.type} ${i.content}`
      if (!seenItem.has(sig)) {
        repointItems.push(i.id)
        seenItem.add(sig)
      }
    }
  }

  // scripture_refs: unique index is (entry_id, osis_ref), so only move refs
  // whose osis_ref the survivor lacks; the rest are already represented.
  const seenOsis = new Set((srefsBy.get(keep.id) ?? []).map((s) => s.osis_ref))
  const repointSrefs: string[] = []
  for (const d of drop) {
    for (const s of srefsBy.get(d.id) ?? []) {
      if (!seenOsis.has(s.osis_ref)) {
        repointSrefs.push(s.id)
        seenOsis.add(s.osis_ref)
      }
    }
  }

  // thread_members: partial unique index on (thread_id, entry_id).
  const seenThread = new Set((membersBy.get(keep.id) ?? []).map((m) => m.thread_id))
  const repointMembers: string[] = []
  for (const d of drop) {
    for (const m of membersBy.get(d.id) ?? []) {
      if (!seenThread.has(m.thread_id)) {
        repointMembers.push(m.id)
        seenThread.add(m.thread_id)
      }
    }
  }

  const keepConc = new Set((occsBy.get(keep.id) ?? []).map((o) => o.concordance_id))
  let derivedLost = 0
  for (const d of drop) for (const o of occsBy.get(d.id) ?? []) if (!keepConc.has(o.concordance_id)) derivedLost++

  plans.push({ day: keep.created_at.slice(0, 10), keep, drop, repointItems, repointSrefs, repointMembers, derivedLost })
}

const dropIds = plans.flatMap((p) => p.drop.map((d) => d.id))
const allRepointItems = plans.flatMap((p) => p.repointItems)
const allRepointSrefs = plans.flatMap((p) => p.repointSrefs)
const allRepointMembers = plans.flatMap((p) => p.repointMembers)

console.log(`\nplan:`)
console.log(`  rows to delete                       = ${dropIds.length}`)
console.log(`  spiritual_items to re-point first    = ${allRepointItems.length}`)
console.log(`  scripture_refs to re-point first     = ${allRepointSrefs.length}`)
console.log(`  thread_members to re-point first     = ${allRepointMembers.length}`)
console.log(`  groups needing any re-point          = ${plans.filter((p) => p.repointItems.length || p.repointSrefs.length || p.repointMembers.length).length}`)
console.log(`  concordance rows lost (regenerable)  = ${plans.reduce((a, p) => a + p.derivedLost, 0)}`)

// --- backup: everything the delete would touch ---
mkdirSync(BACKUP_DIR, { recursive: true })
const stamp = new Date(entries[0]?.updated_at ?? '1970-01-01').toISOString().slice(0, 10)
const backupPath = `${BACKUP_DIR}/twins-${OWNER.slice(0, 8)}-${stamp}-${dropIds.length}rows.json`
const dropSet = new Set(dropIds)
const backup = {
  owner: OWNER,
  generated_from_entries: entries.length,
  groups: plans.length,
  deleted_rows: plans.flatMap((p) => p.drop),
  surviving_ids: plans.map((p) => p.keep.id),
  cascade_casualties: {
    spiritual_items: items.filter((i) => dropSet.has(i.entry_id)),
    scripture_refs: srefs.filter((s) => dropSet.has(s.entry_id)),
    concordance_occurrences: occs.filter((o) => dropSet.has(o.entry_id)),
    thread_members: members.filter((m) => dropSet.has(m.entry_id)),
  },
  repoint: { items: allRepointItems, srefs: allRepointSrefs, members: allRepointMembers },
  plan: plans.map((p) => ({ day: p.day, keep: p.keep.id, drop: p.drop.map((d) => d.id) })),
}
writeFileSync(backupPath, JSON.stringify(backup, null, 2))
console.log(`\nbackup written: ${backupPath}`)

if (!APPLY) {
  console.log(`\nfirst 10 groups:`)
  for (const p of plans.slice(0, 10)) {
    console.log(
      `  ${p.day}  keep ${p.keep.id} (refs ${weight(p.keep.id)})  drop ${p.drop.map((d) => `${d.id} (refs ${weight(d.id)})`).join(', ')}` +
        (p.repointItems.length ? `  +${p.repointItems.length} item(s) to move` : ''),
    )
  }
  console.log(`\ndry run: ${dropIds.length} row(s) deletable. Re-run with --apply.`)
  process.exit(0)
}

// --- apply: re-point everything first, only then delete ---
async function repoint(table: string, ids: string[], entryIdFor: Map<string, string>): Promise<void> {
  for (const id of ids) {
    const { error } = await sb.from(table).update({ entry_id: entryIdFor.get(id)! }).eq('id', id)
    if (error) throw new Error(`re-point ${table} ${id}: ${error.message}`)
  }
}

const itemTarget = new Map<string, string>()
const srefTarget = new Map<string, string>()
const memberTarget = new Map<string, string>()
for (const p of plans) {
  for (const id of p.repointItems) itemTarget.set(id, p.keep.id)
  for (const id of p.repointSrefs) srefTarget.set(id, p.keep.id)
  for (const id of p.repointMembers) memberTarget.set(id, p.keep.id)
}

await repoint('spiritual_items', allRepointItems, itemTarget)
console.log(`re-pointed ${allRepointItems.length} spiritual_item(s)`)
await repoint('scripture_refs', allRepointSrefs, srefTarget)
console.log(`re-pointed ${allRepointSrefs.length} scripture_ref(s)`)
await repoint('thread_members', allRepointMembers, memberTarget)
console.log(`re-pointed ${allRepointMembers.length} thread_member(s)`)

// Clear the dangling uuid[] / FK-less references before the rows vanish.
const { data: threadRows, error: thErr } = await sb.from('threads').select('id, member_entry_ids').eq('owner', OWNER)
if (thErr) throw thErr
let threadsFixed = 0
for (const t of (threadRows ?? []) as Array<{ id: string; member_entry_ids: string[] }>) {
  const cleaned = (t.member_entry_ids ?? []).map((eid) => {
    if (!dropSet.has(eid)) return eid
    const p = plans.find((x) => x.drop.some((d) => d.id === eid))!
    return p.keep.id
  })
  const deduped = [...new Set(cleaned)]
  if (deduped.join(',') !== (t.member_entry_ids ?? []).join(',')) {
    const { error } = await sb.from('threads').update({ member_entry_ids: deduped }).eq('id', t.id)
    if (error) throw new Error(`threads ${t.id}: ${error.message}`)
    threadsFixed++
  }
}
console.log(`re-pointed member_entry_ids on ${threadsFixed} thread(s)`)

let deleted = 0
for (let i = 0; i < dropIds.length; i += 100) {
  const chunk = dropIds.slice(i, i + 100)
  const { error } = await sb.from('entries').delete().in('id', chunk)
  if (error) {
    console.error(`delete failed at chunk ${i}: ${error.message}`)
    console.error(`backup is at ${backupPath}`)
    process.exit(1)
  }
  deleted += chunk.length
  console.log(`  deleted ${deleted}/${dropIds.length}`)
}
console.log(`\ndeleted ${deleted} duplicate row(s). Backup: ${backupPath}`)
