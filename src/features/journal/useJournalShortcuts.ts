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
  /** ⌘1 — the entries panel. */
  onToggleEntries: () => void
  /** ⇧⌘1 — flip the panel between its two reading modes, List and Pages. */
  onPagesMode: () => void
  onLookBack: () => void
  onScripture: () => void
  onAltar: () => void
  onOpenSettings: () => void
  /** ⌘K — Find (instant, local), or Ask (which lights the wall). */
  onFindOrAsk: () => void
  /** Expand or collapse navigation rail labels. */
  onToggleRailLabels: () => void
  /**
   * ⌘= / ⌘− / ⌘0 — "bigger", "smaller", "back to normal".
   *
   * What that means depends on what's on screen: editor font size while
   * writing, how close you're standing while on the Pages wall. The shortcut
   * layer doesn't need to know which; JournalScreen resolves it.
   */
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
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
    onPagesMode,
    onLookBack,
    onScripture,
    onAltar,
    onOpenSettings,
    onFindOrAsk,
    onToggleRailLabels,
    onZoomIn,
    onZoomOut,
    onZoomReset,
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
        onZoomIn()
        return
      }

      if (key === '-') {
        e.preventDefault()
        onZoomOut()
        return
      }

      if (key === '0') {
        e.preventDefault()
        onZoomReset()
        return
      }

      if (key === ',') {
        e.preventDefault()
        onOpenSettings()
        return
      }

      // ⇧⌘1 — matched on `e.code`, not `e.key`: with Shift held the 1 key
      // reports "!" on a US layout, so the digit isn't there to compare against.
      if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault()
        onPagesMode()
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
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    onNew,
    onSave,
    onToggleEntries,
    onPagesMode,
    onLookBack,
    onScripture,
    onAltar,
    onOpenSettings,
    onFindOrAsk,
    onToggleRailLabels,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    focusActive,
    settingsOpen,
  ])
}
