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
  /** ⌘2 — Pages, the archive itself. */
  onPages: () => void
  onLookBack: () => void
  onScripture: () => void
  onAltar: () => void
  onOpenSettings: () => void
  /** ⌘K — Find (instant, local), or Ask (which lights the wall). */
  onFindOrAsk: () => void
  /**
   * ⌘F — search your pages: Pages' Look for, caret in the field, seeded with
   * the editor's selection when there is one.
   */
  onFindInPages: (seed: string) => void
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
    onPages,
    onLookBack,
    onScripture,
    onAltar,
    onOpenSettings,
    onFindOrAsk,
    onFindInPages,
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

      /*
       * ⌘F is "find it in my pages", everywhere — the key every Mac hand
       * already reaches for. Not the browser's find-in-page: the wall is
       * virtualised and an entry is one page, so that would search a sliver of
       * the journal and call it the whole. ⌘⇧F stays the editor's (show
       * formatting); a Shift here yields to it.
       */
      if (key === 'f' && !e.shiftKey && !settingsOpen) {
        e.preventDefault()
        onFindInPages(hasEditorSelection() ? selectionSeed() : '')
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

      /*
       * The rail, numbered as it reads: one item under Write, four under
       * Return. Write holding a single item looks thin and is the correct
       * statement — writing really is one act, and everything else is
       * returning (SURFACES). Pages joins Return on its own argument: the
       * other three interpret, and none of them hands back the archive.
       */
      if (key >= '1' && key <= '5' && !e.shiftKey) {
        e.preventDefault()
        if (key === '1') onNew()
        else if (key === '2') onPages()
        else if (key === '3') onLookBack()
        else if (key === '4') onScripture()
        else if (key === '5') onAltar()
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
    onPages,
    onLookBack,
    onScripture,
    onAltar,
    onOpenSettings,
    onFindOrAsk,
    onFindInPages,
    onToggleRailLabels,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    focusActive,
    settingsOpen,
  ])
}

/**
 * The selected words, if they read as something to look for — one line, a
 * phrase rather than a paragraph. Anything longer is a selection made for
 * another reason, and the field starts empty rather than full of it.
 */
function selectionSeed(): string {
  const text = window.getSelection()?.toString().replace(/\s+/g, ' ').trim() ?? ''
  return text.length > 0 && text.length <= 60 ? text : ''
}
