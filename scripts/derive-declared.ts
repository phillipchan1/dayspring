/**
 * Derive DECLARED threads — recurring SUBJECTS in /pray and /sense — into the
 * unified Threads & Ropes model (threads.kind='declared', members via
 * thread_members.spiritual_item_id).
 *
 * WHY subjects, not text-clusters:
 *   Embedding-clustering raw prayer text pools by devotional REGISTER — "thank you
 *   Lord", "Morning father", "Praise god!" gather together though they're about
 *   nothing in particular. A thread is valuable when it's tied to a SUBJECT (a
 *   person, place, or recurring theme): "trading", "Esther", "drawing near to God".
 *
 *   So each declared item is tagged with its subject(s); generic devotional filler
 *   and ordinary narration are dropped (keep=false); subject labels are
 *   canonicalized (so "trading discipline" + "playbook" → one subject); then the
 *   recurrence gate keeps only subjects actually returned to over time. Prayers and
 *   senses form SEPARATE subject threads (a petition ≠ a prophetic sense).
 *
 *   (Subject tagging mirrors api/_lib/altar.ts → regroupSubjects/TAG_PROMPT, kept
 *   inline here so this tuning script stays self-contained and --dry-friendly.)
 *
 *   npx tsx scripts/derive-declared.ts --dry            # tag + group, write nothing
 *   npx tsx scripts/derive-declared.ts --dry --sample 400  # quick look at recent N
 *   npx tsx scripts/derive-declared.ts                  # write declared threads
 */

// ── config ────────────────────────────────────────────────────────────────────

const MIN_TOUCHES   = 3      // min prayers/senses touching a subject (recurrence)
const MIN_WEEKS     = 3      // min distinct calendar weeks (recurrence, not a burst)
const SUBJECT_MERGE = 0.62   // cosine bar to merge two subject LABELS into one
const LENS_MATCH    = 0.40   // cosine(label, interior-lens desc) to fold a theme into a lens — MAIN TUNING KNOB
const TAG_BATCH     = 6      // items per tagging call
const TAG_POOL      = 6      // concurrent tagging calls
const MAX_SUBJECTS_PER_ITEM = 3
const LABEL_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano'

// Mirrors TAG_PROMPT in api/_lib/altar.ts, sharpened: the subject is the concrete
// life-MATTER behind the prayer, never the virtue requested or the One addressed.
const TAG_PROMPT = `You read short prayers/notes from one person's private faith journal. Identify the concrete real-life MATTER
each prayer is ABOUT — so prayers about the same thing gather into one cairn.

The subject is the person, place, or situation in the writer's life that the prayer concerns. Return up to 3 as {label, kind}:
 - kind "person": a specific named person or group prayed FOR ("Esther", "Obi", "the kids", "my mom"). NOT who is being prayed TO.
 - kind "place": a place, work, or life context ("Frontier", "trading", "our home", "church").
 - kind "theme": a SUBSTANTIVE recurring struggle or area of life — "purity", "drawing near to God", "anxiety",
   "marriage", "parenting", "rest", "identity". A real situation, not a quality being requested.

CRITICAL — what is NOT a subject:
 - NEVER the virtue or quality being asked for: wisdom, strength, grace, favor, patience, peace, guidance, help,
   breakthrough, growth, humility, confidence, focus, clarity, love, trust, joy, blessing, protection. These are
   the ASK, not the subject. "Lord give me wisdom on trading" → subject is "trading", not "wisdom".
 - NEVER who is being prayed TO: God, Jesus, Father, the Lord, Holy Spirit, the Spirit, Abba. The addressee is
   not a subject.
 - If a prayer is ONLY a generic request for such qualities addressed to God with no concrete person/place/
   situation ("Lord give me wisdom and strength today", "Father, thank you"), set keep=false.

Use SHORT canonical labels (1–4 words), lowercase except proper names, and REUSE the same label across notes for
the same thing. Ordinary narration ("wearing new headphones, feels good") → keep=false. A "sense" counts only if
it is a genuine sense of GOD speaking / leading / showing something (never merely because the word "feel" appears).

Return ONLY JSON: {"notes":[{"id":string,"keep":boolean,"subjects":[{"label":string,"kind":"person"|"place"|"theme"}]}]}.`

