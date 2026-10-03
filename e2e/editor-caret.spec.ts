import { test, expect, type Page } from '@playwright/test'
import { emulateIOS, wkWebViewFirstResponderLag } from './ios'

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
 */

const DOC =
  'Morning\n\nFirst paragraph of the entry.\n\nSecond paragraph, a bit longer than the first.\n\nThird paragraph.\n\n\n\n'

async function open(page: Page, doc: string) {
  await page.goto(`/e2e/harness/index.html?doc=${encodeURIComponent(doc)}`)
  await page.waitForSelector('.cm-content .cm-line')
}

/** CodeMirror's selection head, and where the DOM's caret maps to. */
function selection(page: Page) {
  return page.evaluate(() => {
    const view = window.__editor.view()
    const dom = getSelection()
    return {
      head: view.state.selection.main.head,
      dom: dom?.focusNode ? view.posAtDOM(dom.focusNode, dom.focusOffset) : null,
    }
  })
}

/** Put the caret somewhere, the way a writer leaves it, then put the keyboard away. */
async function leaveCaretAt(page: Page, pos: number) {
  await page.evaluate((at) => {
    const view = window.__editor.view()
    view.focus()
    view.dispatch({ selection: { anchor: at } })
    view.contentDOM.blur()
  }, pos)
}

/** A finger in the empty space under the last line — `.cm-content`'s bottom padding. */
async function tapBelowContent(page: Page) {
  const at = await page.evaluate(() => {
    const lines = document.querySelectorAll('.cm-content .cm-line')
    const last = lines[lines.length - 1]!.getBoundingClientRect()
    return { x: last.left + 120, y: last.bottom + 80 }
  })
  await page.touchscreen.tap(at.x, at.y)
  // Past the first-responder window and CodeMirror's 10ms focus settle.
  await page.waitForTimeout(250)
}

async function backspace(page: Page, times: number) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press('Backspace')
    // iOS replays Backspace from a 250ms fallback timer when WebKit's own
    // edit produces no DOM change; give every press the time to land.
    await page.waitForTimeout(300)
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  await emulateIOS(page, testInfo)
})

test('tap below content on an unfocused editor, then Backspace, deletes the trailing lines', async ({ page }) => {
  await wkWebViewFirstResponderLag(page)
  await open(page, DOC)
  await leaveCaretAt(page, DOC.indexOf('Second paragraph'))

  await tapBelowContent(page)

  // Soft, so a failure also shows what Backspace then did to the entry.
  const sel = await selection(page)
  expect.soft(sel.head, "CodeMirror's selection is on the final empty line").toBe(DOC.length)
  expect.soft(sel.dom, 'and so is the DOM caret').toBe(DOC.length)

  await backspace(page, 3)
  expect(await page.evaluate(() => window.__editor.doc()), 'Backspace removed the trailing lines').toBe(
    DOC.slice(0, -3),
  )
})

// Control: the same gesture with the keyboard already up. Passes today — the
// bug needs the tap that focuses the editor.
test('tap below content on a focused editor, then Backspace, deletes the trailing lines', async ({ page }) => {
  await wkWebViewFirstResponderLag(page)
  await open(page, DOC)
  await leaveCaretAt(page, DOC.indexOf('Second paragraph'))
  await page.evaluate(() => window.__editor.view().focus())

  await tapBelowContent(page)

  const sel = await selection(page)
  expect(sel.head).toBe(DOC.length)
  expect(sel.dom).toBe(DOC.length)

  await backspace(page, 3)
  expect(await page.evaluate(() => window.__editor.doc())).toBe(DOC.slice(0, -3))
})
