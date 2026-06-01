import { useEffect, type RefObject } from 'react'
import type { Entry } from '@/lib/types'
import { isInEditor, isInEntryList, shouldIgnoreTarget } from './keyboard'
import { focusEntryRow, focusedEntryIdInList, scrollEntryIndexIntoView } from './entryListFocus'
import type { useEntryMultiSelect } from './useEntryMultiSelect'

interface Options {
  listRef: RefObject<HTMLElement | null>
  orderIds: string[]
  entries: Entry[]
  activeId: string | null
  flatVirtual: boolean
  menuOpen: boolean
  multi: ReturnType<typeof useEntryMultiSelect>
  onBrowse: (entry: Entry) => void
  onEdit: (entry: Entry) => void
  onDeleteSingle: (entry: Entry) => void
  onDeleteBulk: (entries: Entry[]) => void
  selectedEntries: Entry[]
}

/**
 * Finder-style list keyboard: ↑↓ browse, shift+↑↓ range select, Enter to edit.
 * List keeps focus until Enter (or double-click) — typing stays in the editor only
 * after an explicit edit.
 */
export function useEntryListKeyboard({
  listRef,
  orderIds,
  entries,
  activeId,
  flatVirtual,
  menuOpen,
  multi,
  onBrowse,
  onEdit,
  onDeleteSingle,
  onDeleteBulk,
  selectedEntries,
}: Options): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (menuOpen) return
      if (isInEditor(e.target) || shouldIgnoreTarget(e.target)) return

      const inList = isInEntryList(e.target)
      const inSearch =
        e.target instanceof HTMLElement && e.target.closest('[data-entry-search]') != null

      if (e.key === 'Escape' && (multi.selectionCount >= 2 || multi.rangeActive) && (inList || inSearch)) {
        e.preventDefault()
        e.stopPropagation()
        multi.clearSelection()
        return
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        if (!inList || inSearch) return
        e.preventDefault()
        e.stopPropagation()
        if (multi.selectionCount >= 2) onDeleteBulk(selectedEntries)
        else if (activeId) {
          const entry = entries.find((item) => item.id === activeId)
          if (entry) onDeleteSingle(entry)
        }
        return
      }

      if (inSearch && e.key === 'ArrowDown' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (orderIds.length === 0) return
        const nextId = orderIds[0]!
        const entry = entries.find((item) => item.id === nextId)
        if (!entry) return
        e.preventDefault()
        e.stopPropagation()
        multi.navigateTo(nextId, 'single')
        onBrowse(entry)
        const listEl = listRef.current
        if (listEl) {
          scrollEntryIndexIntoView(listEl, 0, flatVirtual)
          requestAnimationFrame(() => focusEntryRow(listEl, nextId))
        }
        return
      }

      if (!inList || inSearch) return

      if (e.key === 'Enter') {
        const targetId = activeId ?? orderIds[0]
        if (!targetId) return
        const entry = entries.find((item) => item.id === targetId)
        if (!entry) return
        e.preventDefault()
        e.stopPropagation()
        onEdit(entry)
        return
      }

      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      e.preventDefault()
      e.stopPropagation()

      const listEl = listRef.current
      if (!listEl || orderIds.length === 0) return

      // During shift-range, step from the moving extent — not the pivot (bidirectional).
      const currentId =
        (multi.rangeActive && multi.rangeExtentId) ||
        focusedEntryIdInList(listEl) ||
        activeId ||
        multi.anchorId.current ||
        orderIds[0]!
      let idx = orderIds.indexOf(currentId)
      if (idx === -1) idx = 0

      const delta = e.key === 'ArrowDown' ? 1 : -1
      const nextIdx = Math.max(0, Math.min(orderIds.length - 1, idx + delta))
      if (nextIdx === idx) return

      const nextId = orderIds[nextIdx]!
      const entry = entries.find((item) => item.id === nextId)
      if (!entry) return

      if (e.shiftKey) {
        if (!multi.rangePivotId) multi.beginRange(currentId)
        multi.selectRangeTo(nextId, multi.rangePivotId)
        scrollEntryIndexIntoView(listEl, nextIdx, flatVirtual)
        requestAnimationFrame(() => focusEntryRow(listEl, nextId))
        return
      }

      multi.endRange()
      multi.navigateTo(nextId, 'single')
      onBrowse(entry)
      scrollEntryIndexIntoView(listEl, nextIdx, flatVirtual)
      requestAnimationFrame(() => focusEntryRow(listEl, nextId))
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    listRef,
    orderIds,
    entries,
    activeId,
    flatVirtual,
    menuOpen,
    multi,
    onBrowse,
    onEdit,
    onDeleteSingle,
    onDeleteBulk,
    selectedEntries,
  ])
}
