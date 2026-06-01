import type { Entry } from '@/lib/types'
import type { EntriesGroupBy } from '@/lib/settings'

export function entryGroupKey(entry: Entry, mode: Exclude<EntriesGroupBy, 'flat'>): string {
  const d = new Date(entry.created_at)
  if (mode === 'month') {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${d.getFullYear()}-${m}`
  }
  return String(d.getFullYear())
}

export function findEntryGroupKey(
  entryId: string,
  entries: Entry[],
  mode: Exclude<EntriesGroupBy, 'flat'>,
): string | null {
  const entry = entries.find((e) => e.id === entryId)
  return entry ? entryGroupKey(entry, mode) : null
}
