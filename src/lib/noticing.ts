import { apiUrl } from './api'
import { requireSupabase } from './supabase'
import type { SpiritualItemType } from './types'

/**
 * Something the journal noticed, in pencil.
 *
 * A proposal is **not a marking**. It carries no weight, appears in no count,
 * and reaches no other surface until the writer keeps it — which is the whole
 * of what keeps D-016 standing: the writer still supplies the signal, the app
 * only points. "Not this" is one tap, costs nothing, and says nothing back.
 */
export interface Proposal {
  /** Local only — a proposal is never stored anywhere until it is kept. */
  id: string
  kind: SpiritualItemType
  /** The writer's own words, verbatim. The margin contains nothing else. */
  quote: string
}

/** Below this there is not enough written to notice anything about. */
export const NOTICE_MIN_TEXT = 160

/**
 * How much has to change before the journal looks again.
 *
 * Not a timer alone: a pause after fixing a typo is still a pause, and asking
 * again for it would spend a model call to return the same three notes. This is
 * the difference between "they stopped typing" and "they wrote something".
 */
export const NOTICE_MIN_DELTA = 40

/** How long a pause is. Long enough to be a pause, short enough to still be
 *  about the paragraph you just finished. */
export const NOTICE_PAUSE_MS = 4000

async function authHeader(): Promise<string> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')
  return `Bearer ${session.access_token}`
}

/**
 * Ask what the page looks like. Returns [] rather than throwing on any failure —
 * noticing is the least important thing on this screen and must never surface an
 * error over someone's writing.
 */
export async function fetchProposals(text: string): Promise<Proposal[]> {
  if (text.trim().length < NOTICE_MIN_TEXT) return []
  try {
    const res = await fetch(apiUrl('/api/spiritual/notice'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return []
    const result = (await res.json()) as { proposals?: Array<{ quote?: string; kind?: string }> }
    return verbatimIn(text, result.proposals ?? [])
  } catch {
    return []
  }
}

/**
 * The same verbatim check the server runs, run again against the document the
 * writer is actually looking at.
 *
 * Not redundant. The server checks against the text it was sent; by the time the
 * answer arrives that text is a few seconds old, and a quote that no longer
 * exists on the page would put a sentence in the margin that the writer has
 * already deleted. Both checks are exact substring, no normalisation — "close
 * enough" is how words nobody wrote end up on someone's page.
 */
export function verbatimIn(
  text: string,
  proposals: Array<{ quote?: string; kind?: string }>,
): Proposal[] {
  const out: Proposal[] = []
  for (const p of proposals) {
    const quote = p.quote ?? ''
    if (!quote || !p.kind) continue
    if (!text.includes(quote)) continue
    out.push({ id: `${p.kind}:${quote}`, kind: p.kind as SpiritualItemType, quote })
  }
  return out
}

/**
 * True when the page has changed enough to be worth looking at again.
 *
 * Length, not equality. A pause after fixing a typo is still a pause, and
 * treating it as new writing would spend a model call to get the same three
 * notes back. The cost of the coarser rule is that rewriting a paragraph to
 * exactly its old length goes unnoticed until the next real edit, which is a
 * cheaper mistake than noticing constantly.
 */
export function worthNoticing(text: string, lastAsked: string | null): boolean {
  if (text.trim().length < NOTICE_MIN_TEXT) return false
  if (lastAsked === null) return true
  return Math.abs(text.length - lastAsked.length) >= NOTICE_MIN_DELTA
}
