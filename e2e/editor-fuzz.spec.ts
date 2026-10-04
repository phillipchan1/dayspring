import type { Page, TestInfo } from '@playwright/test'
import { expect, isIPad, open, test } from './fixtures'
import { wkWebViewFirstResponderLag } from './ios'

/**
 * Randomized editing: 500 sequences of typing, Backspace, Enter and caret
 * moves (arrows, taps, taps below the text), plus putting the keyboard away so
 * the next tap is the one that focuses the editor — the tap the iPad used to
 * lose (editor-caret.spec.ts). Each step is checked twice —
 *
 *  · against a model of what the step must do to the text and the caret, and
 *  · against the editor invariant (src/editor/invariant.ts): the DOM shows the
 *    document and the caret the editor's state holds.
 *
 * Everything is real input — key presses and taps through the browser — so
 * CodeMirror's own input paths run, the iOS ones included on `ipad-*`.
 *
 * The alphabet is plain prose (letters and spaces), so the model only has to
 * know CodeMirror's text rules, not markdown's. A failure prints the seed,
 * the sequence and every step so far; replay it with
 *
 *   EDITOR_FUZZ_SEED=<seed> EDITOR_FUZZ_ONLY=<sequence> npm run test:e2e -- editor-fuzz
 */

const SEQUENCES = Number(process.env.EDITOR_FUZZ_SEQUENCES ?? 500)
const STEPS = Number(process.env.EDITOR_FUZZ_STEPS ?? 16)
const SEED = Number(process.env.EDITOR_FUZZ_SEED ?? 20261003)
const ONLY = process.env.EDITOR_FUZZ_ONLY === undefined ? null : Number(process.env.EDITOR_FUZZ_ONLY)

/** mulberry32: small, fast, and the same everywhere. */
function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
  }
}
type Rng = ReturnType<typeof rng>

const LETTERS = [...'abcdefghijklmnopqrstuvwxyz']

function word(r: Rng): string {
  let w = ''
  for (let i = 1 + r.int(7); i > 0; i--) w += r.pick(LETTERS)
  return w
}

/** A starting entry: a title, paragraphs, blank lines, sometimes indented, sometimes trailing lines. */
function startingDoc(r: Rng): string {
  const lines: string[] = [word(r)]
  for (let n = r.int(9); n > 0; n--) {
    const roll = r.next()
    if (roll < 0.35) lines.push('')
    else {
      const words: string[] = []
      for (let k = 1 + r.int(6); k > 0; k--) words.push(word(r))
      lines.push((roll > 0.9 ? ' '.repeat(1 + r.int(4)) : '') + words.join(' '))
    }
  }
  for (let t = r.int(4); t > 0; t--) lines.push('')
  return lines.join('\n')
}

interface Model {
  text: string
  caret: number
}

/** CodeMirror's `deleteCharBackward` with our 3-space indent unit, for plain text. */
function backspace(m: Model): Model {
  const { text, caret } = m
  if (caret === 0) return m
  const lineFrom = text.lastIndexOf('\n', caret - 1) + 1
  const before = text.slice(lineFrom, caret)
  let to = caret - 1
  if (caret > lineFrom && before.length < 200 && /^[ \t]*$/.test(before)) {
    // Inside leading whitespace it deletes back to the previous indent stop.
    const unit = 3
    const drop = before.length % unit || unit
    let i = 0
    while (i < drop && before[before.length - 1 - i] === ' ') i++
    to = caret - i
  }
  return { text: text.slice(0, to) + text.slice(caret), caret: to }
}

const insert = (m: Model, s: string): Model => ({
  text: m.text.slice(0, m.caret) + s + m.text.slice(m.caret),
  caret: m.caret + s.length,
})

interface Snapshot {
  doc: string
  head: number
  anchor: number
  violations: { kind: string; message: string }[]
}

function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const view = window.__editor.view()
    const { head, anchor } = view.state.selection.main
    const violations = (window.__editorInvariant?.check() ?? []).map(({ kind, message }) => ({ kind, message }))
    return { doc: view.state.doc.toString(), head, anchor, violations }
  })
}

async function reset(page: Page, doc: string, caret: number) {
  await page.evaluate(
    ([d, c]) => {
      const view = window.__editor.view()
      view.focus()
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: d }, selection: { anchor: c } })
    },
    [doc, caret] as const,
  )
}

/** Longer than any browser's double-tap/double-click window. */
const MULTI_TAP_MS = 700
let lastTap = { x: -1e9, y: -1e9, at: 0 }

/**
 * Two taps near one spot within the double-tap window select a word — that is
 * the system's gesture, and not a caret move. Space them out like a hand would.
 */
async function tapPoint(page: Page, testInfo: TestInfo, x: number, y: number) {
  const since = Date.now() - lastTap.at
  if (since < MULTI_TAP_MS && Math.abs(x - lastTap.x) < 40 && Math.abs(y - lastTap.y) < 40) {
    await page.waitForTimeout(MULTI_TAP_MS - since)
  }
  lastTap = { x, y, at: Date.now() }
  if (isIPad(testInfo)) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
  await page.waitForTimeout(isIPad(testInfo) ? 60 : 15)
}

