/**
 * The reflection LENSES — the user's active attention this season, surfaced as a
 * quiet "watching this season" row. This is ATTENTION, not a life-admin filter
 * bar: small text labels, no colors, fully editable, dismissible.
 *
 * There is no per-lens column populated on `insights` yet (the schema has `lens`
 * but nothing writes it), so the lens set is a client-side preference persisted
 * to localStorage. When per-lens synthesis lands, this becomes the place the UI
 * reads the active set from — the seam stays the same.
 */

export type Lens = string

const KEY = 'dayspring.ascent.lenses'

/** Default attention — the lenses this user reflects through. Editable. */
export const DEFAULT_LENSES: Lens[] = [
  'gain',
  'gratitude',
  'scripture',
  'work',
  'trading',
  'family',
]

function read(): Lens[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) return parsed as Lens[]
    return null
  } catch {
    return null
  }
}

/** The lenses the user is watching this season (defaults until they edit). */
export function getLenses(): Lens[] {
  return read() ?? DEFAULT_LENSES
}

/** Persist an edited lens set. Empty/whitespace labels are dropped; deduped. */
export function setLenses(next: Lens[]): Lens[] {
  const cleaned = [...new Set(next.map((l) => l.trim().toLowerCase()).filter(Boolean))]
  try {
    localStorage.setItem(KEY, JSON.stringify(cleaned))
  } catch {
    // Non-fatal: attention is a nicety, not a record to guard.
  }
  return cleaned
}
