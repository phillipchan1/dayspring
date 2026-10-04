// @vitest-environment jsdom
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JournalEditorView } from './journalView'

const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

/** A focused editor in a document whose web view is not first responder yet. */
function focusedWhileWebViewIsNot(ua: string): EditorView {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
  vi.spyOn(document, 'hasFocus').mockReturnValue(false)
  const view = new JournalEditorView({ doc: 'one\n\ntwo\n\n', parent: document.body })
  view.contentDOM.focus()
  return view
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('JournalEditorView.hasFocus', () => {
  // The tap that focuses an unfocused editor on an iPad lands before WKWebView
  // is first responder. CodeMirror must still take that tap's caret.
  it('is focused on an iPad as soon as its content is the active element', () => {
    const view = focusedWhileWebViewIsNot(IPAD_UA)
    expect(document.activeElement).toBe(view.contentDOM)
    expect(view.hasFocus).toBe(true)
    view.destroy()
  })

  it("keeps CodeMirror's test on a desktop, where a background window is not focused", () => {
    const view = focusedWhileWebViewIsNot(MAC_UA)
    expect(view.hasFocus).toBe(false)
    view.destroy()
  })

  it('is not focused on an iPad when something else is active', () => {
    const view = focusedWhileWebViewIsNot(IPAD_UA)
    const input = document.body.appendChild(document.createElement('input'))
    input.focus()
    expect(view.hasFocus).toBe(false)
    view.destroy()
  })
})