// Deterministic safety net — labels the model returns anyway that can never be a
// cairn on their own. Lowercased. UNIVERSAL across tenants: every faith journal
// shares this vocabulary, so none of it is one user's personal data.
const STOP_LABELS = new Set([
  // virtues / qualities requested (the ASK, not the subject)
  'wisdom', 'strength', 'grace', 'favor', 'patience', 'peace', 'guidance', 'help', 'breakthrough',
  'growth', 'humility', 'confidence', 'focus', 'clarity', 'direction', 'love', 'trust', 'trust in god',
  'joy', 'blessing', 'protection', 'faith', 'hope', 'rest', 'improvement', 'discipline', 'courage',
  // the One addressed — never a subject
  'god', 'jesus', 'jesus christ', 'christ', 'father', 'heavenly father', 'lord', 'the lord',
  'holy spirit', 'the holy spirit', 'spirit', 'the spirit', 'holy ghost', 'abba', 'god the father',
  // vague self-reference — praying for oneself with no specific matter
  'me', 'myself', 'self', 'my life', 'my heart', 'my soul', 'my mind', 'i',
  // deictic / placeholder non-subjects — point at "something" without naming it
  'heart', 'life', 'this', 'that', 'this situation', 'the situation', 'situation', 'this thing',
  'things', 'everything', 'stuff', 'today', 'this season', 'this time', 'it all',
  // bare pronouns — too ambiguous to be a reliable subject
  'her', 'him', 'them', 'she', 'he', 'they', 'it', 'us', 'we', 'you', 'someone',
])

// ── bootstrap ─────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
// Multitenancy: themes fold ONLY into the UNIVERSAL interior lenses (Prayer·Presence,
// Purity, Provision, Relationships, Emotions, Scripture) — these generalize to any
// faith-journal user. The personal DOMAINS in lenses.ts (SCE/Trading/Frontier) are
// one user's life and are deliberately NOT used here; concrete subjects (people,
// places, projects, churches) emerge per-tenant from the writer's own words.
import { INTERIOR_LENSES } from './lenses.ts'

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
const sampleIdx = args.indexOf('--sample')
const SAMPLE = sampleIdx >= 0 ? Number(args[sampleIdx + 1]) || 0 : 0

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) { console.error(`Missing env: ${missing.join(', ')}`); process.exit(1) }

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { embed, cosine } = await import('../api/_lib/embeddings.ts')
import OpenAI from 'openai'
const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, maxRetries: 5 })
const { requireOwner } = await import('./_owner.ts')
const owner = await requireOwner()
const sb = supabaseAdmin()

// ── types ─────────────────────────────────────────────────────────────────────

type ItemType = 'prayer' | 'sense'
type SubjectKind = 'person' | 'place' | 'theme'

interface ItemRow {
  id: string
  type: ItemType
  content: string
  sourceDate: string   // parent entry's date if present, else the item's own
}

interface Tag { label: string; kind: SubjectKind }

// ── helpers ───────────────────────────────────────────────────────────────────

function isoWeek(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const thu = new Date(day); thu.setUTCDate(thu.getUTCDate() - ((thu.getUTCDay() + 6) % 7) + 3)
  const ys = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  return `${thu.getUTCFullYear()}-W${String(Math.ceil(((thu.getTime() - ys.getTime()) / 86_400_000 + 1) / 7)).padStart(2, '0')}`
}

function snip(text: string, max = 90): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim()
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

async function mapPool<T, R>(xs: T[], pool: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(xs.length)
  let next = 0
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++
      if (i >= xs.length) return
      out[i] = await fn(xs[i]!, i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(pool, xs.length) }, worker))
  return out
}

// ── load declared prayer/sense items + their source dates ─────────────────────

