import { test as base, expect, type Page, type TestInfo } from '@playwright/test'
import { emulateIOS } from './ios'

/**
 * Every spec in e2e/ runs through this `test`. It does two things for free:
 *
 *  · on the `ipad-chromium` project, tells CodeMirror it is on iOS (ios.ts);
 *  · after the test, runs the editor invariant (src/editor/invariant.ts) once
 *    more and fails the test if ANY violation was logged while it ran — so a
 *    spec that passes its own assertions while the DOM and the state drifted
 *    apart still fails.
 */
export const test = base.extend<{ invariantGuard: void }>({
  invariantGuard: [
    async ({ page }, use, testInfo) => {
      await emulateIOS(page, testInfo)
      await use()
      // The tap check looks 400ms after a tap.
      await page.waitForTimeout(450)
      const violations = await page
        .evaluate(() => {
          window.__editorInvariant?.check()
          return window.__editorInvariant?.violations ?? []
        })
        .catch(() => [])
      expect(violations, 'editor invariant violations').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** A project that drives the editor with a finger and runs CodeMirror's iOS paths. */
export function isIPad(testInfo: TestInfo): boolean {
  return testInfo.project.name.startsWith('ipad')
}

/**
 * The platform modifier as CodeMirror reads it. CodeMirror counts iOS as a
 * Mac, so its `Mod-` is ⌘ there whatever the host.
 */
export function mod(testInfo: TestInfo): string {
  return isIPad(testInfo) ? 'Meta' : 'ControlOrMeta'
}

export async function open(page: Page, doc: string, query = ''): Promise<void> {
  await page.goto(`/e2e/harness/index.html?doc=${encodeURIComponent(doc)}${query ? `&${query}` : ''}`)
  await page.waitForSelector('.cm-content .cm-line')
}

export function editorState(page: Page) {
  return page.evaluate(() => {
    const view = window.__editor.view()
    const { anchor, head } = view.state.selection.main
    return { doc: view.state.doc.toString(), anchor, head }
  })
}

/** Focus the editor with the caret at `pos` — test setup, not the gesture under test. */
export async function setCaret(page: Page, pos: number, head = pos): Promise<void> {
  await page.evaluate(
    ([anchor, h]) => {
      const view = window.__editor.view()
      view.focus()
      view.dispatch({ selection: { anchor, head: h } })
    },
    [pos, head] as const,
  )
}

/** A finger on an iPad project, a mouse everywhere else. */
export async function tap(page: Page, testInfo: TestInfo, x: number, y: number): Promise<void> {
  if (isIPad(testInfo)) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
  // iOS adopts a tap's caret after the tap; the focusing one, later still.
  await page.waitForTimeout(250)
}

/** Viewport point of a document position, a hair inside its character box. */
export async function pointAt(page: Page, pos: number): Promise<{ x: number; y: number }> {
  return page.evaluate((p) => {
    const view = window.__editor.view()
    const c = view.coordsAtPos(p, 1) ?? view.coordsAtPos(p, -1)!
    return { x: c.left + 1, y: (c.top + c.bottom) / 2 }
  }, pos)
}

/** The empty space under the last line — `.cm-content`'s bottom padding. */
export async function pointBelowContent(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const lines = document.querySelectorAll('.cm-content .cm-line')
    const last = lines[lines.length - 1]!.getBoundingClientRect()
    return { x: last.left + 120, y: last.bottom + 80 }
  })
}

/**
 * Press a key `times` times.
 *
 * On iOS, CodeMirror replays Backspace and Enter after WebKit's own edit, and
 * from a 250ms fallback timer when that edit changed nothing (Backspace at the
 * very start). A real hand is never faster than that; the test waits it out.
 */
export async function press(page: Page, testInfo: TestInfo, key: string, times = 1): Promise<void> {
  const replayed = isIPad(testInfo) && /^(Backspace|Enter)$/.test(key)
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key)
    await page.waitForTimeout(replayed ? 300 : 20)
  }
}

/** Paste plain text the way the system does: a `paste` event carrying it. */
export async function paste(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    const data = new DataTransfer()
    data.setData('text/plain', t)
    window.__editor
      .view()
      .contentDOM.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
  await page.waitForTimeout(50)
}