test('500 random editing sequences keep the text, the caret and the DOM in agreement', async ({
  page,
}, testInfo) => {
  test.setTimeout(30 * 60_000)
  const ipad = isIPad(testInfo)
  if (ipad) await wkWebViewFirstResponderLag(page)
  await open(page, 'x')

  for (let s = 0; s < SEQUENCES; s++) {
    if (ONLY !== null && s !== ONLY) continue
    const r = rng(SEED + s * 7919)
    const start = startingDoc(r)
    let model: Model = { text: start, caret: r.int(start.length + 1) }
    await reset(page, model.text, model.caret)
    const log: string[] = [`start ${JSON.stringify(model)}`]

    const fail = (step: number, why: string, snap: Snapshot): never => {
      throw new Error(
        [
          `seed ${SEED}, sequence ${s}, step ${step}: ${why}`,
          `model   ${JSON.stringify(model)}`,
          `editor  ${JSON.stringify({ text: snap.doc, caret: snap.head })}`,
          `violations ${JSON.stringify(snap.violations)}`,
          'steps:',
          ...log.map((l) => `  ${l}`),
        ].join('\n'),
      )
    }

    // With the keyboard down nothing types; the next step is a tap.
    let keyboardDown = false

    for (let step = 0; step < STEPS; step++) {
      const roll = keyboardDown ? 0.86 + r.next() * 0.11 : r.next()
      keyboardDown = false
      // Which steps the model can predict the caret for. Up/Down and taps
      // depend on layout, so the editor's answer is read back — and the
      // invariant still has to hold for it.
      let predicted = true

      if (roll < 0.34) {
        const s2 = r.next() < 0.25 ? ' ' : word(r) + (r.next() < 0.5 ? ' ' : '')
        log.push(`type ${JSON.stringify(s2)}`)
        await page.keyboard.type(s2)
        model = insert(model, s2)
      } else if (roll < 0.58) {
        log.push('Backspace')
        const atStart = model.caret === 0
        await page.keyboard.press('Backspace')
        // On iOS a Backspace with nothing to delete changes no DOM, so
        // CodeMirror replays it from a 250ms timer; a hand is never faster.
        if (ipad && atStart) await page.waitForTimeout(300)
        model = backspace(model)
      } else if (roll < 0.7) {
        log.push('Enter')
        await page.keyboard.press('Enter')
        model = insert(model, '\n')
      } else if (roll < 0.8) {
        const key = r.next() < 0.5 ? 'ArrowLeft' : 'ArrowRight'
        log.push(key)
        await page.keyboard.press(key)
        const c = model.caret + (key === 'ArrowLeft' ? -1 : 1)
        model = { ...model, caret: Math.max(0, Math.min(model.text.length, c)) }
      } else if (roll < 0.86) {
        const key = r.next() < 0.5 ? 'ArrowUp' : 'ArrowDown'
        log.push(key)
        await page.keyboard.press(key)
        predicted = false
      } else if (roll < 0.94) {
        // A tap or click on a random character.
        const target = r.int(model.text.length + 1)
        const point = await page.evaluate((p) => {
          const view = window.__editor.view()
          const c = view.coordsAtPos(p, 1) ?? view.coordsAtPos(p, -1)
          if (!c || c.top < 0 || c.bottom > window.innerHeight - 4) return null
          const y = (c.top + c.bottom) / 2
          return { x: c.left + 1, y, line: view.state.doc.lineAt(view.posAtCoords({ x: c.left + 1, y }) ?? p).number }
        }, target)
        if (!point) {
          keyboardDown = keyboardDown || !(await page.evaluate(() => window.__editor.view().hasFocus))
          continue
        }
        log.push(`tap ${target} (line ${point.line})`)
        await tapPoint(page, testInfo, point.x, point.y)
        const snap = await snapshot(page)
        const line = snap.doc.slice(0, snap.head).split('\n').length
        if (line !== point.line) fail(step, `tap on line ${point.line} left the caret on line ${line}`, snap)
        predicted = false
      } else if (roll < 0.97) {
        // A tap in the empty space under the text.
        const point = await page.evaluate(() => {
          const lines = document.querySelectorAll('.cm-content .cm-line')
          const last = lines[lines.length - 1]!.getBoundingClientRect()
          const y = last.bottom + 40
          return y < window.innerHeight - 4 ? { x: last.left + 60, y } : null
        })
        if (!point) {
          keyboardDown = keyboardDown || !(await page.evaluate(() => window.__editor.view().hasFocus))
          continue
        }
        log.push('tap below the text')
        await tapPoint(page, testInfo, point.x, point.y)
        model = { ...model, caret: model.text.length }
      } else {
        log.push('keyboard down')
        await page.evaluate(() => window.__editor.view().contentDOM.blur())
        keyboardDown = true
        continue
      }

      const snap = await snapshot(page)
      if (snap.violations.length > 0) fail(step, 'editor invariant violated', snap)
      if (snap.anchor !== snap.head) fail(step, 'the caret became a selection', snap)
      if (snap.doc !== model.text) fail(step, 'text differs from the model', snap)
      if (predicted && snap.head !== model.caret) fail(step, 'caret differs from the model', snap)
      if (!predicted) model = { ...model, caret: snap.head }
    }
  }
  expect(true).toBe(true)
})
