/**
 * Mounts the real journal Editor, alone, for the browser regression suite.
 *
 * Props mirror what JournalScreen passes on a touch device, and so does the
 * data flow around it: every keystroke goes into React state (`setContent`),
 * which re-renders this tree and hands the text back as `initialDoc`.
 *
 * Query string:
 *  · `doc=` — the entry (URL-encoded).
 *  · `typewriter=1` — typewriter scrolling on.
 *  · `autosave=<ms>` — save on that debounce, the way useAutosave does, then
 *    play the server's copy back through `applyRemoteDoc` while the editor is
 *    clean, the way JournalScreen's sync does. Each save also re-renders the
 *    tree (the status line changing).
 */
import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { Editor, type EditorHandle } from '@/editor/Editor'
import '@/styles/global.css'

const params = new URLSearchParams(location.search)
const initial = params.get('doc') ?? ''
const autosaveMs = params.has('autosave') ? Number(params.get('autosave')) : null
/** How long the pretend server takes to answer a save. */
const ROUND_TRIP_MS = 60

declare global {
  interface Window {
    __editor: {
      view: () => EditorView
      doc: () => string
      sel: () => { anchor: number; head: number }
      /** Saves completed, and how many of them were played back into the editor. */
      saves: { done: number; echoed: number }
    }
  }
}

function Harness() {
  const ref = useRef<EditorHandle>(null)
  const [content, setContent] = useState(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const savedRef = useRef(initial)

  useEffect(() => {
    if (autosaveMs === null || content === savedRef.current) return
    const timer = setTimeout(() => {
      const text = content
      setStatus('saving')
      setTimeout(() => {
        savedRef.current = text
        window.__editor.saves.done++
        setStatus('saved')
        // The sync: only a clean editor takes the server's copy.
        const handle = ref.current
        if (handle && handle.getDoc() === text) {
          handle.applyRemoteDoc(text)
          window.__editor.saves.echoed++
        }
      }, ROUND_TRIP_MS)
    }, autosaveMs)
    return () => clearTimeout(timer)
  }, [content])

  return (
    <div className="journal-write" style={{ height: '100%' }} data-status={status}>
      <div className="journal-write__editor" style={{ height: '100%' }}>
        <div className="journal-write__canvas" style={{ height: '100%' }}>
          <Editor
            ref={ref}
            docKey="harness"
            initialDoc={content}
            onChange={setContent}
            placeholder="Write…"
            bodyPlaceholder="Keep going…"
            autofocus={false}
            typewriter={params.get('typewriter') === '1'}
            titleStyling
            slashEnabled
          />
        </div>
      </div>
    </div>
  )
}

window.__editor = {
  view: () => EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)!,
  doc: () => window.__editor.view().state.doc.toString(),
  sel: () => {
    const m = window.__editor.view().state.selection.main
    return { anchor: m.anchor, head: m.head }
  },
  saves: { done: 0, echoed: 0 },
}

createRoot(document.getElementById('root')!).render(<Harness />)
