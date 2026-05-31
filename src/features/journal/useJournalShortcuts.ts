import { useEffect } from 'react'
import { focusEntrySearch, hasMod, isInEditor, shouldIgnoreTarget } from './keyboard'
import type { ViewMode } from './journalViewProps'

export interface JournalShortcutActions {
  onNew: () => void
  onSave: () => void
  onOpenSettings: () => void
  /** Write → read (Esc). */
  onExitEdit: () => void
  /** Read → write (E). */
  onEnterEdit: () => void
  mode: ViewMode
  /** Focus mode consumes Esc first (handled in useFocusMode). */
  focusActive: boolean
  /** When true, only Esc (handled elsewhere) should run. */
  settingsOpen: boolean
}

/**
 * Global journal shortcuts (capture phase so they win over the browser and CM).
 *
 * C compose · E edit · Esc read · ⌘S save · ⌘, settings · ⌘K search
 */
export function useJournalShortcuts(actions: JournalShortcutActions): void {
  const {
    onNew, onSave, onOpenSettings, onExitEdit, onEnterEdit, mode, focusActive, settingsOpen,
  } = actions

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen) return

      if (e.key === 'Escape') {
        if (focusActive) return
        if (mode === 'write') {
          e.preventDefault()
          onExitEdit()
        }
        return
      }

      const key = e.key.toLowerCase()

      if (!hasMod(e) && !e.altKey && !e.shiftKey) {
        if (shouldIgnoreTarget(e.target)) return

        if (key === 'c' && !(mode === 'write' && isInEditor(e.target))) {
          e.preventDefault()
          onNew()
          return
        }
        if (key === 'e' && mode === 'read') {
          e.preventDefault()
          onEnterEdit()
          return
        }
      }

      if (!hasMod(e)) return
      if (shouldIgnoreTarget(e.target)) return

      if (key === 's') {
        e.preventDefault()
        void onSave()
      } else if (key === ',') {
        e.preventDefault()
        onOpenSettings()
      } else if (key === 'k') {
        e.preventDefault()
        focusEntrySearch()
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onNew, onSave, onOpenSettings, onExitEdit, onEnterEdit, mode, focusActive, settingsOpen])
}
