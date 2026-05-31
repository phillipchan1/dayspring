import { useEffect, useRef } from 'react'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting } from '@codemirror/language'
import { editorTheme } from './theme'
import { markdownHighlight } from './highlight'
import { typewriterExtension } from './typewriter'
import { dimmingExtension } from './dimming'
import { firstLineTitleExtension } from './firstLineTitle'

interface EditorProps {
  /** Initial document. Re-seeded only when `docKey` changes (i.e. a different entry). */
  initialDoc: string
  /** Identity of the loaded entry. Changing it swaps the document. */
  docKey: string
  onChange: (doc: string) => void
  placeholder?: string
  autofocus?: boolean
  typewriter?: boolean
  dimming?: boolean
}

/**
 * CodeMirror 6, single-pane, near-live inline markdown.
 *
 * The view owns the document (uncontrolled) so typing is never gated by React
 * re-renders — zero input lag. We only push a fresh doc into the view when
 * `docKey` changes (loading another entry), preserving the caret otherwise.
 * Typewriter / dimming live in compartments so they toggle without rebuilding.
 */
export function Editor({
  initialDoc,
  docKey,
  onChange,
  placeholder,
  autofocus,
  typewriter = false,
  dimming = false,
}: EditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const typewriterCompartment = useRef(new Compartment())
  const dimCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

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
          markdown({ base: markdownLanguage, codeLanguages: [] }),
          syntaxHighlighting(markdownHighlight),
          firstLineTitleExtension,
          EditorView.lineWrapping,
          editorTheme,
          typewriterCompartment.current.of(typewriter ? typewriterExtension : []),
          dimCompartment.current.of(dimming ? dimmingExtension : []),
          cmPlaceholder(placeholder ?? 'Write…'),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    if (autofocus) view.focus()

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Intentionally run once; doc swaps + compartments handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap the document when a different entry is loaded.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === initialDoc) return
    view.dispatch({ changes: { from: 0, to: current.length, insert: initialDoc } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey])

  // Reconfigure typewriter / dimming when their toggles change.
  useEffect(() => {
    reconfigure(viewRef.current, typewriterCompartment.current, typewriter ? typewriterExtension : [])
  }, [typewriter])

  useEffect(() => {
    reconfigure(viewRef.current, dimCompartment.current, dimming ? dimmingExtension : [])
  }, [dimming])

  return <div ref={hostRef} style={{ height: '100%' }} />
}

function reconfigure(view: EditorView | null, compartment: Compartment, ext: Extension) {
  if (!view) return
  view.dispatch({ effects: compartment.reconfigure(ext) })
}