console.log('Loading declared /pray and /sense items…')
const items: ItemRow[] = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb
    .from('spiritual_items')
    .select('id, type, content, created_at, entries(created_at)')
    .eq('owner', owner)
    .in('type', ['prayer', 'sense'])
    .order('created_at', { ascending: true })
    .range(from, from + 499)
  if (error) throw error
  if (!data?.length) break
  type Row = { id: string; type: ItemType; content: string; created_at: string; entries: { created_at: string } | null }
  for (const r of data as unknown as Row[]) {
    const content = (r.content ?? '').trim()
    if (!content) continue
    items.push({ id: r.id, type: r.type, content, sourceDate: r.entries?.created_at ?? r.created_at })
  }
  if (data.length < 500) break
}
console.log(`Loaded ${items.length} declared items.`)

// Optional sampling for fast iteration (most recent N).
const pool = SAMPLE > 0 ? items.slice(-SAMPLE) : items
if (SAMPLE > 0) console.log(`Sampling the most recent ${pool.length}.`)
if (pool.length === 0) { console.log('Nothing to derive.'); process.exit(0) }

// ── 1. tag each item with subjects (drop filler; gate sense) ──────────────────

console.log(`Tagging subjects (${LABEL_MODEL}, batch ${TAG_BATCH} × pool ${TAG_POOL})…`)
const batches: ItemRow[][] = []
for (let i = 0; i < pool.length; i += TAG_BATCH) batches.push(pool.slice(i, i + TAG_BATCH))

const itemTags = new Map<string, Tag[]>()   // itemId → subjects (only kept items)
let done = 0
await mapPool(batches, TAG_POOL, async (batch) => {
  const input = batch.map((r) => ({ id: r.id.slice(-8), text: r.content.slice(0, 600) }))
  const shortMap = new Map(batch.map((r) => [r.id.slice(-8), r.id]))
  try {
    const res = await oai.chat.completions.create({
      model: LABEL_MODEL, temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: `${TAG_PROMPT}\n\nNotes: ${JSON.stringify(input)}` }],
    })
    const raw = (res.choices[0]?.message?.content ?? '').trim()
    const parsed = JSON.parse(raw) as { notes?: { id: string; keep: boolean; subjects?: Tag[] }[] }
    for (const n of parsed.notes ?? []) {
      if (!n.keep) continue
      const fullId = shortMap.get(n.id)
      if (!fullId) continue
      const tags = (n.subjects ?? [])
        .map((s) => ({ label: (s.label || '').trim(), kind: s.kind }))
        .filter((s): s is Tag => !!s.label && ['person', 'place', 'theme'].includes(s.kind))
        .filter((s) => !STOP_LABELS.has(s.label.toLowerCase()))   // drop virtues + divine addressees
        .slice(0, MAX_SUBJECTS_PER_ITEM)
      if (tags.length) itemTags.set(fullId, tags)
    }
  } catch { process.stdout.write('!') }
  done += batch.length
  if (done % 300 < TAG_BATCH) process.stdout.write(`\r  tagged ${done}/${pool.length}   `)
})
console.log(`\n  Kept ${itemTags.size} of ${pool.length} (dropped ${pool.length - itemTags.size} as filler/narration).`)

// ── 2. canonicalize the subject vocabulary ─────────────────────────────────────
// Themes fold into the UNIVERSAL interior lenses when they clearly match (money/
// debts → Provision, presence/relationship with God → Prayer·Presence) — tenant-
// agnostic, since these lenses generalize to any faith journal. Named people and
// concrete places/projects are NEVER folded — they emerge per-user (Esther stays
// Esther; one user's "trading" ≠ another's). Labels matching no lens fall back to
// embedding-merge among same-kind subjects, so personal subjects still survive.

interface LabelInfo { orig: string; kind: Record<string, number>; count: number }
const labelInfo = new Map<string, LabelInfo>()
for (const tags of itemTags.values()) {
  for (const t of tags) {
    const key = t.label.toLowerCase()
    const info = labelInfo.get(key) ?? { orig: t.label, kind: {}, count: 0 }
    info.count++
    info.kind[t.kind] = (info.kind[t.kind] ?? 0) + 1
    labelInfo.set(key, info)
  }
}
const labels = [...labelInfo.keys()].sort((a, b) => labelInfo.get(b)!.count - labelInfo.get(a)!.count)

