// POST /api/pages/interpret — a sentence becomes a set of filters.
//
//   Authorization: Bearer <supabase access token>
//   { "q": "times I talked about Chicago", "facets": ["highlight", "scripture"] }
//
// This is NOT a search endpoint. It returns a CONFIGURATION — terms, dates,
// markings — and the wall does the matching itself, in code, against the
// corpus already sitting in the browser. Five rules hold it together, in order
// of how much they matter:
//
//   1. Code decides what matches. The model returns words; `subjects.ts` does
//      the literal, whole-word matching. The model cannot make a page light up.
//   2. The model may ORDER, but only within the set code already matched. Ids
//      it invents are dropped, not honoured (see docs/product/DECISIONS.md).
//   3. Everything it configured comes back as chips the writer can pull off.
//      Nothing is applied invisibly.
//   4. Ordering by date is always one click away, and is the fallback whenever
//      ranking is off, offline, or the call fails.
//   5. Offline degrades to a literal word search, silently. The wall must never
//      need the network.
//
// Cost discipline, same rule as api/ask.ts: the model never sees the corpus. It
// sees the question and the writer's own vocabulary — a few hundred tokens,
// regardless of whether the archive is 40 entries or 4,000.

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { callModel } from '../_lib/openai.js'

/** Facet keys the wall knows how to apply. Anything else is dropped. */
const FACETS = [
  'mark',
  'highlight',
  'highlight:amber',
  'highlight:rose',
  'highlight:sage',
  'highlight:sky',
  'highlight:lilac',
  'underline',
  'bold',
  'quote',
  'scripture',
] as const

const ARRANGE = ['date', 'by-year', 'by-month'] as const

const SCHEMA = {
  type: 'object',
  properties: {
    terms: {
      type: 'array',
      description: 'Words to light up, in the writer’s own spelling. Empty if the question names none.',
      items: { type: 'string' },
    },
    facets: {
      type: 'array',
      description: 'Markings the question asks for.',
      items: { type: 'string', enum: FACETS as unknown as string[] },
    },
    months: {
      type: 'array',
      description: 'Calendar months asked for, 0–11. Empty unless the question names one.',
      items: { type: 'integer' },
    },
    from: { type: ['string', 'null'], description: 'ISO date, or null.' },
    to: { type: ['string', 'null'], description: 'ISO date, or null.' },
    arrange: { type: 'string', enum: ARRANGE as unknown as string[] },
  },
  required: ['terms', 'facets', 'months', 'from', 'to', 'arrange'],
  additionalProperties: false,
} as const

const SYSTEM = [
  'You turn a sentence about someone’s own journal into a set of filters.',
  '',
  'You do NOT search. You do NOT answer. You do NOT summarise. You return only',
  'the filters, and other code applies them to the writing.',
  '',
  'Rules:',
  '- terms: the words to light up, in the spellings THIS writer uses. You are',
  '  given their vocabulary; prefer their spellings and nicknames over yours.',
  '  A place, person or subject named in the question belongs here. Words that',
  '  merely frame the question ("times", "when", "find me", "every") do not.',
  '- Return terms ONLY for things the question actually names. If it names',
  '  nothing, return an empty list. Never invent a plausible subject.',
  '- facets: only when the question asks about how a page was MARKED —',
  '  highlighted, underlined, marked, quoted, or citing scripture.',
  '- arrange: "by-year" when the question is about recurrence across years',
  '  ("every year", "each summer"); "by-month" for within-a-year recurrence;',
  '  otherwise "date".',
  '- months: only when the question names a month or season.',
  '',
  'Never guess at emotional content. "Times I felt lost" has no term you can',
  'supply — return an empty terms list rather than a word the writer never used.',
].join('\n')

export interface Interpreted {
  terms: string[]
  facets: string[]
  months: number[]
  from: string | null
  to: string | null
  arrange: (typeof ARRANGE)[number]
}

const isoOrNull = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10)
}

/**
 * Everything the model returns is checked before it leaves here.
 *
 * A facet the wall can't apply, a month that isn't a month, a date that isn't a
 * date — each becomes nothing rather than an error, because a filter the writer
 * can't see and can't remove is worse than a filter that never appeared.
 */
export function sanitize(raw: Partial<Interpreted> | null): Interpreted {
  const allowed = new Set<string>(FACETS)
  const terms = Array.isArray(raw?.terms)
    ? raw.terms
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        // Two characters is the same floor `subjects.ts` uses; below it, a term
        // lights half the archive.
        .filter((t) => t.length >= 2)
        .slice(0, 6)
    : []
  const facets = Array.isArray(raw?.facets)
    ? [...new Set(raw.facets.filter((f): f is string => typeof f === 'string' && allowed.has(f)))]
    : []
  const months = Array.isArray(raw?.months)
    ? [...new Set(raw.months.filter((m): m is number => Number.isInteger(m) && m >= 0 && m <= 11))]
    : []
  const arrange = ARRANGE.includes(raw?.arrange as (typeof ARRANGE)[number])
    ? (raw!.arrange as (typeof ARRANGE)[number])
    : 'date'
  return { terms, facets, months, from: isoOrNull(raw?.from), to: isoOrNull(raw?.to), arrange }
}

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
  if (q.length > 300) return Response.json({ error: 'question too long' }, { status: 400 })

  try {
    const sb = supabaseAdmin()
    // The writer's own vocabulary, so "Chi-town" and "Chicago" are one subject
    // to them and to us. Free — one table read, no model involvement.
    const { data: conc } = await sb
      .from('concordance')
      .select('canonical, surface_forms, kind')
      .eq('owner', user.id)
      .in('status', ['suggested', 'confirmed'])
      .limit(200)

    const vocabulary = (conc ?? []).map((c: Record<string, unknown>) => ({
      name: String(c.canonical ?? ''),
      also: (c.surface_forms as string[] | null) ?? [],
      kind: String(c.kind ?? ''),
    }))

    const raw = await callModel<Partial<Interpreted>>(
      SYSTEM,
      { question: q, vocabulary },
      SCHEMA as unknown as Record<string, unknown>,
      'pages_interpret',
      'low',
      512,
    )

    return Response.json({ question: q, ...sanitize(raw) })
  } catch {
    // A failed interpretation is not an error the writer needs to see: the wall
    // falls back to searching for the words they typed, which is what it would
    // have done without this endpoint at all.
    return Response.json({ question: q, ...sanitize(null), failed: true })
  }
}
