import {
  editorState,
  expect,
  mod,
  open,
  paste,
  pointAt,
  press,
  setCaret,
  tap,
  test,
} from './fixtures'

/**
 * The editor regression suite: the gestures a writer makes a thousand times a
 * day, each checked for what it does to the text AND where it leaves the
 * caret. The invariant guard (fixtures.ts) also fails any of these if the DOM
 * and the editor's state drifted apart while it ran.
 *
 * Run on every project: desktop Chromium, Chromium running CodeMirror's iOS
 * paths at an iPad viewport, and real WebKit (on a Mac).
 */

const DOC = 'Morning\n\nFirst paragraph.\n\nSecond paragraph.\n\nThird.\n\n\n'
const at = (needle: string) => DOC.indexOf(needle)

test.describe('Backspace', () => {
  test('at the start of the document does nothing', async ({ page }, testInfo) => {
    await open(page, DOC)
    await setCaret(page, 0)
    await press(page, testInfo, 'Backspace')
    expect(await editorState(page)).toMatchObject({ doc: DOC, head: 0 })
  })

  test('in the middle of a word deletes the character before the caret', async ({ page }, testInfo) => {
    await open(page, DOC)
    const pos = at('Second') + 3
    await setCaret(page, pos)
    await press(page, testInfo, 'Backspace')
    expect(await editorState(page)).toMatchObject({
      doc: DOC.replace('Second', 'Seond'),
      head: pos - 1,
    })
  })

  test('at the end of the document takes the trailing lines one at a time', async ({ page }, testInfo) => {
    await open(page, DOC)
    await setCaret(page, DOC.length)
    await press(page, testInfo, 'Backspace', 2)
    expect(await editorState(page)).toMatchObject({ doc: DOC.slice(0, -2), head: DOC.length - 2 })
  })

  test('at the end of the last word deletes its last character', async ({ page }, testInfo) => {
    const doc = 'Morning\n\nThe end.'
    await open(page, doc)
    await setCaret(page, doc.length)
    await press(page, testInfo, 'Backspace')
    expect(await editorState(page)).toMatchObject({ doc: 'Morning\n\nThe end', head: doc.length - 1 })
  })

  test('across blank lines removes the blank line, then joins, then eats into the paragraph above', async ({
    page,
  }, testInfo) => {
    await open(page, DOC)
    const start = at('Second')
    await setCaret(page, start)

    await press(page, testInfo, 'Backspace')
    expect(await editorState(page)).toMatchObject({
      doc: DOC.replace('First paragraph.\n\nSecond', 'First paragraph.\nSecond'),
      head: start - 1,
    })
    await press(page, testInfo, 'Backspace')
    expect(await editorState(page)).toMatchObject({
      doc: DOC.replace('First paragraph.\n\nSecond', 'First paragraph.Second'),
      head: start - 2,
    })
    await press(page, testInfo, 'Backspace')
    expect(await editorState(page)).toMatchObject({
      doc: DOC.replace('First paragraph.\n\nSecond', 'First paragraphSecond'),
      head: start - 3,
    })
  })
})

test.describe('Enter', () => {
  test('on an empty line between paragraphs opens a line below it', async ({ page }, testInfo) => {
    await open(page, DOC)
    const blank = at('First paragraph.') + 'First paragraph.'.length + 1
    await setCaret(page, blank)
    await press(page, testInfo, 'Enter')
    await page.keyboard.type('x')
    expect(await editorState(page)).toMatchObject({
      doc: DOC.replace('First paragraph.\n\n', 'First paragraph.\n\nx\n'),
      head: blank + 2,
    })
  })

  test('on the trailing lines keeps adding lines at the end', async ({ page }, testInfo) => {
    await open(page, DOC)
    await setCaret(page, DOC.length)
    await press(page, testInfo, 'Enter', 2)
    await page.keyboard.type('End')
    const want = `${DOC}\n\nEnd`
    expect(await editorState(page)).toMatchObject({ doc: want, head: want.length })
  })
})

test('a tap inside a word puts the caret there, and typing lands there', async ({ page }, testInfo) => {
  await open(page, DOC)
  await setCaret(page, 0)
  const pos = at('paragraph.') + 4
  const point = await pointAt(page, pos)
  await tap(page, testInfo, point.x, point.y)
  expect((await editorState(page)).head).toBe(pos)
  await page.keyboard.type('Z')
  expect(await editorState(page)).toMatchObject({
    doc: DOC.replace('First paragraph.', 'First paraZgraph.'),
    head: pos + 1,
  })
})

