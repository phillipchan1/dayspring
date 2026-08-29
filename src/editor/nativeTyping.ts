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
 */
export const nativeTypingAttributes = EditorView.contentAttributes.of((view) => {
  const lang =
    (typeof document !== 'undefined' && document.documentElement.lang) ||
    view.contentDOM.lang ||
    'en'
  return {
    spellcheck: 'true',
    autocorrect: 'on',
    autocapitalize: 'sentences',
    autocomplete: 'on',
    writingsuggestions: 'true',
    lang,
  }
})
