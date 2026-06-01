import { useEffect } from 'react'
import { hasMod, isInEditor, shouldIgnoreTarget } from './keyboard'

export interface JournalShortcutActions {
  onNew: () => void
  onSave: () => void
  onToggleEntries: () => void
  onLookBack: () => void
  onAltar: () => void
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
 * ⌘N new · ⌘1–3 rail · ⌘, settings · ⌘S save · ⌘K search · ⌘⏎ focus
 * ⌘1 entries · ⌘2 looking back · ⌘3 altar
 */
export function useJournalShortcuts(actions: JournalShortcutActions): void {
  const {
    onNew,
    onSave,
    onToggleEntries,
    onLookBack,
    onAltar,
    onOpenSettings,
    onFocusSearch,
    focusActive,
    settingsOpen,
  } = actions

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusActive) return

      const key = e.key.toLowerCase()

      if (!hasMod(e) || e.altKey) return

      if (key === 'n') {
        e.preventDefault()
        onNew()
        return
      }

      if (key === ',') {
        e.preventDefault()
        onOpenSettings()
        return
      }

      if (key >= '1' && key <= '3' && !e.shiftKey) {
        e.preventDefault()
        if (key === '1') onToggleEntries()
        else if (key === '2') onLookBack()
        else if (key === '3') onAltar()
        return
      }

      if (settingsOpen) return

      if (shouldIgnoreTarget(e.target)) return

      if (key === 's') {
        e.preventDefault()
        void onSave()
      } else if (key === 'k') {
        if (isInEditor(e.target)) return
        e.preventDefault()
        onFocusSearch()
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    onNew,
    onSave,
    onToggleEntries,
    onLookBack,
    onAltar,
    onOpenSettings,
    onFocusSearch,
    focusActive,
    settingsOpen,
  ])
}
