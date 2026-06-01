import { useEffect } from 'react'
import { hasMod, shouldIgnoreTarget } from './keyboard'

export interface JournalShortcutActions {
  onNew: () => void
  onSave: () => void
  onOpenSettings: () => void
  /** Open the entries panel (if collapsed) and focus its search field. */
  onFocusSearch: () => void
  /** Focus mode consumes Esc first (handled in useFocusMode). */
  focusActive: boolean
  /** When true, only Esc (handled elsewhere) should run. */
  settingsOpen: boolean
}

/**
 * Global journal shortcuts (capture phase so they win over the browser and CM).
 *
 * ⌘N new entry · ⌘S save · ⌘, settings · ⌘K search · ⌘⏎ focus mode
 */
export function useJournalShortcuts(actions: JournalShortcutActions): void {
  const { onNew, onSave, onOpenSettings, onFocusSearch, focusActive, settingsOpen } = actions

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen) return
      if (e.key === 'Escape' && focusActive) return

      const key = e.key.toLowerCase()

      if (!hasMod(e)) return

      if (key === 'n') {
        e.preventDefault()
        onNew()
        return
      }

      if (shouldIgnoreTarget(e.target)) return

      if (key === 's') {
        e.preventDefault()
        void onSave()
      } else if (key === ',') {
        e.preventDefault()
        onOpenSettings()
      } else if (key === 'k') {
        e.preventDefault()
        onFocusSearch()
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onNew, onSave, onOpenSettings, onFocusSearch, focusActive, settingsOpen])
}
