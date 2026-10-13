import type { Page } from '@playwright/test'
import { expect, open, setCaret, test } from './fixtures'

/**
 * Typewriter scrolling (src/editor/typewriter.ts) and the on-screen keyboard.
 *
 * iOS shrinks the visual viewport for the keyboard and leaves the layout
 * viewport — and so the editor's scroller — where it was. The phone's shell
 * follows the visual viewport down; the iPad's wide layout does not, so a third
 * to a half of its scroller sits under the keyboard. "Centre" has to mean the
 * centre of what is left, or in landscape the line being written lands on the
 * keyboard's top edge.
 *
 * The keyboard here is a stand-in: `visualViewport` reports a shorter height,
 * the way WKWebView's does, and fires `resize` when it changes.
 */

const PARAS = Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1} of the morning pages.`)
const DOC = `Morning\n\n${PARAS.join('\n\n')}\n`

async function withFakeKeyboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const real = window.visualViewport!
    let keyboard = 0
    const fake = new EventTarget() as EventTarget & Record<string, unknown>
    for (const key of ['width', 'offsetLeft', 'offsetTop', 'pageLeft', 'pageTop', 'scale'] as const) {
      Object.defineProperty(fake, key, { get: () => real[key] })
    }
    Object.defineProperty(fake, 'height', { get: () => real.height - keyboard })
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake })
    ;(window as unknown as { __keyboard: (px: number) => void }).__keyboard = (px) => {
      keyboard = px
      fake.dispatchEvent(new Event('resize'))
    }
  })
}

const showKeyboard = (page: Page, share: number) =>
  page.evaluate((s) => {
    ;(window as unknown as { __keyboard: (px: number) => void }).__keyboard(Math.round(innerHeight * s))
  }, share)

/** Where the caret sits, as a share of the part of the scroller nothing covers. */
function caretInVisible(page: Page): Promise<number> {
  return page.evaluate(() => {
    const view = window.__editor.view()
    const c = view.coordsAtPos(view.state.selection.main.head)!
    const s = view.scrollDOM.getBoundingClientRect()
    const vv = window.visualViewport!
    const bottom = Math.min(s.bottom, vv.offsetTop + vv.height)
    return ((c.top + c.bottom) / 2 - s.top) / (bottom - s.top)
  })
}

/** The centring runs a frame after the change; give it two. */
const settle = (page: Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

test('with no keyboard, the line being written sits mid-page', async ({ page }) => {
  await withFakeKeyboard(page)
  await open(page, DOC, 'typewriter=1')
  await setCaret(page, DOC.length)
  await page.keyboard.type('Amen')
  await settle(page)
  const at = await caretInVisible(page)
  expect(at).toBeGreaterThan(0.4)
  expect(at).toBeLessThan(0.6)
})

test('typing with the keyboard up centres the line above it', async ({ page }) => {
  await withFakeKeyboard(page)
  await open(page, DOC, 'typewriter=1')
  await setCaret(page, DOC.length)
  // An iPad in landscape: the keyboard takes nearly half the screen.
  await showKeyboard(page, 0.45)
  await page.keyboard.type('Amen')
  await settle(page)
  const at = await caretInVisible(page)
  expect(at).toBeGreaterThan(0.35)
  expect(at).toBeLessThan(0.65)
})

test('the keyboard rising re-centres the line without a keystroke', async ({ page }) => {
  await withFakeKeyboard(page)
  await open(page, DOC, 'typewriter=1')
  // Mid-entry, where centring is never clamped by the ends of the page.
  const mid = DOC.indexOf('Paragraph 20')
  await setCaret(page, mid)
  await settle(page)
  await showKeyboard(page, 0.45)
  await settle(page)
  const at = await caretInVisible(page)
  expect(at).toBeGreaterThan(0.4)
  expect(at).toBeLessThan(0.6)
})
