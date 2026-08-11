import type { Entry } from '@/lib/types'

import type { EntriesGroupBy } from '@/lib/settings'
export type { EntriesGroupBy } from '@/lib/settings'

export interface EntryGroup {
  key: string
  label: string
  entries: Entry[]
}

export interface MonthGroup {
  key: string
  label: string
  entries: Entry[]
}

export interface YearSection {
  key: string
  label: string
  months: MonthGroup[]
}

export interface YearGroup {
  key: string
  label: string
  count: number
  months: MonthGroup[]
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

function subDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() - n)
  return x
}

/** Today / Yesterday / "June 1" — used as floating list section headers. */
export function getDateGroupLabel(iso: string): string {
  const today = startOfDay(new Date())
  const d = startOfDay(new Date(iso))
  if (isSameDay(d, today)) return 'Today'
  if (isSameDay(d, subDays(today, 1))) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

function dateKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

function shortMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, { month: 'long' })
}

function pushMonthGroup(
  map: Map<string, MonthGroup>,
  order: MonthGroup[],
  entry: Entry,
  labelFn: (key: string) => string,
): void {
  const key = monthKey(entry.created_at)
  let group = map.get(key)
  if (!group) {
    group = { key, label: labelFn(key), entries: [] }
    map.set(key, group)
    order.push(group)
  }
  group.entries.push(entry)
}

/** List view — newest-first day groups. */
export function groupEntries(entries: Entry[], mode: EntriesGroupBy): EntryGroup[] | null {
  if (entries.length === 0) return null
  if (mode !== 'flat') return null

  const groups: EntryGroup[] = []
  const index = new Map<string, number>()

  for (const entry of entries) {
    const key = dateKey(entry.created_at)
    let i = index.get(key)
    if (i === undefined) {
      i = groups.length
      index.set(key, i)
      groups.push({ key, label: getDateGroupLabel(entry.created_at), entries: [] })
    }
    groups[i]!.entries.push(entry)
  }

  return groups
}

/** Month view — months nested under year section headers. */
export function groupMonthsByYear(entries: Entry[]): YearSection[] {
  const sections: YearSection[] = []
  const sectionIndex = new Map<string, number>()
  const monthMaps = new Map<string, Map<string, MonthGroup>>()
  const monthOrders = new Map<string, MonthGroup[]>()

  for (const entry of entries) {
    const year = yearKey(entry.created_at)
    let si = sectionIndex.get(year)
    if (si === undefined) {
      si = sections.length
      sectionIndex.set(year, si)
      sections.push({ key: year, label: year, months: [] })
      monthMaps.set(year, new Map())
      monthOrders.set(year, [])
    }
    pushMonthGroup(monthMaps.get(year)!, monthOrders.get(year)!, entry, monthLabel)
  }

  for (const section of sections) {
    section.months = monthOrders.get(section.key) ?? []
  }

  return sections
}

/** Year view — collapsible years with indented month breakdown. */
export function groupYearsWithMonths(entries: Entry[]): YearGroup[] {
  const years: YearGroup[] = []
  const yearIndex = new Map<string, number>()
  const monthMaps = new Map<string, Map<string, MonthGroup>>()
  const monthOrders = new Map<string, MonthGroup[]>()

  for (const entry of entries) {
    const year = yearKey(entry.created_at)
    let yi = yearIndex.get(year)
    if (yi === undefined) {
      yi = years.length
      yearIndex.set(year, yi)
      years.push({ key: year, label: year, count: 0, months: [] })
      monthMaps.set(year, new Map())
      monthOrders.set(year, [])
    }
    pushMonthGroup(monthMaps.get(year)!, monthOrders.get(year)!, entry, shortMonthLabel)
    years[yi]!.count += 1
  }

  for (const year of years) {
    year.months = monthOrders.get(year.key) ?? []
  }

  return years
}

export function monthKeyForEntry(entry: Entry): string {
  return monthKey(entry.created_at)
}

export function yearKeyForEntry(entry: Entry): string {
  return yearKey(entry.created_at)
}

export type FlatListItem =
  | { kind: 'header'; key: string; label: string; first: boolean }
  | { kind: 'entry'; entry: Entry; orderIndex: number }

/** Flatten date groups for virtual scrolling (headers + rows in list order). */
export function flattenDateGroups(groups: EntryGroup[]): FlatListItem[] {
  const items: FlatListItem[] = []
  let orderIndex = 0
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!
    items.push({
      kind: 'header',
      key: `header-${group.key}`,
      label: group.label,
      first: i === 0,
    })
    for (const entry of group.entries) {
      items.push({ kind: 'entry', entry, orderIndex })
      orderIndex += 1
    }
  }
  return items
}

export function flatIndexByEntryId(items: FlatListItem[]): Map<string, number> {
  const map = new Map<string, number>()
  items.forEach((item, index) => {
    if (item.kind === 'entry') map.set(item.entry.id, index)
  })
  return map
}
