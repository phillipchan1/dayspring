import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type MutableRefObject } from 'react'
import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { indentUnit, syntaxHighlighting } from '@codemirror/language'
import { editorTheme } from './theme'
import { markdownHighlight } from './highlight'
import { typewriterExtension } from './typewriter'
import { dimmingExtension } from './dimming'
import { firstLineTitleExtension } from './firstLineTitle'
import {
  spiritualBlockExtension,
  type SpiritualBlockEditTarget,
} from './spiritualBlockDecoration'
import type { InlinePanelAnchor } from './inlinePanelAnchor'
import { formatKeymap } from './formatKeymap'
import { anchorFromView, SelectionFormatBar, type FormatBarAnchor } from './SelectionFormatBar'
import { commandLineHighlight } from './commandLineHighlight'
import { scriptureRefDecoration } from './scriptureRefDecoration'
import { taskListExtension } from './taskListExtension'
import { editorTabKeymap } from './tabKeymap'
import { computeInlinePanelAnchor } from './inlinePanelAnchor'
import { detectSlash, type SlashCommandId, type SlashState } from './slashDetect'
import { SlashPalette } from './SlashPalette'

export interface EditorHandle {
  /** Insert text at the given document position (e.g. after removing a /command). */
  insertAt: (pos: number, text: string) => void
  /** Replace the document range [from, to) — used to edit/remove a block in place. */
  replaceRange: (from: number, to: number, text: string) => void
  focus: () => void
  /** Return focus to the editor, optionally restoring the caret. */
  focusAt: (pos?: number) => void
}

interface EditorProps {
  /** Initial document. Re-seeded only when `docKey` changes (i.e. a different entry). */
  initialDoc: string
  /** Identity of the loaded entry. Changing it swaps the document. */
  docKey: string
  onChange: (doc: string) => void
  placeholder?: string
  /** When true, the next docKey swap skips autofocus (sidebar selection keeps list focus). */
  skipAutofocusRef?: MutableRefObject<boolean>
  autofocus?: boolean
  typewriter?: boolean
  dimming?: boolean
  slashEnabled?: boolean
  /** Highlight the line at this doc position while a command popover is open. */
  commandLinePos?: number | null
  /** Called when the /command picker opens or closes. */
  onSlashPaletteChange?: (open: boolean) => void
  /** Called when the user confirms a slash command; carries the doc position where
   *  the /command text began so the caller knows where to insert a response. */
  onSlashCommand?: (
    cmd: SlashCommandId,
    insertAt: number,
    anchor: ReturnType<typeof computeInlinePanelAnchor>,
  ) => void
  /** Called when the user clicks a rendered spiritual block to edit it. */
  onEditBlock?: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void
}

