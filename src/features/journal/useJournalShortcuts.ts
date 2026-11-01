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
import { EditorView } from '@codemirror/view'
import { settingsStore } from '@/lib/settings'
import { deriveTitle } from './deriveTitle'
import { printMarkdown } from './entryActions'

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
  /**
   * ⌘P — print what is in front of you. Optional: without it, ⌘P prints the
   * entry in the editor that has focus (or the one on screen).
   */
  onPrint?: () => void
  /** Focus mode consumes Esc first (handled in useFocusMode). */
  focusActive: boolean
  /** When true, only Esc (handled elsewhere) should run. */
  settingsOpen: boolean
}

/**
 * Back: one layer up, by exactly the road Esc takes.
 *
 * ⌘[ and a mouse's back button are the Mac's Back (Safari, Finder, Books;
 * DESIGN_PRINCIPLES N4). Esc already knows what "up one layer" means on every
 * surface — a pane off the entry, the entry back to its reader or the wall,
 * the reader back to the wall, a sheet or Settings closed — and which layers
 * claim it first. Rather than a second copy of that knowledge to drift out of
 * step, Back hands the same key to the same handlers, from where focus is.
 */
export function goUpOneLayer(): void {
  const from = document.activeElement instanceof HTMLElement ? document.activeElement : document.body
  from.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }),
  )
}

/**
 * Global journal shortcuts (capture phase so they win over the browser and CM).
 *
 * Native: ⌘N new · Browser: C new (when not typing) · ⌘1–5 rail · ⌘, settings
 * ⌘S save · ⌘K search · ⌘⏎ focus · ⌘[ and the mouse's back button: back
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
    onPrint,
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

      // ⌘[ is Back — except in the writing, where it is Outdent, as in Notes
      // and Pages, and a writer reaching to un-indent a list must not be
      // thrown out of the entry. The mouse's back button works everywhere.
      if (e.key === '[' && !e.shiftKey) {
        if (isInEditor(e.target)) return
        e.preventDefault()
        goUpOneLayer()
        return
      }

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
       *
       * ⌃⌘F is Enter Full Screen (macOS, and Safari/Chrome on a Mac). Both
       * modifiers are down on that chord; swallowing it opened Look for
       * instead of the window.
       */
      if (key === 'f' && !e.shiftKey && !settingsOpen) {
        if (e.metaKey && e.ctrlKey) return
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

      // ⌘P prints the entry, never the app's own window (N1: the browser's
      // Print of the whole UI is a web tell).
      if (key === 'p' && !e.shiftKey) {
        e.preventDefault()
        if (settingsOpen) return
        if (onPrint) onPrint()
        else printEntryInFront()
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

    // The mouse's back button (button 3). On release, as the platform acts;
    // the browser's own history Back is kept out of it in a web build.
    const onMouseBack = (e: MouseEvent) => {
      if (e.button !== 3) return
      e.preventDefault()
      if (e.type === 'mouseup') goUpOneLayer()
    }

    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mouseup', onMouseBack, true)
    window.addEventListener('auxclick', onMouseBack, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mouseup', onMouseBack, true)
      window.removeEventListener('auxclick', onMouseBack, true)
    }
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
    onPrint,
    focusActive,
    settingsOpen,
  ])
}

/**
 * The entry being written, printed: the editor that has focus, or failing
 * that the one on screen. Nothing on a surface with no entry open.
 */
function printEntryInFront(): void {
  const focused = document.activeElement?.closest?.('.cm-editor')
  const shown = Array.from(document.querySelectorAll<HTMLElement>('.cm-editor')).find(
    (el) => el.getClientRects().length > 0,
  )
  const el = (focused as HTMLElement | null | undefined) ?? shown
  if (!el) return
  const view = EditorView.findFromDOM(el)
  if (!view) return
  const body = view.state.doc.toString()
  if (!body.trim()) return
  printMarkdown(body, deriveTitle(body) || 'Untitled', settingsStore.get().firstLineTitle)
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
