import type { Entry } from '@/lib/types'
import type { EntryGroup } from './groupEntries'

/** Chronological list order for shift-range selection (newest first). */
export function orderedEntryIds(entries: Entry[], groups: EntryGroup[] | null): string[] {
  if (groups) return groups.flatMap((g) => g.entries.map((e) => e.id))
  return entries.map((e) => e.id)
}
