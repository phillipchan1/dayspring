import { EditorView } from '@codemirror/view'

/*
 * The format bar's Cut / Copy / Paste (on iOS the bar stands in for the system
 * edit menu). Each goes through the editor the way the real clipboard event
 * would — the clipboard filters, and a user event on every change — so
 * history, autosave's "the writer typed" signal and every paste handler see a
 * bar paste exactly as they see ⌘V.
 */

/** Visible selection when WebKit reports one; otherwise the raw document slice. */
export function selectedText(view: EditorView): string {
  const visible = window.getSelection()?.toString()
  if (visible) return visible
  const { from, to } = view.state.selection.main
  return view.state.sliceDoc(from, to)
}

function outputFiltered(view: EditorView, text: string): string {
  let out = text
  for (const filter of view.state.facet(EditorView.clipboardOutputFilter)) out = filter(out, view.state)
  return out
}

export function copySelection(view: EditorView): string {
  const text = outputFiltered(view, selectedText(view))
  void navigator.clipboard?.writeText(text)
  return text
}

export function cutSelection(view: EditorView): string {
  const { from, to } = view.state.selection.main
  const text = copySelection(view)
  view.dispatch({
    changes: { from, to, insert: '' },
    selection: { anchor: from },
    userEvent: 'delete.cut',
    scrollIntoView: true,
  })
  return text
}

/**
 * Hand `text` to the editor as a real paste event, so the whole paste
 * pipeline runs — a verse from a Bible app is wrapped as scripture, the
 * clipboard filters apply, and CodeMirror tags it `input.paste`. Only when
 * the platform can build a paste event that actually carries the text; a
 * paste event with no data would send CodeMirror off to read the native
 * clipboard, which a script cannot trigger.
 */
function dispatchPasteEvent(view: EditorView, text: string): boolean {
  if (typeof ClipboardEvent === 'undefined' || typeof DataTransfer === 'undefined') return false
  let event: ClipboardEvent
  try {
    const data = new DataTransfer()
    data.setData('text/plain', text)
    event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
  } catch {
    return false
  }
  if (event.clipboardData?.getData('text/plain') !== text) return false
  view.contentDOM.dispatchEvent(event)
  return true
}

/** CodeMirror's own paste, minus the event: the input filters, then `input.paste`. */
export function pasteText(view: EditorView, text: string): void {
  let input = text
  for (const filter of view.state.facet(EditorView.clipboardInputFilter)) input = filter(input, view.state)
  view.dispatch(view.state.replaceSelection(input), { userEvent: 'input.paste', scrollIntoView: true })
}

export async function pasteSelection(view: EditorView): Promise<void> {
  const text = (await navigator.clipboard?.readText()) ?? ''
  if (!text) return
  if (dispatchPasteEvent(view, text)) return
  pasteText(view, text)
}

export function replaceSelection(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from, head: from + text.length },
    userEvent: 'input.replace',
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
