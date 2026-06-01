import { useEffect, type RefObject } from 'react'
import type { Entry } from '@/lib/types'
import { isInEditor, isInEntryList, isInEntrySearch } from './keyboard'
import { focusedEntryIdInList, focusEntryListRow } from './entryListFocus'

interface Options {
  activeIdRef: RefObject<string | null>
  entries: Entry[]
  onEditEntry: (entry: Entry) => void
  onRevealList: () => void
  blocked: boolean
}

/**
 * Tab / Shift+Tab between the entry list and editor:
 * - Tab in list (on a row) → edit focused entry
 * - Tab in search → focus active row (browse)
 * - Shift+Tab in editor → return to list
 */
export function useEntryEditorFocusToggle({
  activeIdRef,
  entries,
  onEditEntry,
  onRevealList,
  blocked,
}: Options): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (blocked) return
      if (e.key !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return

      if (e.shiftKey) {
        if (!isInEditor(e.target)) return
        e.preventDefault()
        e.stopPropagation()
        onRevealList()
        const id = activeIdRef.current
        requestAnimationFrame(() => {
          requestAnimationFrame(() => focusEntryListRow(id))
        })
        return
      }

      if (!isInEntryList(e.target)) return

      if (isInEntrySearch(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        requestAnimationFrame(() => focusEntryListRow(activeIdRef.current))
        return
      }

      const listEl = document.querySelector<HTMLElement>('.entry-list')
      if (!listEl) return

      const focusedId = focusedEntryIdInList(listEl)
      const targetId = focusedId ?? activeIdRef.current ?? entries[0]?.id ?? null
      const entry = targetId ? entries.find((item) => item.id === targetId) : entries[0]
      if (!entry) return

      e.preventDefault()
      e.stopPropagation()
      onEditEntry(entry)
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [activeIdRef, entries, onEditEntry, onRevealList, blocked])
}
