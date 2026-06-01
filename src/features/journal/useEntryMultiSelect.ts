import { useCallback, useEffect, useRef, useState } from 'react'

export type EntryRowClickResult = 'open' | 'toggle' | 'range'

export function useEntryMultiSelect(orderedIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const anchorIdRef = useRef<string | null>(null)

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    anchorIdRef.current = null
  }, [])

  const selectOnly = useCallback((id: string) => {
    anchorIdRef.current = id
    setSelectedIds(new Set([id]))
  }, [])

  const handleRowClick = useCallback(
    (entryId: string, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }): EntryRowClickResult => {
      const mod = e.metaKey || e.ctrlKey
      const shift = e.shiftKey

      if (shift && anchorIdRef.current) {
        const anchorIdx = orderedIds.indexOf(anchorIdRef.current)
        const clickIdx = orderedIds.indexOf(entryId)
        if (anchorIdx !== -1 && clickIdx !== -1) {
          const [lo, hi] = anchorIdx < clickIdx ? [anchorIdx, clickIdx] : [clickIdx, anchorIdx]
          setSelectedIds(new Set(orderedIds.slice(lo, hi + 1)))
          return 'range'
        }
      }

      if (mod) {
        setSelectedIds((prev) => {
          const next = new Set(prev.size ? prev : [])
          if (next.has(entryId)) next.delete(entryId)
          else next.add(entryId)
          return next
        })
        if (!anchorIdRef.current) anchorIdRef.current = entryId
        return 'toggle'
      }

      anchorIdRef.current = entryId
      setSelectedIds(new Set())
      return 'open'
    },
    [orderedIds],
  )

  // Drop ids that disappeared from the visible list (filter/search).
  useEffect(() => {
    const allowed = new Set(orderedIds)
    setSelectedIds((prev) => {
      if (!prev.size) return prev
      const next = new Set([...prev].filter((id) => allowed.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [orderedIds])

  return {
    selectedIds,
    setSelectedIds,
    clearSelection,
    selectOnly,
    handleRowClick,
    selectionCount: selectedIds.size,
  }
}