interface Canon { name: string; kind: SubjectKind; centroid: number[]; n: number; lensKey: string | null }
const canons: Canon[] = []
const labelToCanon = new Map<string, number>()
const lensToCanon = new Map<string, number>()   // lens.key → canon idx (one shared cairn per lens)

function mergeInto(ci: number, v: number[]): void {
  const c = canons[ci]!
  for (let d = 0; d < v.length; d++) c.centroid[d] = (c.centroid[d]! * c.n + v[d]!) / (c.n + 1)
  c.n++
}

if (labels.length) {
  console.log(`Canonicalizing ${labels.length} distinct subject labels (lens fold ≥ ${LENS_MATCH})…`)
  const [labelVecs, lensVecs] = await Promise.all([
    embed(labels.map((l) => labelInfo.get(l)!.orig)),
    embed(INTERIOR_LENSES.map((l) => l.desc)),
  ])

  labels.forEach((l, idx) => {
    const v = labelVecs[idx]!
    const info = labelInfo.get(l)!
    const kind = (Object.entries(info.kind).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'theme') as SubjectKind

    // Only THEMES fold into a universal interior lens. People and concrete places
    // never fold — they emerge per-tenant from the writer's own words.
    if (kind === 'theme') {
      let bestLens = -1, bestSim = -1
      for (let i = 0; i < INTERIOR_LENSES.length; i++) {
        const sim = cosine(v, lensVecs[i]!)
        if (sim > bestSim) { bestSim = sim; bestLens = i }
      }
      if (bestLens >= 0 && bestSim >= LENS_MATCH) {
        const key = INTERIOR_LENSES[bestLens]!.key
        let ci = lensToCanon.get(key)
        if (ci == null) {
          canons.push({ name: INTERIOR_LENSES[bestLens]!.label, kind, centroid: v.slice(), n: 1, lensKey: key })
          ci = canons.length - 1
          lensToCanon.set(key, ci)
        } else {
          mergeInto(ci, v)
        }
        labelToCanon.set(l, ci)
        return
      }
    }

    // Fallback: embedding-merge among same-kind, non-lens canons (preserves
    // granular subjects outside the taxonomy).
    let best = -1, bestSim = -1
    for (let i = 0; i < canons.length; i++) {
      const c = canons[i]!
      if (c.lensKey || c.kind !== kind) continue
      const sim = cosine(v, c.centroid)
      if (sim > bestSim) { bestSim = sim; best = i }
    }
    if (best >= 0 && bestSim >= SUBJECT_MERGE) {
      mergeInto(best, v)
      labelToCanon.set(l, best)
    } else {
      canons.push({ name: info.orig, kind, centroid: v.slice(), n: 1, lensKey: null })
      labelToCanon.set(l, canons.length - 1)
    }
  })
}

// ── 3. build threads per (type, canonical subject), apply recurrence gate ─────

interface DeclThread {
  type: ItemType
  canon: number
  label: string
  subjectKind: SubjectKind
  items: ItemRow[]
  weeks: number
  spanStart: Date
  spanEnd: Date
}

const byKey = new Map<string, ItemRow[]>()   // `${type}::${canonIdx}` → items
const itemById = new Map(pool.map((r) => [r.id, r]))
for (const [itemId, tags] of itemTags) {
  const it = itemById.get(itemId)!
  const canonSet = new Set<number>()
  for (const t of tags) { const ci = labelToCanon.get(t.label.toLowerCase()); if (ci != null) canonSet.add(ci) }
  for (const ci of canonSet) {
    const key = `${it.type}::${ci}`
    ;(byKey.get(key) ?? byKey.set(key, []).get(key)!).push(it)
  }
}

