import type { Entry } from '@/lib/types'

/** Case-insensitive substring filter over entry bodies. */
export function filterEntries(entries: Entry[], query: string): Entry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries
  return entries.filter((e) => e.body_markdown.toLowerCase().includes(q))
}

/** A short snippet of `text` around the first match of `query`, for result rows. */
export function matchSnippet(text: string, query: string, radius = 32): string | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return null
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + q.length + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return prefix + text.slice(start, end).replace(/\s+/g, ' ').trim() + suffix
}
