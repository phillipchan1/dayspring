import { useEffect } from 'react'
import { focusEntrySearch, hasMod, shouldIgnoreTarget } from './keyboard'

export interface JournalShortcutActions {
  onNew: () => void
  onSave: () => void
  onToggleMode: () => void
  onOpenSettings: () => void
  /** When true, only Esc (handled elsewhere) should run. */
  settingsOpen: boolean
}

/**
 * Global journal shortcuts (capture phase so they win over the browser and CM).
 *
 * ⌘N new entry · ⌘S save now · ⌘⇧R read/edit · ⌘, settings · ⌘K search
 */
export function useJournalShortcuts(actions: JournalShortcutActions): void {
  const { onNew, onSave, onToggleMode, onOpenSettings, settingsOpen } = actions

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen) return
      if (!hasMod(e)) return
      if (shouldIgnoreTarget(e.target)) return

      const key = e.key.toLowerCase()

      if (key === 'n') {
        e.preventDefault()
        onNew()
      } else if (key === 's') {
        e.preventDefault()
        void onSave()
      } else if (key === 'r' && e.shiftKey) {
        e.preventDefault()
        onToggleMode()
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
  }, [onNew, onSave, onToggleMode, onOpenSettings, settingsOpen])
}
