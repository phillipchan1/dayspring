import type { Entry } from '@/lib/types'

/**
 * Facts about the page itself, for the foot of the rail, after the hour, the
 * place and the weather.
 *
 * Neither is a measure of anything. A word count is the length of a page, the
 * same fact a spine shows on a shelf. It is never a total, a target or a
 * comparison. "Edited" says only that the page was returned to on a later
 * day. That is worth knowing when reading back, because the words may not all
 * be from the morning at the top of the page.
 */
export function pageFacts(
  entry: Pick<Entry, 'created_at' | 'updated_at' | 'word_count' | 'source'>,
): string[] {
  const out: string[] = []

  // The writer's own words: `wordCount` leaves marking blocks out, so a long
  // verse does not make a short page look long.
  const words = entry.word_count ?? 0
  if (words > 0) out.push(`${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`)

  const edited = editedOn(entry)
  if (edited) out.push(`edited ${edited}`)

  return out
}

/**
 * The day the page was last changed, when that was a later day than it was
 * written. Null otherwise.
 *
 * Native pages only. An imported page's `updated_at` is the day of the import,
 * and printing that under a 2014 entry would describe the importer, not the
 * writer.
 *
 * Compared by calendar day in the reader's own zone. The same-morning autosaves
 * that follow every page are not an edit anyone would call one.
 */
function editedOn(
  entry: Pick<Entry, 'created_at' | 'updated_at' | 'source'>,
): string | null {
  if (entry.source !== 'native') return null
  const written = new Date(entry.created_at)
  const changed = new Date(entry.updated_at)
  if (Number.isNaN(written.getTime()) || Number.isNaN(changed.getTime())) return null
  if (changed.getTime() <= written.getTime()) return null
  if (dayKey(changed) === dayKey(written)) return null
  return changed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(changed.getFullYear() !== written.getFullYear() ? { year: 'numeric' as const } : {}),
  })
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
