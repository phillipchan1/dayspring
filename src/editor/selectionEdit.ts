import type { EditorView } from '@codemirror/view'

/** Visible selection when WebKit reports one; otherwise the raw document slice. */
export function selectedText(view: EditorView): string {
  const visible = window.getSelection()?.toString()
  if (visible) return visible
  const { from, to } = view.state.selection.main
  return view.state.sliceDoc(from, to)
}

export function copySelection(view: EditorView): string {
  const text = selectedText(view)
  void navigator.clipboard?.writeText(text)
  return text
}

export function cutSelection(view: EditorView): string {
  const { from, to } = view.state.selection.main
  const text = copySelection(view)
  view.dispatch({ changes: { from, to, insert: '' }, selection: { anchor: from } })
  return text
}

export async function pasteSelection(view: EditorView): Promise<void> {
  const text = (await navigator.clipboard?.readText()) ?? ''
  if (!text) return
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  })
}

export function replaceSelection(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from, head: from + text.length },
  })
}

export function selectAll(view: EditorView): void {
  view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
}

export function speakText(text: string): void {
  if (!text.trim() || typeof window.speechSynthesis === 'undefined') return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}