/**
 * CodeMirror 6, single-pane, near-live inline markdown.
 *
 * The view owns the document (uncontrolled) so typing is never gated by React
 * re-renders — zero input lag. We only push a fresh doc into the view when
 * `docKey` changes (loading another entry), preserving the caret otherwise.
 * Typewriter / dimming live in compartments so they toggle without rebuilding.
 */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  {
    initialDoc,
    docKey,
    onChange,
    placeholder,
    autofocus,
    typewriter = false,
    dimming = false,
    slashEnabled = false,
    commandLinePos = null,
    onSlashCommand,
    onEditBlock,
    onSlashPaletteChange,
    skipAutofocusRef,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const typewriterCompartment = useRef(new Compartment())
  const dimCompartment = useRef(new Compartment())
  const commandLineCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const onEditBlockRef = useRef(onEditBlock)
  const setFormatBarRef = useRef<(anchor: FormatBarAnchor | null) => void>(() => {})
  const slashEnabledRef = useRef(slashEnabled)
  const [formatBar, setFormatBar] = useState<FormatBarAnchor | null>(null)
  const [slashState, setSlashState] = useState<SlashState | null>(null)
  const setSlashRef = useRef(setSlashState)
  onChangeRef.current = onChange
  onEditBlockRef.current = onEditBlock
  setFormatBarRef.current = setFormatBar
  slashEnabledRef.current = slashEnabled
  setSlashRef.current = setSlashState

  useImperativeHandle(ref, () => ({
    insertAt: (pos: number, text: string) => {
      const view = viewRef.current
      if (!view) return
      const clamped = Math.max(0, Math.min(pos, view.state.doc.length))
      view.dispatch({
        changes: { from: clamped, to: clamped, insert: text },
        selection: { anchor: clamped + text.length, head: clamped + text.length },
      })
      view.focus()
    },
    replaceRange: (from: number, to: number, text: string) => {
      const view = viewRef.current
      if (!view) return
      const len = view.state.doc.length
      const f = Math.max(0, Math.min(from, len))
      const t = Math.max(f, Math.min(to, len))
      view.dispatch({
        changes: { from: f, to: t, insert: text },
        selection: { anchor: f + text.length, head: f + text.length },
      })
      view.focus()
    },
    focus: () => viewRef.current?.focus(),
    focusAt: (pos?: number) => {
      const view = viewRef.current
      if (!view) return
      if (pos != null) {
        const clamped = Math.max(0, Math.min(pos, view.state.doc.length))
        view.dispatch({ selection: { anchor: clamped, head: clamped } })
      }
      view.focus()
    },
  }))

  const syncFormatBar = useCallback((view: EditorView) => {
    if (view.state.selection.main.empty) {
      setFormatBarRef.current(null)
      return
    }
    setFormatBarRef.current(anchorFromView(view))
  }, [])

  // Create the view once.
  useEffect(() => {
    if (!hostRef.current) return

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialDoc,
        extensions: [
          history(),
          drawSelection(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          // Above defaultKeymap — CM binds Mod-i to selectParentSyntax (whole line/paragraph).
          Prec.highest(formatKeymap),
          editorTabKeymap,
          indentUnit.of('  '),
          markdown({ base: markdownLanguage, codeLanguages: [] }),
          syntaxHighlighting(markdownHighlight),
          firstLineTitleExtension,
          spiritualBlockExtension((target, anchor) => onEditBlockRef.current?.(target, anchor)),
          scriptureRefDecoration(),
          taskListExtension(),
          EditorView.lineWrapping,
          editorTheme,
          typewriterCompartment.current.of(typewriter ? typewriterExtension : []),
          dimCompartment.current.of(dimming ? dimmingExtension : []),
          commandLineCompartment.current.of(commandLineHighlight(commandLinePos)),
          cmPlaceholder(placeholder ?? 'Write…'),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString())
            if (u.selectionSet || u.focusChanged || u.docChanged) syncFormatBar(u.view)
            if (slashEnabledRef.current && (u.docChanged || u.selectionSet)) {
              setSlashRef.current(detectSlash(u.view))
            }
          }),
        ],
      }),
    })
    viewRef.current = view
    if (autofocus) view.focus()

    const onScroll = () => syncFormatBar(view)
    view.scrollDOM.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      view.scrollDOM.removeEventListener('scroll', onScroll)
      view.destroy()
      viewRef.current = null
      setFormatBarRef.current(null)
      setSlashRef.current(null)
    }
    // Intentionally run once; doc swaps + compartments handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap the document when a different entry is loaded, then focus for typing.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== initialDoc) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: initialDoc } })
    }
    if (skipAutofocusRef?.current) {
      skipAutofocusRef.current = false
      return
    }
    if (!autofocus) return
    view.focus()
    const atEnd = view.state.doc.length
    view.dispatch({ selection: { anchor: atEnd, head: atEnd } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey])

  // Reconfigure typewriter / dimming when their toggles change.
  useEffect(() => {
    reconfigure(viewRef.current, typewriterCompartment.current, typewriter ? typewriterExtension : [])
  }, [typewriter])

  useEffect(() => {
    reconfigure(viewRef.current, dimCompartment.current, dimming ? dimmingExtension : [])
  }, [dimming])

  useEffect(() => {
    reconfigure(
      viewRef.current,
      commandLineCompartment.current,
      commandLineHighlight(commandLinePos),
    )
  }, [commandLinePos])

  useEffect(() => {
    onSlashPaletteChange?.(slashState !== null)
  }, [slashState, onSlashPaletteChange])

  function handleSlashSelect(cmd: SlashCommandId) {
    const view = viewRef.current
    const s = slashState
    if (!view || !s) return
    // Remove the /command text from the document.
    view.dispatch({ changes: { from: s.from, to: s.to, insert: '' } })
    setSlashState(null)
    const panelAnchor = computeInlinePanelAnchor(view, s.from)
    onSlashCommand?.(cmd, s.from, panelAnchor)
  }

  function handleSlashDismiss() {
    setSlashState(null)
  }

  return (
    <>
      <div ref={hostRef} className="editor-host" style={{ height: '100%' }} />
      <SelectionFormatBar anchor={formatBar} />
      {slashState && slashEnabled && (
        <SlashPalette
          state={slashState}
          onSelect={handleSlashSelect}
          onDismiss={handleSlashDismiss}
        />
      )}
    </>
  )
})

function reconfigure(view: EditorView | null, compartment: Compartment, ext: Extension) {
  if (!view) return
  view.dispatch({ effects: compartment.reconfigure(ext) })
}
