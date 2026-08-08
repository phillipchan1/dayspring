import { asEntryMarkdown } from '@/lib/entryLabels'
import { stripInlineMarkers } from '@/lib/inlineMarkers'
import type { Entry } from '@/lib/types'

/** Case-insensitive substring filter over entry bodies. */
export function filterEntries(entries: Entry[], query: string): Entry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries
  return entries.filter((e) => asEntryMarkdown(e.body_markdown).toLowerCase().includes(q))
}

/** A short snippet of `text` around the first match of `query`, for result rows. */
export function matchSnippet(text: string | null | undefined, query: string, radius = 32): string | null {
  const body = asEntryMarkdown(text)
  const q = query.trim().toLowerCase()
  if (!q) return null
  const idx = body.toLowerCase().indexOf(q)
  if (idx === -1) return null
  const start = Math.max(0, idx - radius)
  const end = Math.min(body.length, idx + q.length + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < body.length ? '…' : ''
  // Strip markers from the SNIPPET, not the body: the match offset has to stay
  // aligned with the raw text the query was found in. (Stripping the whole body
  // before searching would fix `**the** Lord` not matching "the Lord", but it's
  // O(entries × body) on every keystroke — a separate change, with memoisation.)
  const snippet = stripInlineMarkers(body.slice(start, end))
  return prefix + snippet.replace(/\s+/g, ' ').trim() + suffix
}
