import type { Page } from '@playwright/test'
import { editorState, expect, open, pointBelowContent, press, setCaret, tap, test } from './fixtures'
import { wkWebViewFirstResponderLag } from './ios'

/**
 * Tap below the last line on an iPad, press Backspace: it must delete at the
 * caret.
 *
 * What it did instead: the caret appeared on the final empty line, and each
 * Backspace removed something further UP the entry — first the blank line
 * above an earlier paragraph — because CodeMirror never took the tap.
 *
 *  1. The editor is not focused (touch never autofocuses — "read first, tap
 *     to write"). The tap focuses it; WebKit puts the DOM caret on the last
 *     line at once, but WKWebView is not first responder yet, so
 *     `document.hasFocus()` is false.
 *  2. CodeMirror's `applyDOMChange` drops a DOM selection change while
 *     `!view.hasFocus`. Its `DOMObserver.flush` then sees "selection changed,
 *     state didn't" and resets the view — writing the OLD selection (wherever
 *     the writer last was) back over the caret WebKit just placed.
 *  3. Backspace on iOS: CodeMirror lets WebKit delete natively, discards that
 *     DOM edit, and replays Backspace as `deleteCharBackward` on its own
 *     selection — the stale one. Every press deletes one character further up.
 *
 * Fixed by JournalEditorView (src/editor/journalView.ts).
 */

const DOC =
  'Morning\n\nFirst paragraph of the entry.\n\nSecond paragraph, a bit longer than the first.\n\nThird paragraph.\n\n\n\n'

/** Where the DOM's caret maps to, for the "and so is the DOM" half. */
function domCaret(page: Page) {
  return page.evaluate(() => {
    const view = window.__editor.view()
    const dom = getSelection()
    return dom?.focusNode ? view.posAtDOM(dom.focusNode, dom.focusOffset) : null
  })
}

/** Put the caret somewhere, the way a writer leaves it, then put the keyboard away. */
async function leaveCaretAt(page: Page, pos: number) {
  await setCaret(page, pos)
  await page.evaluate(() => window.__editor.view().contentDOM.blur())
}

test('tap below content on an unfocused editor, then Backspace, deletes the trailing lines', async ({
  page,
}, testInfo) => {
  await wkWebViewFirstResponderLag(page)
  await open(page, DOC)
  await leaveCaretAt(page, DOC.indexOf('Second paragraph'))

  const below = await pointBelowContent(page)
  await tap(page, testInfo, below.x, below.y)

  // Soft, so a failure also shows what Backspace then did to the entry.
  expect.soft((await editorState(page)).head, "CodeMirror's selection is on the final empty line").toBe(DOC.length)
  expect.soft(await domCaret(page), 'and so is the DOM caret').toBe(DOC.length)

  await press(page, testInfo, 'Backspace', 3)
  expect((await editorState(page)).doc, 'Backspace removed the trailing lines').toBe(DOC.slice(0, -3))
})

// The same gesture with the keyboard already up. This one always passed — the
// bug needed the tap that focuses the editor.
test('tap below content on a focused editor, then Backspace, deletes the trailing lines', async ({
  page,
}, testInfo) => {
  await wkWebViewFirstResponderLag(page)
  await open(page, DOC)
  await setCaret(page, DOC.indexOf('Second paragraph'))

  const below = await pointBelowContent(page)
  await tap(page, testInfo, below.x, below.y)

  expect((await editorState(page)).head).toBe(DOC.length)
  expect(await domCaret(page)).toBe(DOC.length)

  await press(page, testInfo, 'Backspace', 3)
  expect((await editorState(page)).doc).toBe(DOC.slice(0, -3))
})
