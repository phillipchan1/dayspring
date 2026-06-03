import { useCallback, useEffect, useRef, useState } from 'react'
import type { Entry } from '@/lib/types'
import type { EntryGroup } from './groupEntries'
import type { EntriesGroupBy } from '@/lib/settings'
import { findEntryGroupKey } from './entryGroupKey'

const LARGE_LIBRARY = 80

function defaultExpandedKeys(
  groups: EntryGroup[],
  activeGroupKey: string | null,
  groupBy: EntriesGroupBy,
): Set<string> {
  if (groupBy === 'flat') return new Set(groups.map((g) => g.key))
  const keys = new Set<string>()
  if (groups[0]) keys.add(groups[0].key)
  if (activeGroupKey && !keys.has(activeGroupKey)) keys.add(activeGroupKey)
  return keys
}

/**
 * Which month/year sections are open. Collapsed sections render no rows (fast scroll).
 * Resets when group mode changes; always re-opens the section holding the active entry.
 */
export function useEntryGroupCollapse(
  groups: EntryGroup[] | null,
  groupBy: EntriesGroupBy,
  activeId: string | null,
  allEntries: Entry[],
  entryCount: number,
) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const groupByRef = useRef(groupBy)
  const initRef = useRef(false)

  const activeGroupKey =
    groups && groupBy !== 'flat' && activeId
      ? findEntryGroupKey(activeId, allEntries, groupBy)
      : null

  // Re-seed when switching List ↔ Month ↔ Year.
  useEffect(() => {
    if (!groups) {
      setExpanded(new Set())
      initRef.current = false
      return
    }
    if (groupByRef.current !== groupBy) {
      groupByRef.current = groupBy
      initRef.current = false
    }
    if (!initRef.current) {
      initRef.current = true
      setExpanded(defaultExpandedKeys(groups, activeGroupKey, groupBy))
    }
  }, [groups, groupBy, activeGroupKey])

  // Jumping to an entry in a collapsed section opens that section.
  useEffect(() => {
    if (!activeGroupKey) return
    setExpanded((prev) => {
      if (prev.has(activeGroupKey)) return prev
      const next = new Set(prev)
      next.add(activeGroupKey)
      return next
    })
  }, [activeGroupKey])

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const collapseOlder = useCallback(() => {
    if (!groups) return
    const keep = new Set<string>()
    if (groups[0]) keep.add(groups[0].key)
    if (activeGroupKey) keep.add(activeGroupKey)
    setExpanded(keep)
  }, [groups, activeGroupKey])

  const expandAll = useCallback(() => {
    if (!groups) return
    setExpanded(new Set(groups.map((g) => g.key)))
  }, [groups])

  const isExpanded = useCallback((key: string) => expanded.has(key), [expanded])

  const showBulkActions =
    Boolean(groups) &&
    groupBy !== 'flat' &&
    entryCount >= LARGE_LIBRARY &&
    groups!.length > 1

  return {
    isExpanded,
    toggle,
    collapseOlder,
    expandAll,
    showBulkActions,
    expandedCount: expanded.size,
    groupCount: groups?.length ?? 0,
  }
}
