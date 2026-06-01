import { useCallback, useEffect, useRef, useState } from 'react'

export type EntryRowClickResult = 'open' | 'toggle' | 'range'

export function useEntryMultiSelect(orderedIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [rangePivotId, setRangePivotId] = useState<string | null>(null)
  /** Moving end of shift-range (keyboard steps from here, not the pivot). */
  const [rangeExtentId, setRangeExtentId] = useState<string | null>(null)
  /** Last single-select / click anchor for shift+click. */
  const anchorIdRef = useRef<string | null>(null)
  const rangePivotRef = useRef<string | null>(null)
  rangePivotRef.current = rangePivotId
  const rangeExtentRef = useRef<string | null>(null)
  rangeExtentRef.current = rangeExtentId

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    anchorIdRef.current = null
    setRangePivotId(null)
    setRangeExtentId(null)
  }, [])

  const selectOnly = useCallback((id: string) => {
    anchorIdRef.current = id
    setRangePivotId(null)
    setRangeExtentId(null)
    setSelectedIds(new Set([id]))
  }, [])

  const beginRange = useCallback((pivotId: string) => {
    setRangePivotId(pivotId)
    setRangeExtentId(pivotId)
    anchorIdRef.current = pivotId
  }, [])

  const endRange = useCallback(() => {
    setRangePivotId(null)
    setRangeExtentId(null)
  }, [])

  const selectRangeTo = useCallback(
    (toId: string, anchorId?: string | null) => {
      const anchor = anchorId ?? rangePivotRef.current ?? anchorIdRef.current
      if (!anchor) {
        anchorIdRef.current = toId
        setRangeExtentId(toId)
        setSelectedIds(new Set([toId]))
        return
      }
      const anchorIdx = orderedIds.indexOf(anchor)
      const toIdx = orderedIds.indexOf(toId)
      if (anchorIdx === -1 || toIdx === -1) return
      const [lo, hi] = anchorIdx < toIdx ? [anchorIdx, toIdx] : [toIdx, anchorIdx]
      setRangeExtentId(toId)
      setSelectedIds(new Set(orderedIds.slice(lo, hi + 1)))
    },
    [orderedIds],
  )

  const navigateTo = useCallback(
    (toId: string, mode: 'single' | 'range') => {
      if (mode === 'single') {
        anchorIdRef.current = toId
        setRangePivotId(null)
        setRangeExtentId(null)
        setSelectedIds(new Set())
      } else {
        selectRangeTo(toId)
      }
    },
    [selectRangeTo],
  )

  const setAnchor = useCallback((id: string | null) => {
    anchorIdRef.current = id
  }, [])

  const handleRowClick = useCallback(
    (entryId: string, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }): EntryRowClickResult => {
      const mod = e.metaKey || e.ctrlKey
      const shift = e.shiftKey

      if (shift && anchorIdRef.current) {
        const anchorIdx = orderedIds.indexOf(anchorIdRef.current)
        const clickIdx = orderedIds.indexOf(entryId)
        if (anchorIdx !== -1 && clickIdx !== -1) {
          if (!rangePivotRef.current) setRangePivotId(anchorIdRef.current)
          selectRangeTo(entryId, rangePivotRef.current)
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
      setRangePivotId(null)
      setSelectedIds(new Set())
      return 'open'
    },
    [orderedIds, selectRangeTo],
  )
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
    beginRange,
    endRange,
    selectRangeTo,
    navigateTo,
    setAnchor,
    handleRowClick,
    selectionCount: selectedIds.size,
    anchorId: anchorIdRef,
    rangePivotId,
    rangeExtentId,
    rangeExtentRef,
    rangeActive: rangePivotId !== null,
  }
}
