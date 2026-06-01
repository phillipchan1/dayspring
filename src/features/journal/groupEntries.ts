import type { Entry } from '@/lib/types'

import type { EntriesGroupBy } from '@/lib/settings'
export type { EntriesGroupBy } from '@/lib/settings'

export interface EntryGroup {
  key: string
  label: string
  entries: Entry[]
}

function monthKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function yearKey(iso: string): string {
  return String(new Date(iso).getFullYear())
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

/** Newest-first groups; entries within each group stay newest-first. */
export function groupEntries(entries: Entry[], mode: EntriesGroupBy): EntryGroup[] | null {
  if (mode === 'flat' || entries.length === 0) return null

  const keyFn = mode === 'month' ? monthKey : yearKey
  const labelFn = mode === 'month' ? monthLabel : (key: string) => key

  const groups: EntryGroup[] = []
  const index = new Map<string, number>()

  for (const entry of entries) {
    const key = keyFn(entry.created_at)
    let i = index.get(key)
    if (i === undefined) {
      i = groups.length
      index.set(key, i)
      groups.push({ key, label: labelFn(key), entries: [] })
    }
    groups[i]!.entries.push(entry)
  }

  return groups
}

export function formatEntryRowDate(iso: string, groupBy: EntriesGroupBy): string {
  const d = new Date(iso)
  if (groupBy === 'month') {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
