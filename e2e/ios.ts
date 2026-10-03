import type { Page, TestInfo } from '@playwright/test'

/**
 * Make CodeMirror take its iOS input paths in Chromium.
 *
 * CodeMirror decides it is on iOS once, at import, from `navigator.vendor`
 * ("Apple Computer") plus a `Mobile/` UA or `maxTouchPoints > 2`. On iOS it
 * handles Backspace and Enter differently from every other platform: it lets
 * WebKit edit the DOM natively, then throws that edit away and replays the key
 * as a command against its OWN selection (`flushIOSKey`). That replay is half
 * of the caret bug, so the suite has to run it.
 *
 * WebKit projects are left alone — they are the real thing.
 */
export async function emulateIOS(page: Page, testInfo: TestInfo): Promise<void> {
  if (testInfo.project.name !== 'ipad-chromium') return
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'vendor', { get: () => 'Apple Computer, Inc.' })
    Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 5 })
  })
}

/**
 * WKWebView's first-responder lag.
 *
 * A tap that focuses an editable while the keyboard is down makes WebKit focus
 * the element and place the caret straight away, but `document.hasFocus()`
 * stays false until the web view becomes first responder — which UIKit does
 * asynchronously, as the keyboard rises. CodeMirror reads `document.hasFocus()`
 * (through `view.hasFocus`) to decide whether a DOM selection change is the
 * writer's. This reproduces that window, and only that window: a touch that
 * lands while the editor is unfocused reports "not focused" for `ms`.
 */
export async function wkWebViewFirstResponderLag(page: Page, ms = 60): Promise<void> {
  await page.addInitScript((lag) => {
    const real = Document.prototype.hasFocus
    let notFirstResponderUntil = 0
    addEventListener(
      'touchstart',
      () => {
        const content = document.querySelector('.cm-content')
        if (content && document.activeElement !== content) notFirstResponderUntil = performance.now() + lag
      },
      true,
    )
    Document.prototype.hasFocus = function (this: Document) {
      return performance.now() >= notFirstResponderUntil && real.call(this)
    }
  }, ms)
}
