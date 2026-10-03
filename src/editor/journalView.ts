import { EditorView } from '@codemirror/view'
import { isAppleTouchDevice } from '@/lib/platform'

/**
 * The editor's view: CodeMirror's, with one question answered for the iPad.
 *
 * ## The bug this exists for
 *
 * Tap below the last line of an entry on an iPad, press Backspace, and the
 * text went missing further UP the page — the blank line above an earlier
 * paragraph first, then the paragraphs themselves — while the trailing lines
 * you were looking at stayed put. (e2e/editor-caret.spec.ts.)
 *
 * On a touch device the editor is never focused when an entry opens ("read
 * first, tap to write"), so that tap is also the one that focuses it. WebKit
 * focuses the element and places the caret at once, but `document.hasFocus()`
 * stays false until the web view becomes first responder — which UIKit does
 * later, while the keyboard rises. CodeMirror reads `view.hasFocus` (which
 * requires `document.hasFocus()`) to decide whether a DOM selection change is
 * the writer's, so it threw the tap away and then wrote its OLD caret back
 * into the page. And on iOS, Backspace is replayed as a command against
 * CodeMirror's own selection — the stale one.
 *
 * ## The rule
 *
 * On an Apple touch device the editor has focus exactly when its content is
 * the active element. `document.hasFocus()` there answers a different question
 * — is this web view UIKit's first responder right now — and its answer lags
 * the one CodeMirror needs. Everywhere else CodeMirror's own test stands: on a
 * desktop it is what keeps a window in the background from looking focused.
 */
export class JournalEditorView extends EditorView {
  override get hasFocus(): boolean {
    if (!isAppleTouchDevice()) return super.hasFocus
    return this.root.activeElement === this.contentDOM
  }
}