const threads: DeclThread[] = []
for (const [key, members] of byKey) {
  if (members.length < MIN_TOUCHES) continue
  const weeks = new Set(members.map((m) => isoWeek(new Date(m.sourceDate))))
  if (weeks.size < MIN_WEEKS) continue
  const [type, ciStr] = key.split('::')
  const ci = Number(ciStr)
  const dates = members.map((m) => new Date(m.sourceDate).getTime())
  threads.push({
    type: type as ItemType,
    canon: ci,
    label: canons[ci]!.name,
    subjectKind: canons[ci]!.kind,
    items: members,
    weeks: weeks.size,
    spanStart: new Date(Math.min(...dates)),
    spanEnd: new Date(Math.max(...dates)),
  })
}
threads.sort((a, b) => b.items.length - a.items.length)

// ── report ────────────────────────────────────────────────────────────────────

console.log(`\n── Declared subject threads ─────────────────────────────────────`)
console.log(`  Items tagged:     ${pool.length} (prayer ${pool.filter((i) => i.type === 'prayer').length} · sense ${pool.filter((i) => i.type === 'sense').length})`)
console.log(`  Kept (non-filler):${itemTags.size}`)
console.log(`  Subjects:         ${canons.length} canonical`)
console.log(`  Declared threads: ${threads.length}  (≥${MIN_TOUCHES} touches, ≥${MIN_WEEKS} weeks)\n`)
for (const t of threads.slice(0, 30)) {
  console.log(`  [${t.type}·${t.subjectKind}] ${t.label} — ${t.items.length} touches · ${t.weeks}w · ${t.spanStart.toISOString().slice(0, 10)} → ${t.spanEnd.toISOString().slice(0, 10)}`)
  console.log(`      └ "${snip(t.items[0]!.content)}"`)
}

if (DRY) {
  console.log(`\n--dry: nothing written. Tune MIN_TOUCHES / MIN_WEEKS / SUBJECT_MERGE, then drop --dry.`)
  process.exit(0)
}

// ── write declared threads (replace previous declared run for this owner) ─────

console.log(`\nWriting declared threads…`)
const { data: prev } = await sb.from('threads').select('id').eq('owner', owner).eq('kind', 'declared')
const prevIds = (prev ?? []).map((r: { id: string }) => r.id)
if (prevIds.length) {
  await sb.from('thread_members').delete().in('thread_id', prevIds)
  await sb.from('threads').delete().in('id', prevIds)
  console.log(`  Cleared ${prevIds.length} previous declared threads.`)
}

const LENS_FOR_TYPE: Record<ItemType, string> = { prayer: 'Prayer · Presence', sense: 'Sense' }

let written = 0
for (const t of threads) {
  const temp = Math.max(0.1, Math.min(1, 1 - (Date.now() - t.spanEnd.getTime()) / (365 * 24 * 3_600_000)))
  const lens = LENS_FOR_TYPE[t.type]
  const seedId = t.items.reduce((a, b) => (a.sourceDate <= b.sourceDate ? a : b)).id

  const { data: tdata, error: terr } = await sb.from('threads').insert({
    owner,
    kind: 'declared',
    type: t.type,
    subject_kind: t.subjectKind,
    label: t.label,
    label_ai: t.label,
    lens,
    lenses: [lens],
    interior: true,
    member_entry_ids: [],
    weight: t.items.length,
    breadth: 1,
    span_start: t.spanStart.toISOString(),
    span_end: t.spanEnd.toISOString(),
    temperature: temp,
    seed_item_id: seedId,
  }).select('id').single()
  if (terr) { console.warn(`  thread insert error: ${terr.message}`); continue }

  const threadId = (tdata as { id: string }).id
  const rows = t.items.map((it) => ({
    thread_id: threadId,
    spiritual_item_id: it.id,
    register: t.type === 'prayer' ? 'bringing' : 'neutral',
  }))
  const { error: merr } = await sb.from('thread_members').insert(rows)
  if (merr) console.warn(`  member insert error: ${merr.message}`)
  else written++
}

console.log(`Wrote ${written} declared subject threads.`)
console.log(`\nDone. (Phase 2 wires the Altar lens to read these via the threads data seam.)`)
