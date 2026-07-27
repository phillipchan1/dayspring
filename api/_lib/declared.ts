// Declared threads — the prayers and senses you keep bringing back — grouped by
// SUBJECT.
//
// ── why this replaced embedding-clustering ────────────────────────────────────
// The previous builder (altar.ts → threadItems, now retired) placed each prayer
// into the nearest existing cluster at cosine ≥ 0.64 and re-averaged that
// cluster's centroid to include it. Two failures compounded:
//
//   1. Embedding similarity over prayer text measures devotional REGISTER, not
//      subject. "lord… help me… let me…" reads alike whether it's about a staff
//      conflict or a sermon, so the bar admitted near-anything.
//   2. Re-averaging turned a cluster into a magnet. Once a centroid drifted to the
//      middle of generic devotional space it out-competed every specific cluster
//      for every new prayer, so one heap ate years of unrelated praying.
//
// Measured on one real thread before the change: 299 members, of which 289 sat
// BELOW the 0.64 bar relative to the seed prayer — yet all 299 cleared it against
// the drifted centroid. Its title described its first six members and nothing else.
//
// ── the shape here ───────────────────────────────────────────────────────────
// Two phases, deliberately split by cost:
//
//   tagSubjects()    — the model reads each prayer/sense line ONCE, ever
//                      (spiritual_items.subject_tagged_at watermark) and persists
//                      what that line is ABOUT. Bounded per call, resumable.
//   regroupDeclared() — a deterministic recompute from those persisted tags:
//                      canonicalize the subject vocabulary, apply the recurrence
//                      gate, then SYNC threads + members. No model calls, so the
//                      whole field can be re-derived daily for the price of one
//                      embedding batch.
//
// The split is also what fixes the frozen-label bug: a thread's label IS its
// canonical subject, recomputed on every regroup, so it can never describe only
// the first few members of a heap that has since grown.
//
// Thread identity is preserved across regroups (label match, then member-overlap
// match) so encounters, user renames, and dismissals survive a rebuild — an
// encounter is the user's own word about how God moved and must never be
// collateral damage of a re-derivation. Logs counts only, never prayer text (§8).

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabaseAdmin.js'
import { callModel } from './openai.js'
import { cosine, embed } from './embeddings.js'

// ── tuning ───────────────────────────────────────────────────────────────────
/** Min lines touching a subject before it's a thread at all. */
export const MIN_TOUCHES = 3
/** Min DISTINCT calendar weeks — a subject prayed 5× in one week is a burst, not
 *  something returned to. This gate is what kills the singleton long tail. */
export const MIN_WEEKS = 3
/**
 * Cosine bar for merging two subject LABELS into one canonical subject. Labels are
 * short ("trading", "trading discipline"), so they cluster far tighter than whole
 * prayers — which is exactly why grouping by label is safe where grouping by prayer
 * text was not.
 *
 * DON'T LOWER THIS to tidy up near-duplicate subjects. Measured over 6,336 real
 * lines: at 0.55 "purity" merges into "anxiety" (a false merge that misfiles a
 * struggle) and the largest thread swells from 172 to 383 touches — the magnet
 * failure returning. 0.58 and 0.62 behave identically and merge nothing wrong.
 *
 * The residual it CANNOT fix: sibling labels like money/finances and
 * purity/porn/sexual-temptation stay separate at every safe bar, because label
 * embeddings put those pairs further apart than purity/anxiety. That's a limit of
 * the instrument, not a threshold to tune — the fix is in the tagging prompt (reuse
 * a canonical label) or an explicit alias table, never a looser bar.
 */
export const SUBJECT_MERGE = 0.62
/** A planned subject reuses an existing thread when this fraction of its members
 *  already belong to it — the fallback that keeps thread identity (and its
 *  encounter) stable when a canonical label is renamed by new tags. */
