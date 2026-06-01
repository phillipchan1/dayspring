import type { ChangeSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export type FormatAction = 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'list' | 'quote' | 'heading'

/** Toggle inline wrap markers around the current selection. */
function toggleWrap(view: EditorView, open: string, close = open): boolean {
  const { from, to } = view.state.selection.main
  if (from === to) return false
  const text = view.state.sliceDoc(from, to)
  const wrapped = text.startsWith(open) && text.endsWith(close)
  const inner = wrapped ? text.slice(open.length, text.length - close.length) : text
  const insert = wrapped ? inner : `${open}${text}${close}`
  const anchor = from + (wrapped ? 0 : open.length)
  const head = anchor + inner.length
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor, head },
  })
  view.focus()
  return true
}

/** Toggle a prefix on every line touched by the selection. */
function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const sel = view.state.selection.main
  const doc = view.state.doc
  const fromLine = doc.lineAt(sel.from).number
  const toLine = doc.lineAt(sel.to).number

  let allPrefixed = true
  for (let n = fromLine; n <= toLine; n++) {
    const line = doc.line(n)
    const text = doc.sliceString(line.from, line.to)
    if (!text.startsWith(prefix)) allPrefixed = false
  }

  const changes: ChangeSpec[] = []
  for (let n = fromLine; n <= toLine; n++) {
    const line = doc.line(n)
    const text = doc.sliceString(line.from, line.to)
    if (allPrefixed) {
      if (text.startsWith(prefix)) {
        changes.push({ from: line.from, to: line.from + prefix.length, insert: '' })
      }
    } else if (!text.startsWith(prefix)) {
      changes.push({ from: line.from, insert: prefix })
    }
  }

  if (!changes.length) return false
  view.dispatch({ changes })
  view.focus()
  return true
}

function applyLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const text = from === to ? '' : view.state.sliceDoc(from, to)
  const url = globalThis.prompt('Link URL', 'https://')
  if (url == null || !url.trim()) return false
  const insert = `[${text || 'link'}](${url.trim()})`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from, head: from + insert.length },
  })
  view.focus()
  return true
}

export function applyFormat(view: EditorView, action: FormatAction): boolean {
  switch (action) {
    case 'bold':
      return toggleWrap(view, '**')
    case 'italic':
      return toggleWrap(view, '*')
    case 'strike':
      return toggleWrap(view, '~~')
    case 'code':
      return toggleWrap(view, '`')
    case 'link':
      return applyLink(view)
    case 'list':
      return toggleLinePrefix(view, '- ')
    case 'quote':
      return toggleLinePrefix(view, '> ')
    case 'heading':
      return toggleLinePrefix(view, '## ')
    default:
      return false
  }
}

/** Bounding box for the current selection in viewport coordinates. */
export function selectionAnchorRect(view: EditorView): DOMRect | null {
  const sel = view.state.selection.main
  if (sel.empty) return null

  const start = view.coordsAtPos(sel.from, -1)
  const end = view.coordsAtPos(sel.to, 1)
  if (!start || !end) return null

  const left = Math.min(start.left, end.left)
  const right = Math.max(start.right, end.right)
  const top = Math.min(start.top, end.top)
  const bottom = Math.max(start.bottom, end.bottom)
  return new DOMRect(left, top, right - left, bottom - top)
}
