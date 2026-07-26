// POST /api/ask — the Well's retrieval pass.
//
//   Authorization: Bearer <supabase access token>
//   { "q": "tell me every time I talked about trading" }
//
// Three legs, unioned, then arranged:
//   1. LEXICAL   — the Concordance expands the question into the writer's OWN
//                  vocabulary ("trading" → NQ, futures, the prop account), so
//                  entries that never say the word still come back. Free: one
//                  table read, no model call.
//   2. VECTOR    — cosine over entries.embedding, catching the entries that
//                  circle the thing without ever naming it.
//   3. ARRANGE   — ONE small nano pass that picks 3–4 beats from a trimmed
//                  candidate set and writes a single line about the density.
//
// Cost discipline (same rule as api/cron/echoes.ts): the model never sees the
// corpus. It sees ~12 truncated candidates — roughly 2k tokens per question,
// regardless of whether the answer spans 4 entries or 400.
//
// Facts are COMPUTED IN CODE — never by the model (see api/_lib/facts.ts for
// the same rule). Beats are verbatim-gated: any quote that isn't a literal
// substring of its entry is dropped, never repaired.

import { getAuthedUser, notAuthenticated } from './_lib/userAuth.js'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { embed, toVectorLiteral } from './_lib/embeddings.js'
import { callModel } from './_lib/openai.js'

// ── tuning ──────────────────────────────────────────────────────────────────
const VECTOR_COUNT = 40
const LEXICAL_COUNT = 60
/** Candidates actually shown to the model. Bounds cost independent of corpus size. */
const ARRANGE_SAMPLE = 12
/** Per-candidate characters sent to the model. */
const ARRANGE_CHARS = 700
/** Buckets in the density strip the Well draws. */
const BUCKETS = 92
/** A vector hit further than this isn't about the question — it's just the nearest thing. */
const MAX_DISTANCE = 0.62

// ── arrange pass ────────────────────────────────────────────────────────────