const REUSE_OVERLAP = 0.6
const MAX_SUBJECTS_PER_ITEM = 3
const TAG_BATCH = 6
const POOL = 3
/** Max ids in one `.in(...)` filter — PostgREST puts these in the URL, and ~1000
 *  uuids overflow it into a bare 400. */
const IN_CHUNK = 150
const PAGE = 1000

// ── the tagging prompt ───────────────────────────────────────────────────────
// The subject is the concrete life-MATTER behind the prayer — never the virtue
// requested, never the One addressed. Getting this distinction wrong is what
// produced heaps named after qualities ("Wisdom and strength to do right") that
// every prayer in a faith journal can claim.
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

Return JSON {"notes":[{"id":string,"keep":boolean,"subjects":[{"label":string,"kind":"person"|"place"|"theme"}]}]}.`

const TAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['notes'],
  properties: {
    notes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'keep', 'subjects'],
        properties: {
          id: { type: 'string' },
          keep: { type: 'boolean' },
          subjects: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'kind'],
              properties: {
                label: { type: 'string' },
                kind: { type: 'string', enum: ['person', 'place', 'theme'] },
              },
            },
          },
        },
      },
    },
  },
} as const

// Deterministic safety nets for labels the model returns anyway. UNIVERSAL across
// tenants: every faith journal shares this vocabulary, so none of it is one user's
// personal data.
//
// Split by kind on purpose. Half these words are also given NAMES — Grace, Joy,
// Hope, Faith, Mercy, Patience — so a single flat list would erase a real person
// from their own Altar. A word is rejected as a THEME because it's the thing being
// asked for; the same word as a PERSON is somebody the writer loves.

/** The One being prayed TO. Never a subject, under any kind. */
const DIVINE_LABELS = new Set([
  'god', 'jesus', 'jesus christ', 'christ', 'father', 'heavenly father', 'lord', 'the lord',
  'holy spirit', 'the holy spirit', 'spirit', 'the spirit', 'holy ghost', 'abba', 'god the father',
  "god's will", 'gods will', "god's plan", "god's presence", "god's glory", 'the father', 'the son',
])

/** Points at "someone"/"something" without naming it. Never a subject. */
const VAGUE_LABELS = new Set([
  'me', 'myself', 'self', 'my life', 'my heart', 'my soul', 'my mind', 'i',
  'heart', 'life', 'this', 'that', 'this situation', 'the situation', 'situation', 'this thing',
  'things', 'everything', 'stuff', 'today', 'this season', 'this time', 'it all', 'the day',
  'her', 'him', 'them', 'she', 'he', 'they', 'it', 'us', 'we', 'you', 'someone', 'somebody',
  'people', 'others', 'everyone', 'anyone',
])

/** The ASK, not the matter — rejected for themes and places, ALLOWED as a person's
 *  name (Grace, Joy, Hope, Faith, Mercy, Patience are people too). */
const ASK_LABELS = new Set([
  'wisdom', 'strength', 'grace', 'favor', 'patience', 'peace', 'guidance', 'help', 'breakthrough',
  'growth', 'humility', 'confidence', 'focus', 'clarity', 'direction', 'love', 'trust', 'trust in god',
  'joy', 'blessing', 'protection', 'faith', 'hope', 'rest', 'improvement', 'discipline', 'courage',
  'anointing', 'power', 'vision', 'mercy', 'forgiveness', 'obedience', 'surrender', 'gratitude',
  // the medium, not the matter
  'prayer', 'praying', 'worship', 'devotion', 'calling', 'purpose',
])

/** Can this (kind, label) pair stand as a subject? */
export function isSubjectLabel(label: string, kind: SubjectKind): boolean {
  const key = label.trim().toLowerCase()
  if (!key) return false
  if (DIVINE_LABELS.has(key) || VAGUE_LABELS.has(key)) return false
  if (kind !== 'person' && ASK_LABELS.has(key)) return false
  return true
}

// ── shapes ───────────────────────────────────────────────────────────────────
export type ItemType = 'prayer' | 'sense'
export type SubjectKind = 'person' | 'place' | 'theme'
export interface SubjectTag { label: string; kind: SubjectKind }

export interface TaggedItem {
  id: string
  type: ItemType
  /** Effective date: the parent entry's when linked, else the row's own. */
  date: string
  tags: SubjectTag[]
  /** Used only to collapse same-day duplicates (see dedupeSameDay). */
  content?: string
}

export interface PlannedSubject {
  type: ItemType
  label: string
  subjectKind: SubjectKind
  itemIds: string[]
  weeks: number
  spanStart: string
  spanEnd: string
  seedItemId: string
}

export interface DeclaredPlan {
  /** Lines carrying persisted tags (i.e. the model kept them). */
  taggedItems: number
  keptItems: number
  distinctLabels: number
  canonicalSubjects: number
  /** Groups that existed but failed the recurrence gate. */
  belowGate: number
  subjects: PlannedSubject[]
}

// ── helpers ──────────────────────────────────────────────────────────────────
async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    for (;;) {
      const idx = next++
      if (idx >= items.length) return
      out[idx] = await fn(items[idx]!, idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}

/** ISO week key — the unit of the "returned to over time" gate. */
function isoWeek(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const thu = new Date(day)
  thu.setUTCDate(thu.getUTCDate() - ((thu.getUTCDay() + 6) % 7) + 3)
  const ys = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  return `${thu.getUTCFullYear()}-W${String(Math.ceil(((thu.getTime() - ys.getTime()) / 86_400_000 + 1) / 7)).padStart(2, '0')}`
}

/**
 * Collapse the same prayer, written once but stored twice. The archive carries
 * duplicate ENTRIES from earlier imports (~894 prayer texts appear under more than
 * one entry id), which double-counts a thread's touches and makes the surface claim
 * the writer returned to something twice as often as they did. Two identical lines
 * on the SAME DAY are one praying; the same words months apart are two, and are
 * kept. Order-stable: the lowest id survives, so thread membership doesn't churn
 * between runs.
 */
function dedupeSameDay(members: TaggedItem[]): TaggedItem[] {
  const seen = new Map<string, TaggedItem>()
  const out: TaggedItem[] = []
  for (const m of [...members].sort((a, b) => a.id.localeCompare(b.id))) {
    const body = (m.content ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (!body) { out.push(m); continue }
    const key = `${m.date.slice(0, 10)}::${body}`
    if (seen.has(key)) continue
    seen.set(key, m)
    out.push(m)
  }
  return out
}

function cleanTags(raw: unknown): SubjectTag[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: SubjectTag[] = []
  for (const t of raw as { label?: unknown; kind?: unknown }[]) {
    const label = typeof t?.label === 'string' ? t.label.trim() : ''
    const kind = t?.kind
    if (!label) continue
    if (kind !== 'person' && kind !== 'place' && kind !== 'theme') continue
    const key = `${kind}::${label.toLowerCase()}`
    if (!isSubjectLabel(label, kind) || seen.has(key)) continue
    seen.add(key)
    out.push({ label, kind })
    if (out.length >= MAX_SUBJECTS_PER_ITEM) break
  }
  return out
}

/** All rows for an owner, paginated past PostgREST's 1000-row cap. */
async function fetchAll<T>(
  sb: SupabaseClient,
  table: string,
  select: string,
  owner: string,
  refine?: (q: any) => any,
  pageSize = PAGE,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    let q = sb.from(table).select(select).eq('owner', owner).range(from, from + pageSize - 1)
    if (refine) q = refine(q)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < pageSize) break
  }
  return out
}

// ── 1. tagging (the only phase that costs model calls) ───────────────────────

/** How many prayer/sense lines the model hasn't read yet. */
export async function tagPlan(owner: string): Promise<{ untagged: number }> {
  const sb = supabaseAdmin()
  const { count, error } = await sb
    .from('spiritual_items')
    .select('id', { count: 'exact', head: true })
    .eq('owner', owner)
    .in('type', ['prayer', 'sense'])
    .is('subject_tagged_at', null)
  if (error) throw error
  return { untagged: count ?? 0 }
}

/**
 * Ask the model what each line is about. PURE — reads and writes nothing, so the
 * tagging quality can be evaluated on real text without touching the database.
 * A batch the model fails on is simply absent from the result (never guessed at).
 */
export async function tagTexts(
  lines: { id: string; content: string }[],
): Promise<Map<string, SubjectTag[]>> {
  const batches: typeof lines[] = []
  for (let i = 0; i < lines.length; i += TAG_BATCH) batches.push(lines.slice(i, i + TAG_BATCH))

  const results = await mapPool(batches, POOL, async (batch) => {
    const out = new Map<string, SubjectTag[]>()
    let res: { notes?: { id: string; keep?: boolean; subjects?: unknown }[] }
    try {
      res = await callModel(
        TAG_PROMPT,
        { notes: batch.map((r) => ({ id: r.id, text: r.content.slice(0, 600) })) },
        TAG_SCHEMA as Record<string, unknown>,
        'declared_tag',
        'low',
        1200,
      )
    } catch {
      return out // caller leaves these lines untagged so a later run retries them
    }
    const ids = new Set(batch.map((r) => r.id))
    for (const n of res.notes ?? []) {
      if (!ids.has(n.id)) continue
      out.set(n.id, n.keep === false ? [] : cleanTags(n.subjects))
    }
    return out
  })

  const merged = new Map<string, SubjectTag[]>()
  for (const m of results) for (const [k, v] of m) merged.set(k, v)
  return merged
}

/**
 * Tag untagged prayer/sense lines with the concrete matter each is about. Every
 * line the model answered for is stamped `subject_tagged_at` whether or not it kept
 * any subject, so the model is never billed for the same line twice. Lines from a
 * batch that failed are left unstamped to retry on the next call.
 */
export async function tagSubjects(
  owner: string,
  opts: { max?: number } = {},
): Promise<{ read: number; kept: number; remaining: number }> {
  const sb = supabaseAdmin()

  // Count first, then fetch only what this run will read. The daily cron tags 120
  // lines out of a backlog that can be thousands — pulling every untagged row's
  // text just to slice it away was the bulk of this function's wall time.
  const { untagged } = await tagPlan(owner)
  if (untagged === 0) return { read: 0, kept: 0, remaining: 0 }

  // Newest first: fresh praying is what the surface shows, so a bounded run makes
  // the visible field correct soonest.
  const select = (q: any) =>
    q.in('type', ['prayer', 'sense']).is('subject_tagged_at', null).order('created_at', { ascending: false })
  let pool: { id: string; content: string }[]
  if (opts.max) {
    const { data, error } = await select(
      sb.from('spiritual_items').select('id, content').eq('owner', owner),
    ).range(0, opts.max - 1)
    if (error) throw error
    pool = (data ?? []) as { id: string; content: string }[]
  } else {
    pool = await fetchAll<{ id: string; content: string }>(sb, 'spiritual_items', 'id, content', owner, select)
  }
  if (pool.length === 0) return { read: 0, kept: 0, remaining: 0 }

  const tagsFor = await tagTexts(pool)

  // Per-row write: subject_tags differs per row, so there's no bulk form. Tagging
  // is a once-per-line cost, so this write happens once per line in the archive.
  const stamp = new Date().toISOString()
  let kept = 0
  const answered = pool.filter((r) => tagsFor.has(r.id))
  for (let i = 0; i < answered.length; i += TAG_BATCH * POOL) {
    const slice = answered.slice(i, i + TAG_BATCH * POOL)
    await Promise.all(
      slice.map(async (r) => {
        const tags = tagsFor.get(r.id)!
        if (tags.length) kept++
        const { error } = await sb
          .from('spiritual_items')
          .update({ subject_tags: tags, subject_tagged_at: stamp })
          .eq('id', r.id)
          .eq('owner', owner)
        if (error) throw error
      }),
    )
  }

  return { read: answered.length, kept, remaining: untagged - answered.length }
}

// ── 2. grouping (deterministic — no model calls) ─────────────────────────────

/** Load every tagged prayer/sense line with its effective date. */
async function loadTagged(owner: string): Promise<TaggedItem[]> {
  const sb = supabaseAdmin()
  const rows = await fetchAll<{
    id: string
    type: ItemType
    entry_id: string | null
    created_at: string
    content: string
    subject_tags: unknown
  }>(
    sb,
    'spiritual_items',
    'id, type, entry_id, created_at, content, subject_tags',
    owner,
    (q) => q.in('type', ['prayer', 'sense']).not('subject_tagged_at', 'is', null),
  )

  const entryIds = [...new Set(rows.map((r) => r.entry_id).filter((x): x is string => !!x))]
  const entryDate = new Map<string, string>()
  for (let i = 0; i < entryIds.length; i += IN_CHUNK) {
    const { data, error } = await sb
      .from('entries')
      .select('id, created_at')
      .in('id', entryIds.slice(i, i + IN_CHUNK))
    if (error) throw error
    for (const e of (data ?? []) as { id: string; created_at: string }[]) entryDate.set(e.id, e.created_at)
  }

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    date: (r.entry_id && entryDate.get(r.entry_id)) || r.created_at,
    tags: cleanTags(r.subject_tags),
    content: r.content,
  }))
}

/** The plan for one owner: load persisted tags, then group them. */
export async function planDeclared(owner: string): Promise<DeclaredPlan> {
  return groupTagged(await loadTagged(owner))
}

/**
 * Group tagged lines into the subjects that clear the recurrence gate. Depends on
 * nothing but its arguments and the embedding API, so the grouping can be checked
 * against a real tag dump without touching the database.
 *
 * Deterministic: the label ordering is fully tie-broken, so two runs over the same
 * tags produce the same canonical names — which is what keeps thread identity (and
 * its encounter) stable across regroups.
 */
export async function groupTagged(
  items: TaggedItem[],
  opts: { merge?: number } = {},
): Promise<DeclaredPlan> {
  const mergeBar = opts.merge ?? SUBJECT_MERGE
  // Normalize here rather than trusting the caller: tags reach this function from
  // the database, from a local dump, and from tests, and the stop-label filter must
  // hold on all three paths.
  const normalized = items.map((i) => ({ ...i, tags: cleanTags(i.tags) }))
  const kept = normalized.filter((i) => i.tags.length > 0)

  // Count each distinct label, bucketed by PERSON vs not-person.
  //
  // The person boundary is real and must be kept: "Grace" the friend and "grace"
  // the virtue are different subjects, and merging them by label alone would file a
  // person under a quality. The theme/place boundary is NOT real — it's a taxonomy
  // the model applies inconsistently to the same word, which split "trading" into a
  // 136-touch theme and a 19-touch place, and "work" likewise. Same word, same
  // matter: one thread, with the more common kind as its label.
  interface LabelInfo { orig: string; kinds: Record<string, number>; count: number }
  const labelInfo = new Map<string, LabelInfo>()
  const labelKey = (t: SubjectTag) =>
    `${t.kind === 'person' ? 'person' : 'subject'}::${t.label.toLowerCase()}`
  for (const it of kept) {
    for (const t of it.tags) {
      const key = labelKey(t)
      const info = labelInfo.get(key) ?? { orig: t.label, kinds: {}, count: 0 }
      info.count++
      info.kinds[t.kind] = (info.kinds[t.kind] ?? 0) + 1
      labelInfo.set(key, info)
    }
  }
  // Frequency desc, then alphabetical — the alphabetical tiebreak is load-bearing:
  // without it, equal-count labels shuffle between runs, canonical names change,
  // and stable threads look like new ones.
  const labels = [...labelInfo.keys()].sort(
    (a, b) => labelInfo.get(b)!.count - labelInfo.get(a)!.count || a.localeCompare(b),
  )

  interface Canon { name: string; kind: SubjectKind; centroid: number[]; n: number }
  const canons: Canon[] = []
  const labelToCanon = new Map<string, number>()

  if (labels.length) {
    const vecs = await embed(labels.map((l) => labelInfo.get(l)!.orig))
    labels.forEach((l, idx) => {
      const v = vecs[idx]!
      const info = labelInfo.get(l)!
      // Display kind = the one the model chose most often for this word (stable
      // tiebreak so the label doesn't flip between runs).
      const kind = (Object.entries(info.kinds).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
        'theme') as SubjectKind
      const isPerson = kind === 'person'

      // Merge across the person boundary only: a person named "Grace" must never
      // fold into a theme, and two named people are never the same subject.
      let best = -1
      let bestSim = -1
      for (let i = 0; i < canons.length; i++) {
        if ((canons[i]!.kind === 'person') !== isPerson) continue
        const sim = cosine(v, canons[i]!.centroid)
        if (sim > bestSim) { bestSim = sim; best = i }
      }
      if (best >= 0 && bestSim >= mergeBar) {
        const c = canons[best]!
        for (let d = 0; d < v.length; d++) c.centroid[d] = (c.centroid[d]! * c.n + v[d]!) / (c.n + 1)
        c.n++
        labelToCanon.set(l, best)
      } else {
        canons.push({ name: info.orig, kind, centroid: v.slice(), n: 1 })
        labelToCanon.set(l, canons.length - 1)
      }
    })
  }

  // A line joins the subject(s) it was tagged with, split by type — a petition and
  // a prophetic sense about the same matter are not one thread.
  const byKey = new Map<string, TaggedItem[]>()
  for (const it of kept) {
    const cset = new Set<number>()
    for (const t of it.tags) {
      const ci = labelToCanon.get(labelKey(t))
      if (ci != null) cset.add(ci)
    }
    for (const ci of cset) {
      const key = `${it.type}::${ci}`
      ;(byKey.get(key) ?? byKey.set(key, []).get(key)!).push(it)
    }
  }

  const subjects: PlannedSubject[] = []
  let belowGate = 0
  for (const [key, raw] of byKey) {
    const members = dedupeSameDay(raw)
    const weeks = new Set(members.map((m) => isoWeek(new Date(m.date))))
    if (members.length < MIN_TOUCHES || weeks.size < MIN_WEEKS) { belowGate++; continue }
    const ci = Number(key.split('::')[1])
    const sorted = [...members].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    subjects.push({
      type: key.split('::')[0] as ItemType,
      label: canons[ci]!.name,
      subjectKind: canons[ci]!.kind,
      itemIds: sorted.map((m) => m.id),
      weeks: weeks.size,
      spanStart: sorted[0]!.date,
      spanEnd: sorted[sorted.length - 1]!.date,
      seedItemId: sorted[0]!.id,
    })
  }
  subjects.sort((a, b) => b.itemIds.length - a.itemIds.length || a.label.localeCompare(b.label))

  return {
    taggedItems: items.length,
    keptItems: kept.length,
    distinctLabels: labels.length,
    canonicalSubjects: canons.length,
    belowGate,
    subjects,
  }
}

// ── 3. sync the plan into threads + thread_members ───────────────────────────

interface ExistingThread {
  id: string
  label: string
  label_user: string | null
  type: string | null
  subject_kind: string | null
  dismissed: boolean
  memberIds: Set<string>
}

async function loadExistingDeclared(owner: string): Promise<ExistingThread[]> {
  const sb = supabaseAdmin()
  const threads = await fetchAll<{
    id: string
    label: string
    label_user: string | null
    type: string | null
    subject_kind: string | null
    dismissed: boolean
  }>(sb, 'threads', 'id, label, label_user, type, subject_kind, dismissed', owner, (q) =>
    q.eq('kind', 'declared').order('id', { ascending: true }),
  )
  if (threads.length === 0) return []

  const members = new Map<string, Set<string>>()
  const ids = threads.map((t) => t.id)
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const slice = ids.slice(i, i + IN_CHUNK)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from('thread_members')
        .select('id, thread_id, spiritual_item_id')
        .in('thread_id', slice)
        .not('spiritual_item_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as { thread_id: string; spiritual_item_id: string }[]
      for (const m of rows) {
        ;(members.get(m.thread_id) ?? members.set(m.thread_id, new Set()).get(m.thread_id)!).add(m.spiritual_item_id)
      }
      if (rows.length < PAGE) break
    }
  }

  return threads.map((t) => ({ ...t, memberIds: members.get(t.id) ?? new Set() }))
}

/** Thread ids the user has spoken over — an encounter is their word about how God
 *  moved, so these threads are never deleted by a re-derivation. */
async function encounteredThreadIds(owner: string): Promise<Set<string>> {
  const sb = supabaseAdmin()
  const rows = await fetchAll<{ thread_ref: string | null }>(sb, 'encounters', 'thread_ref', owner)
  return new Set(rows.map((r) => r.thread_ref).filter((x): x is string => !!x))
}

export interface RegroupResult {
  subjects: number
  created: number
  updated: number
  membersAdded: number
  membersRemoved: number
  pruned: number
  /** Threads that no longer match a subject but were kept: the user has named an
   *  encounter on them, renamed them, or dismissed them. */
  preserved: number
  skippedDismissed: number
  /** Set when the regroup declined to run — the field was left exactly as it was. */
  skipped?: 'tagging-incomplete'
  untagged?: number
}

const EMPTY_REGROUP: RegroupResult = {
  subjects: 0, created: 0, updated: 0, membersAdded: 0, membersRemoved: 0,
  pruned: 0, preserved: 0, skippedDismissed: 0,
}

/**
 * Bring `threads` (kind='declared') in line with the current plan. Existing
 * threads are matched by subject label, then by member overlap, so ids survive a
 * relabel; unmatched threads are pruned unless the user has spoken over them.
 *
 * Convergent rather than strictly idempotent: a second run over unchanged tags
 * adds and removes no members and creates no threads, but it does refresh each
 * thread's span and temperature (temperature decays with wall-clock time).
 *
 * REFUSES TO RUN while any line is still untagged, unless forced. A plan built from
 * a partially-tagged archive is a plan that has never seen most of the writer's
 * praying: it would prune the existing field and replace it with the handful of
 * subjects visible so far, emptying someone's Altar for as long as the tagging
 * backlog takes to drain. The old field stays untouched until the new one is
 * complete, then swaps in one pass.
 */
export async function regroupDeclared(
  owner: string,
  opts: { force?: boolean } = {},
): Promise<RegroupResult> {
  const sb = supabaseAdmin()

  if (!opts.force) {
    const { untagged } = await tagPlan(owner)
    if (untagged > 0) return { ...EMPTY_REGROUP, skipped: 'tagging-incomplete', untagged }
  }

  const plan = await planDeclared(owner)
  const existing = await loadExistingDeclared(owner)
  const encountered = await encounteredThreadIds(owner)

  const byLabel = new Map<string, ExistingThread>()
  for (const t of existing) byLabel.set(`${t.type ?? ''}::${t.label.toLowerCase()}`, t)
  const claimed = new Set<string>()

  const res: RegroupResult = { ...EMPTY_REGROUP, subjects: plan.subjects.length }

  for (const s of plan.subjects) {
    // 1. exact subject match. 2. member-overlap match — the fallback that keeps a
    // thread's identity when new tags rename its canonical subject.
    let match = byLabel.get(`${s.type}::${s.label.toLowerCase()}`)
    if (match && claimed.has(match.id)) match = undefined
    if (!match) {
      const want = new Set(s.itemIds)
      let bestOverlap = 0
      for (const t of existing) {
        if (claimed.has(t.id) || t.type !== s.type || t.memberIds.size === 0) continue
        let hit = 0
        for (const id of t.memberIds) if (want.has(id)) hit++
        const overlap = hit / Math.max(t.memberIds.size, want.size)
        if (overlap > bestOverlap) { bestOverlap = overlap; match = t }
      }
      if (bestOverlap < REUSE_OVERLAP) match = undefined
    }

    // The user dismissed this subject — leave it dismissed and untouched.
    if (match?.dismissed) { claimed.add(match.id); res.skippedDismissed++; continue }

    const temperature = Math.max(
      0.1,
      Math.min(1, 1 - (Date.now() - Date.parse(s.spanEnd)) / (365 * 24 * 3_600_000)),
    )
    const fields = {
      kind: 'declared',
      type: s.type,
      subject_kind: s.subjectKind,
      label: s.label,
      label_ai: s.label,
      lens: s.type === 'prayer' ? 'Prayer · Presence' : 'Sense',
      lenses: [s.type === 'prayer' ? 'Prayer · Presence' : 'Sense'],
      interior: true,
      weight: s.itemIds.length,
      breadth: s.weeks,
      span_start: s.spanStart,
      span_end: s.spanEnd,
      temperature,
      seed_item_id: s.seedItemId,
    }

    let threadId: string
    if (match) {
      threadId = match.id
      claimed.add(threadId)
      const { error } = await sb.from('threads').update(fields).eq('id', threadId).eq('owner', owner)
      if (error) throw error
      res.updated++
    } else {
      const { data, error } = await sb
        .from('threads')
        .insert({ owner, dismissed: false, private: false, member_entry_ids: [], ...fields })
        .select('id')
        .single()
      if (error) throw error
      threadId = (data as { id: string }).id
      claimed.add(threadId)
      res.created++
    }

    // Sync members: add what's missing, drop what no longer belongs.
    const have = match?.memberIds ?? new Set<string>()
    const want = new Set(s.itemIds)
    const toAdd = s.itemIds.filter((id) => !have.has(id))
    const toRemove = [...have].filter((id) => !want.has(id))

    for (let i = 0; i < toAdd.length; i += IN_CHUNK) {
      const rows = toAdd.slice(i, i + IN_CHUNK).map((id) => ({
        thread_id: threadId,
        spiritual_item_id: id,
        register: s.type === 'prayer' ? 'bringing' : 'neutral',
      }))
      const { error } = await sb.from('thread_members').insert(rows)
      if (error) throw error
    }
    res.membersAdded += toAdd.length

    for (let i = 0; i < toRemove.length; i += IN_CHUNK) {
      const { error } = await sb
        .from('thread_members')
        .delete()
        .eq('thread_id', threadId)
        .in('spiritual_item_id', toRemove.slice(i, i + IN_CHUNK))
      if (error) throw error
    }
    res.membersRemoved += toRemove.length
  }

  // Prune what the plan no longer contains — except threads the user has spoken
  // over. Deleting a thread cascades its encounter away (encounters.thread_ref is
  // ON DELETE CASCADE), and an encounter is the one thing on this surface the
  // model never wrote.
  const stale = existing.filter((t) => !claimed.has(t.id))
  const prunable = stale.filter((t) => !encountered.has(t.id) && !t.label_user && !t.dismissed)
  res.preserved = stale.length - prunable.length

  const pruneIds = prunable.map((t) => t.id)
  for (let i = 0; i < pruneIds.length; i += IN_CHUNK) {
    const slice = pruneIds.slice(i, i + IN_CHUNK)
    // thread_members has ON DELETE CASCADE on thread_id, but delete explicitly so
    // the count is honest and the behaviour doesn't depend on the FK.
    const { error: mErr } = await sb.from('thread_members').delete().in('thread_id', slice)
    if (mErr) throw mErr
    const { error } = await sb.from('threads').delete().in('id', slice).eq('owner', owner)
    if (error) throw error
    res.pruned += slice.length
  }

  return res
}
