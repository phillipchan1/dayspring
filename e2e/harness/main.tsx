/**
 * Mounts the real journal Editor, alone, for the browser regression suite.
 *
 * Props mirror what JournalScreen passes on a touch device. The query string
 * picks the document (`?doc=` URL-encoded) and toggles typewriter mode.
 */
import { createRoot } from 'react-dom/client'
import { useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { Editor, type EditorHandle } from '@/editor/Editor'
import '@/styles/global.css'

const params = new URLSearchParams(location.search)
const initial = params.get('doc') ?? ''

declare global {
  interface Window {
    __editor: {
      view: () => EditorView
      doc: () => string
      sel: () => { anchor: number; head: number }
    }
  }
}

function Harness() {
  const ref = useRef<EditorHandle>(null)
  const [content, setContent] = useState(initial)
  return (
    <div className="journal-write" style={{ height: '100%' }}>
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
}

createRoot(document.getElementById('root')!).render(<Harness />)