const ARRANGE_SCHEMA = {
  type: 'object',
  properties: {
    shape_line: { type: 'string' },
    beats: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          entry_id: { type: 'string' },
          tag: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['entry_id', 'tag', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['shape_line', 'beats'],
  additionalProperties: false,
}

const ARRANGE_PROMPT = `You are arranging someone's own journal entries into the shape of a question they asked about their life.

You are given their question and a set of candidate entries (id, date, an excerpt of what they wrote).

Return:

1. "shape_line" — ONE plain sentence about the DISTRIBUTION over time. Describe when they wrote about this and when they didn't. Say nothing about what it means, what they should do, or what kind of person they are. Good: "Constant through 2021 and 2022, then almost nothing until this spring." Bad: "This was clearly a difficult season of growth for you."

2. "beats" — 3 or 4 moments, EARLIEST FIRST. For each:
   - "entry_id": the id of the entry it came from, exactly as given
   - "tag": two or three words marking its place in the sequence — e.g. "First", "The turn", "Most recent", "Densest stretch"
   - "text": ONE OR TWO SENTENCES COPIED VERBATIM from that entry's excerpt

Rules:
- "text" MUST be copied character-for-character from the excerpt of the entry you cite. Do not fix typos, trim quotes, change punctuation, or join non-adjacent sentences. It is checked against the original and silently dropped if it does not match.
- Choose beats that carry the ARC — where it started, where it changed, where it stands now. Not the most dramatic lines.
- Never add commentary, encouragement, interpretation, or a conclusion about the person. You select and order. You do not narrate.
- If the candidates don't genuinely answer the question, return an empty beats array. Returning nothing is correct and expected.`

interface ArrangeOut {
  shape_line: string
  beats: { entry_id: string; tag: string; text: string }[]
}

// ── helpers ─────────────────────────────────────────────────────────────────

interface Row {
  id: string
  created_at: string
  body_markdown: string
  word_count: number
}

/** Strip the app's spiritual-block markup so excerpts read as plain prose. */
function plain(md: string): string {
  return md
    .replace(/^:::.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[*_`>#]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function iso(d: Date): string {
  return d.toISOString()
}

function monthYear(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** Longest run of consecutive months with no matching entry. */
function longestGapMonths(sorted: Row[]): number {
  let longest = 0
  for (let i = 1; i < sorted.length; i++) {
    const a = new Date(sorted[i - 1]!.created_at).getTime()
    const b = new Date(sorted[i]!.created_at).getTime()
    const months = (b - a) / (30.44 * 86_400_000)
    if (months > longest) longest = months
  }
  return Math.floor(longest)
}

/**
 * Terms from the writer's own Concordance that the question touches. Matching is
 * whole-word on the canonical form or any surface form, so "chart" doesn't fire
 * on "uncharted". Returns the union of every form of every entity that matched —
 * that union IS the recall the lexical leg is for.
 */
function expandViaConcordance(
  q: string,
  rows: { canonical: string; surface_forms: string[]; kind: string }[],
): { canonical: string; kind: string; terms: string[] } | null {
  const lower = q.toLowerCase()
  const hasWord = (t: string) => {
    const term = t.trim().toLowerCase()
    if (term.length < 2) return false
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(lower)
  }

  let best: { canonical: string; kind: string; terms: string[]; score: number } | null = null
  for (const row of rows) {
    const forms = [row.canonical, ...(row.surface_forms ?? [])].filter(Boolean)
    const matched = forms.filter(hasWord)
    if (matched.length === 0) continue
    // Prefer the entity whose matched form is longest — "prop account" beats "account".
    const score = Math.max(...matched.map((m) => m.length))
    if (!best || score > best.score) {
      best = { canonical: row.canonical, kind: row.kind, terms: forms, score }
    }
  }
  return best ? { canonical: best.canonical, kind: best.kind, terms: best.terms } : null
}

/** Even sample across time, plus the nearest vector hits — the arc, not the top-k. */
function sampleForArrange(rows: Row[], nearest: Set<string>): Row[] {
  if (rows.length <= ARRANGE_SAMPLE) return rows
  const picked = new Map<string, Row>()
  // Always the first and the last — the arc's endpoints.
  picked.set(rows[0]!.id, rows[0]!)
  picked.set(rows[rows.length - 1]!.id, rows[rows.length - 1]!)
  // The closest vector matches carry the middle.
  for (const r of rows) {
    if (picked.size >= ARRANGE_SAMPLE) break
    if (nearest.has(r.id)) picked.set(r.id, r)
  }
  // Fill any remainder evenly across the span so a dense year can't crowd out a decade.
  if (picked.size < ARRANGE_SAMPLE) {
    const step = Math.max(1, Math.floor(rows.length / (ARRANGE_SAMPLE - picked.size)))
    for (let i = 0; i < rows.length && picked.size < ARRANGE_SAMPLE; i += step) {
      picked.set(rows[i]!.id, rows[i]!)
    }
  }
  return [...picked.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}

// ── handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return notAuthenticated()

  let body: { q?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }
  const q = (body.q ?? '').trim()
  if (!q) return Response.json({ error: 'q is required' }, { status: 400 })
  if (q.length > 400) return Response.json({ error: 'question too long' }, { status: 400 })

  const sb = supabaseAdmin()
  const owner = user.id

  try {
    // ── corpus span — the axis the shape strip is drawn against ──────────────
    const [{ data: oldest }, { data: newest }] = await Promise.all([
      sb.from('entries').select('created_at').eq('owner', owner)
        .order('created_at', { ascending: true }).limit(1).maybeSingle(),
      sb.from('entries').select('created_at').eq('owner', owner)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (!oldest || !newest) {
      return Response.json({ question: q, total: 0, beats: [], buckets: [], facts: [] })
    }
    const spanFrom = new Date(oldest.created_at as string)
    const spanTo = new Date(newest.created_at as string)

    // ── leg 1: the writer's own vocabulary (free) ───────────────────────────
    const { data: conc } = await sb
      .from('concordance')
      .select('canonical, surface_forms, kind')
      .eq('owner', owner)
      .in('status', ['suggested', 'confirmed'])
    const expansion = expandViaConcordance(q, conc ?? [])

    // ── legs 1 + 2 in parallel ──────────────────────────────────────────────
    const [vec] = await embed([q])
    const [vectorRes, lexicalRes] = await Promise.all([
      sb.rpc('match_entries', {
        query_embedding: toVectorLiteral(vec!),
        owner_id: owner,
        match_count: VECTOR_COUNT,
      }),
      expansion
        ? sb.rpc('match_entries_lexical', {
            owner_id: owner,
            terms: expansion.terms,
            match_count: LEXICAL_COUNT,
          })
        : Promise.resolve({ data: [], error: null }),
    ])
    if (vectorRes.error) throw vectorRes.error

    const vectorHits = ((vectorRes.data ?? []) as { entry_id: string; distance: number }[])
      .filter((r) => r.distance <= MAX_DISTANCE)
    const lexicalHits = ((lexicalRes.data ?? []) as { entry_id: string }[])

    const ids = new Set<string>([
      ...vectorHits.map((r) => r.entry_id),
      ...lexicalHits.map((r) => r.entry_id),
    ])
    if (ids.size === 0) {
      return Response.json({
        question: q, total: 0, beats: [], buckets: [], facts: [],
        span: { from: iso(spanFrom), to: iso(spanTo) },
        expansion: expansion ? { canonical: expansion.canonical, forms: expansion.terms } : null,
        legs: { vector: 0, lexical: 0 },
      })
    }

    // ── the matched entries, in TIME order (relevance order kills the story) ──
    const { data: rowsRaw, error: rowsErr } = await sb
      .from('entries')
      .select('id, created_at, body_markdown, word_count')
      .eq('owner', owner)
      .in('id', [...ids])
      .order('created_at', { ascending: true })
    if (rowsErr) throw rowsErr
    const rows = (rowsRaw ?? []) as Row[]

    // ── facts: computed in code ─────────────────────────────────────────────
    const gap = longestGapMonths(rows)
    const facts: { value: string; label: string }[] = [
      { value: String(rows.length), label: rows.length === 1 ? 'entry' : 'entries' },
      { value: monthYear(rows[0]!.created_at), label: 'first' },
      { value: monthYear(rows[rows.length - 1]!.created_at), label: 'most recent' },
    ]
    if (gap >= 2) facts.push({ value: `${gap} mo`, label: 'longest silence' })

    // ── density buckets across the corpus span ──────────────────────────────
    const t0 = spanFrom.getTime()
    const t1 = spanTo.getTime()
    const width = Math.max(1, t1 - t0)
    const buckets = new Array<number>(BUCKETS).fill(0)
    for (const r of rows) {
      const idx = Math.min(
        BUCKETS - 1,
        Math.max(0, Math.floor(((new Date(r.created_at).getTime() - t0) / width) * BUCKETS)),
      )
      buckets[idx] = (buckets[idx] ?? 0) + 1
    }

    // ── leg 3: arrange (the only model call) ────────────────────────────────
    const nearest = new Set(vectorHits.slice(0, 8).map((r) => r.entry_id))
    const sample = sampleForArrange(rows, nearest)
    const byId = new Map(rows.map((r) => [r.id, r]))

    let arranged: ArrangeOut | null = null
    try {
      arranged = await callModel<ArrangeOut>(
        ARRANGE_PROMPT,
        {
          question: q,
          candidates: sample.map((r) => ({
            entry_id: r.id,
            date: r.created_at.slice(0, 10),
            excerpt: plain(r.body_markdown).slice(0, ARRANGE_CHARS),
          })),
        },
        ARRANGE_SCHEMA as Record<string, unknown>,
        'ask_arrange',
        'low',
        1024,
      )
    } catch {
      arranged = null // the shape and the facts still stand without it
    }

    // ── verbatim gate — a quote that isn't in its entry is dropped, not fixed ──
    const beats = (arranged?.beats ?? [])
      .map((b) => {
        const row = byId.get(b.entry_id)
        if (!row) return null
        const hay = plain(row.body_markdown)
        const text = b.text.trim()
        if (!text || !hay.includes(text)) return null
        return {
          entry_id: b.entry_id,
          date: row.created_at,
          tag: b.tag.slice(0, 24),
          text,
        }
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return Response.json({
      question: q,
      total: rows.length,
      span: { from: iso(spanFrom), to: iso(spanTo) },
      buckets,
      facts,
      beats,
      shapeLine: arranged?.shape_line?.trim() ?? null,
      expansion: expansion ? { canonical: expansion.canonical, forms: expansion.terms } : null,
      legs: { vector: vectorHits.length, lexical: lexicalHits.length },
      entryIds: rows.map((r) => r.id),
    })
  } catch (e) {
    console.error('[ask]', e)
    return Response.json(
      { error: e instanceof Error ? e.message : 'ask failed' },
      { status: 500 },
    )
  }
}
