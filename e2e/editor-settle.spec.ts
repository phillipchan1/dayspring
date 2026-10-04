import { expect, open, press, setCaret, test } from './fixtures'

/**
 * Settle (features/journal/useSettle.ts) fades the journal's frame when the
 * writer changes the page. Its only hook into the editor is `onUserInput`, so
 * that is what this checks: it fires for the writer's own typing and deleting,
 * and never for a change the app made.
 */

const DOC = 'Morning\n\nFirst paragraph.\n'
const inputs = (page: import('@playwright/test').Page) => page.evaluate(() => window.__editor.userInputs)

test('typing and deleting count as the writer’s input', async ({ page }, testInfo) => {
  await open(page, DOC)
  await setCaret(page, DOC.length)
  expect(await inputs(page)).toBe(0)
  await page.keyboard.type('Lord')
  await expect.poll(() => inputs(page)).toBeGreaterThan(0)
  const afterTyping = await inputs(page)
  await press(page, testInfo, 'Backspace')
  await expect.poll(() => inputs(page)).toBeGreaterThan(afterTyping)
})

test('a change the app makes does not', async ({ page }) => {
  await open(page, DOC)
  await page.evaluate(() => {
    const view = window.__editor.view()
    view.dispatch({ changes: { from: view.state.doc.length, insert: 'From the app.' } })
  })
  expect(await page.evaluate(() => window.__editor.doc())).toContain('From the app.')
  expect(await inputs(page)).toBe(0)
})
