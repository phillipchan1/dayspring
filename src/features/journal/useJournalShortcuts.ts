import { useEffect } from 'react'
import { hasMod, isInEditor, shouldIgnoreTarget } from './keyboard'
import { RAIL_EXPAND_KEY } from './railHints'

export interface JournalShortcutActions {
  onNew: () => void
  onSave: () => void
  onToggleEntries: () => void
  onLookBack: () => void
  onScripture: () => void
  onAltar: () => void
  onOpenSettings: () => void
  /** Open the entries panel (if collapsed) and focus its search field. */
  onFocusSearch: () => void
  /** Expand or collapse navigation rail labels. */
  onToggleRailLabels: () => void
  /** Focus mode consumes Esc first (handled in useFocusMode). */
  focusActive: boolean
  /** When true, only Esc (handled elsewhere) should run. */
  settingsOpen: boolean
}

/**
 * Global journal shortcuts (capture phase so they win over the browser and CM).
 *
 * ⌘N new · ⌘1–4 rail · ⌘, settings · ⌘S save · ⌘K search · ⌘⏎ focus
 * ⌘1 entries · ⌘2 looking back · ⌘3 scripture · ⌘4 altar
 */
export function useJournalShortcuts(actions: JournalShortcutActions): void {
  const {
    onNew,
    onSave,
    onToggleEntries,
    onLookBack,
    onScripture,
    onAltar,
    onOpenSettings,
    onFocusSearch,
    onToggleRailLabels,
    focusActive,
    settingsOpen,
  } = actions

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusActive) return

      if (e.key === RAIL_EXPAND_KEY && !hasMod(e) && !e.altKey && !e.ctrlKey) {
        if (settingsOpen || shouldIgnoreTarget(e.target) || isInEditor(e.target)) return
        e.preventDefault()
        onToggleRailLabels()
        return
      }

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

      if (key >= '1' && key <= '4' && !e.shiftKey) {
        e.preventDefault()
        if (key === '1') onToggleEntries()
        else if (key === '2') onLookBack()
        else if (key === '3') onScripture()
        else if (key === '4') onAltar()
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
    onScripture,
    onAltar,
    onOpenSettings,
    onFocusSearch,
    onToggleRailLabels,
    focusActive,
    settingsOpen,
  ])
}
