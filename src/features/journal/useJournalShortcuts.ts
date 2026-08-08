import { useEffect } from 'react'
import {
  hasEditorSelection,
  hasMod,
  isInEditor,
  isTypingContext,
  shouldIgnoreTarget,
} from './keyboard'
import { RAIL_EXPAND_KEY } from './railHints'
import { isTauri } from '@/lib/platform'

export interface JournalShortcutActions {
  onNew: () => void
  onSave: () => void
  /** ⌘1 — Pages, your entries. */
  onToggleEntries: () => void
  onLookBack: () => void
  onScripture: () => void
  onAltar: () => void
  onOpenSettings: () => void
  /** ⌘K — Find (instant, local) or Ask (Remember). */
  onFindOrAsk: () => void
  /** ⌘5 — the Remember surface. */
  onRemember: () => void
  /** ⇧⌘1 — the old entries panel. Temporary; goes when the panel does. */
  onEntriesPanel: () => void
  /** Expand or collapse navigation rail labels. */
  onToggleRailLabels: () => void
  /** Increase editor font size (⌘= or ⌘+). */
  onFontSizeUp: () => void
  /** Decrease editor font size (⌘-). */
  onFontSizeDown: () => void
  /** Reset editor font size to default (⌘0). */
  onFontSizeReset: () => void
  /** Focus mode consumes Esc first (handled in useFocusMode). */
  focusActive: boolean
  /** When true, only Esc (handled elsewhere) should run. */
  settingsOpen: boolean
}

/**
 * Global journal shortcuts (capture phase so they win over the browser and CM).
 *
 * Native: ⌘N new · Browser: C new (when not typing) · ⌘1–5 rail · ⌘, settings
 * ⌘S save · ⌘K search · ⌘⏎ focus
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
    onFindOrAsk,
    onRemember,
    onEntriesPanel,
    onToggleRailLabels,
    onFontSizeUp,
    onFontSizeDown,
    onFontSizeReset,
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

      if (isTauri()) {
        if (hasMod(e) && !e.altKey && key === 'n') {
          e.preventDefault()
          onNew()
          return
        }
      } else if (
        !hasMod(e) &&
        !e.altKey &&
        !e.shiftKey &&
        key === 'c' &&
        !settingsOpen &&
        !isTypingContext(e.target)
      ) {
        e.preventDefault()
        onNew()
        return
      }

      if (!hasMod(e) || e.altKey) return

      // ⌘K works INSIDE the editor on purpose — "wait, have I been here before?"
      // is a mid-sentence thought, and making you leave the entry to ask it is
      // what killed the question. Everything else below stays out of the editor.
      //
      // The one exception is the editor's own ⌘K (insert link), which only means
      // anything with text selected — so a live selection yields to CodeMirror.
      if (key === 'k' && !hasEditorSelection()) {
        e.preventDefault()
        onFindOrAsk()
        return
      }

      if (key === '=' || key === '+') {
        e.preventDefault()
        onFontSizeUp()
        return
      }

      if (key === '-') {
        e.preventDefault()
        onFontSizeDown()
        return
      }

      if (key === '0') {
        e.preventDefault()
        onFontSizeReset()
        return
      }

      if (key === ',') {
        e.preventDefault()
        onOpenSettings()
        return
      }

      // ⇧⌘1 — the entries panel, while it still exists.
      //
      // Matched on `e.code`, not `e.key`: with Shift held, `e.key` for the 1 key
      // is "!" on a US layout and something else again elsewhere, so the digit is
      // simply not there to compare against.
      if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault()
        onEntriesPanel()
        return
      }

      if (key >= '1' && key <= '5' && !e.shiftKey) {
        e.preventDefault()
        if (key === '1') onToggleEntries()
        else if (key === '2') onLookBack()
        else if (key === '3') onScripture()
        else if (key === '4') onAltar()
        else if (key === '5') onRemember()
        return
      }

      if (settingsOpen) return

      if (shouldIgnoreTarget(e.target)) return

      if (key === 's') {
        e.preventDefault()
        void onSave()
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
    onFindOrAsk,
    onRemember,
    onEntriesPanel,
    onToggleRailLabels,
    onFontSizeUp,
    onFontSizeDown,
    onFontSizeReset,
    focusActive,
    settingsOpen,
  ])
}