test.describe('a tap on decoration still places the caret on its line', () => {
  // Found by the randomized test: on touch, a finger on non-editable text
  // placed no caret, so tapping "Keep going…" to start the body left the caret
  // on the title — and the first words of the body went into the title.
  test('the "Keep going…" placeholder', async ({ page }, testInfo) => {
    await open(page, 'Morning\n')
    await setCaret(page, 'Morning'.length)
    const box = await page.locator('.cm-content .cm-placeholder').boundingBox()
    await tap(page, testInfo, box!.x + 10, box!.y + box!.height / 2)
    expect((await editorState(page)).head).toBe('Morning\n'.length)
    await page.keyboard.type('Body')
    expect((await editorState(page)).doc).toBe('Morning\nBody')
  })

  test('a list bullet', async ({ page }, testInfo) => {
    const doc = 'Morning\n\n- first item\n- second item'
    await open(page, doc)
    await setCaret(page, 0)
    const bullets = page.locator('.cm-content .cm-li-bullet')
    await expect(bullets).toHaveCount(2)
    const box = await bullets.nth(1).boundingBox()
    await tap(page, testInfo, box!.x + box!.width / 2, box!.y + box!.height / 2)
    const { head } = await editorState(page)
    expect(doc.slice(0, head).split('\n').length, 'caret on the second item').toBe(4)
  })
})

test('select all, then Backspace, empties the entry and typing starts it again', async ({ page }, testInfo) => {
  await open(page, DOC)
  await setCaret(page, at('Second'))
  await page.keyboard.press(`${mod(testInfo)}+a`)
  expect(await editorState(page)).toMatchObject({ anchor: 0, head: DOC.length })
  await press(page, testInfo, 'Backspace')
  expect(await editorState(page)).toMatchObject({ doc: '', head: 0 })
  await page.keyboard.type('Fresh')
  expect(await editorState(page)).toMatchObject({ doc: 'Fresh', head: 5 })
})

test('pasting several lines inserts them at the caret and leaves the caret after them', async ({ page }) => {
  await open(page, DOC)
  const end = at('First paragraph.') + 'First paragraph.'.length
  await setCaret(page, end)
  const text = ' One.\nTwo.\n\nThree.'
  await paste(page, text)
  expect(await editorState(page)).toMatchObject({
    doc: DOC.replace('First paragraph.', `First paragraph.${text}`),
    head: end + text.length,
  })
})

test('undo takes back what was typed and puts the caret back; redo restores both', async ({ page }, testInfo) => {
  await open(page, DOC)
  const end = at('Third.') + 'Third.'.length
  await setCaret(page, end)
  await page.keyboard.type(' More words')
  const typed = DOC.replace('Third.', 'Third. More words')
  expect(await editorState(page)).toMatchObject({ doc: typed, head: end + 11 })

  await page.keyboard.press(`${mod(testInfo)}+z`)
  expect(await editorState(page)).toMatchObject({ doc: DOC, head: end })

  await page.keyboard.press(`${mod(testInfo)}+Shift+z`)
  expect(await editorState(page)).toMatchObject({ doc: typed, head: end + 11 })
})

test.describe('autosave', () => {
  test('saving mid-typing never moves the caret or loses a character', async ({ page }, testInfo) => {
    // A 120ms debounce and a 60ms round trip, against pauses either side of
    // both: saves land while typing, while paused and clean (played back
    // through applyRemoteDoc), and while dirty again.
    await open(page, DOC, 'autosave=120')
    const end = at('Third.') + 'Third.'.length
    await setCaret(page, end)

    const chunks = [' I was', ' not sure', ' what to', ' write,', ' and then', ' I did.']
    const pauses = [150, 260, 130, 320, 90, 0]
    let typed = ''
    for (let i = 0; i < chunks.length; i++) {
      await page.keyboard.type(chunks[i]!, { delay: 15 })
      typed += chunks[i]
      expect(await editorState(page)).toMatchObject({
        doc: DOC.replace('Third.', `Third.${typed}`),
        head: end + typed.length,
      })
      await page.waitForTimeout(pauses[i]!)
    }
    await press(page, testInfo, 'Enter')
    await page.keyboard.type('Next line.')
    await page.waitForTimeout(400)

    const want = DOC.replace('Third.', `Third.${typed}\nNext line.`)
    expect(await editorState(page)).toMatchObject({ doc: want, head: end + typed.length + 1 + 'Next line.'.length })
    const saves = await page.evaluate(() => window.__editor.saves)
    expect(saves.done, 'autosave fired mid-typing').toBeGreaterThanOrEqual(3)
    expect(saves.echoed, 'and the server copy was played back while clean').toBeGreaterThanOrEqual(1)
  })

  test("React's re-render on every keystroke never touches the editor's DOM", async ({ page }) => {
    await open(page, DOC, 'autosave=120')
    await setCaret(page, DOC.length)
    await page.evaluate(() => {
      const host = document.querySelector('.editor-host')!
      const w = window as unknown as { __hostMutations: number; __cmEditor: Element }
      w.__hostMutations = 0
      w.__cmEditor = host.querySelector('.cm-editor')!
      // React owns the host and nothing inside it; CodeMirror owns the rest.
      new MutationObserver((records) => (w.__hostMutations += records.length)).observe(host, {
        childList: true,
        attributes: true,
      })
    })
    await page.keyboard.type('Every keystroke re-renders the tree above me.', { delay: 10 })
    await page.waitForTimeout(300)
    const result = await page.evaluate(() => {
      const w = window as unknown as { __hostMutations: number; __cmEditor: Element }
      return {
        mutations: w.__hostMutations,
        sameEditor: document.querySelector('.editor-host .cm-editor') === w.__cmEditor,
      }
    })
    expect(result).toEqual({ mutations: 0, sameEditor: true })
  })
})
