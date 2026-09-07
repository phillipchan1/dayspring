import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

/**
 * Native OS typing — autocorrect, sentence caps, inline predictions.
 *
 * CodeMirror defaults these OFF because it is a code editor. A journal is
 * the opposite: the writer should get the same correction Notes gives them.
 *
 * `sentences` is stronger than `on` for autocapitalize. `writingsuggestions`
 * is the newer hint (Safari 18 / Chromium) for inline predictions.
 *
 * Attributes alone are not enough on WKWebView — Safari also drops
 * as-you-type correction when the caret line is rewritten with mark
 * decorations (see `proseHighlighting`). The Tauri shells additionally
 * turn on `allowsInlinePredictions` on the WKWebView configuration, which
 * is off by default and is why the app feels weaker than Safari.
 *
 * Opening the journal reseeds the document (cache, then server). That write
 * is programmatic, so WebKit stops tracking words until we flip the
 * attributes after paint. Same after a remote body lands.
 */
export const nativeTypingAttrs = {
  spellcheck: 'true',
  autocorrect: 'on',
  autocapitalize: 'sentences',
  autocomplete: 'on',
  writingsuggestions: 'true',
} as const

export const nativeTypingAttributes = EditorView.contentAttributes.of((view) => {
  const lang =
    (typeof document !== 'undefined' && document.documentElement.lang) ||
    view.contentDOM.lang ||
    'en'
  return { ...nativeTypingAttrs, lang }
})

/** Force WebKit to rescan after a programmatic document write. */
export function rearmNativeTyping(view: EditorView | null): void {
  const el = view?.contentDOM
  if (!el) return
  el.setAttribute('spellcheck', 'false')
  el.setAttribute('autocorrect', 'off')
  el.setAttribute('writingsuggestions', 'false')
  void el.offsetHeight
  el.setAttribute('spellcheck', nativeTypingAttrs.spellcheck)
  el.setAttribute('autocorrect', nativeTypingAttrs.autocorrect)
  el.setAttribute('autocapitalize', nativeTypingAttrs.autocapitalize)
  el.setAttribute('autocomplete', nativeTypingAttrs.autocomplete)
  el.setAttribute('writingsuggestions', nativeTypingAttrs.writingsuggestions)
}

/** After CodeMirror has painted the seeded / remote doc. */
export function rearmNativeTypingAfterPaint(view: EditorView | null): void {
  requestAnimationFrame(() => rearmNativeTyping(view))
}

const nativeTypingFocus = EditorView.domEventHandlers({
  focus(_event, view) {
    rearmNativeTyping(view)
  },
})

export function nativeTyping(): Extension {
  return [nativeTypingAttributes, nativeTypingFocus]
}
