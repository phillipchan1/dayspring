// Client for POST /api/pages/interpret — a sentence becomes filters.
//
// The wall does its own matching, always, in code. This only decides WHICH
// filters to apply — and whatever it decides arrives as chips the writer can
// see and pull off, so nothing is ever applied invisibly.
//
// It is allowed to fail. A sentence that can't be interpreted falls back to
// lighting the words that were typed, which is exactly what the wall did before
// this existed. That is also what happens on a plane.

import { apiPost } from '@/lib/api'

export interface Interpretation {
  question: string
  /** Words to light, in the writer's own spellings. */
  terms: string[]
  /** Facet keys the wall knows — see features/pages/facets.ts. */
  facets: string[]
  /** Calendar months, 0–11. */
  months: number[]
  from: string | null
  to: string | null
  arrange: 'date' | 'by-year' | 'by-month'
  /** True when the server gave up and handed back an empty configuration. */
  failed?: boolean
}

/** Nothing understood — light the sentence's own words and move on. */
export function literalFallback(q: string): Interpretation {
  return {
    question: q,
    // The whole phrase, not its words: someone who typed "the long way home"
    // meant that phrase, and splitting it lights every page with "the" on it.
    terms: q.trim().length >= 2 ? [q.trim()] : [],
    facets: [],
    months: [],
    from: null,
    to: null,
    arrange: 'date',
  }
}

/**
 * Ask the server to read a sentence as filters.
 *
 * Never throws. Every failure — offline, unauthenticated, a bad payload, a
 * model that returned nothing usable — lands on the literal fallback, because
 * the wall has to keep working when the network doesn't.
 */
export async function interpret(q: string): Promise<Interpretation> {
  const question = q.trim()
  if (!question) return literalFallback(q)
  try {
    const raw = await apiPost<Partial<Interpretation>>('/api/pages/interpret', { q: question })
    const terms = Array.isArray(raw?.terms) ? raw.terms.filter((t) => typeof t === 'string') : []
    // An interpretation that found nothing to light is not an interpretation —
    // the sentence itself is a better guess than silence.
    if (terms.length === 0 && (raw?.facets?.length ?? 0) === 0) return literalFallback(question)
    return {
      question,
      terms,
      facets: Array.isArray(raw?.facets) ? raw.facets.filter((f) => typeof f === 'string') : [],
      months: Array.isArray(raw?.months) ? raw.months.filter((m) => typeof m === 'number') : [],
      from: typeof raw?.from === 'string' ? raw.from : null,
      to: typeof raw?.to === 'string' ? raw.to : null,
      arrange:
        raw?.arrange === 'by-year' || raw?.arrange === 'by-month' ? raw.arrange : 'date',
    }
  } catch {
    return literalFallback(question)
  }
}
