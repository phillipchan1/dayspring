import { describe, expect, it } from 'vitest'
import { FormatBarSettle, SETTLE_MS, type SelectionFacts, type Timers } from './formatBarSettle'

/** A hand-cranked clock, so "350ms later" is something a test can say. */
function clock() {
  let now = 0
  let seq = 0
  const pending = new Map<number, { at: number; fn: () => void }>()
  const timers: Timers = {
    set: (fn, ms) => {
      const id = ++seq
      pending.set(id, { at: now + ms, fn })
      return id
    },
    clear: (h) => {
      pending.delete(h as number)
    },
  }
  const advance = (ms: number) => {
    now += ms
    for (;;) {
      const due = [...pending.entries()].filter(([, t]) => t.at <= now).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      pending.delete(due[0])
      due[1].fn()
    }
  }
  return { timers, advance }
}

function setup() {
  const facts: SelectionFacts = { empty: true, wholeDoc: false, caret: false }
  const c = clock()
  const log: string[] = []
  let visible = false
  const settle = new FormatBarSettle(
    () => facts,
    () => {
      visible = true
      log.push('show')
    },
    () => {
      visible = false
      log.push('hide')
    },
    SETTLE_MS,
    c.timers,
  )
  const keys = { userSelect: true, pointerSelect: false, focusGained: false }
  const pointer = { userSelect: true, pointerSelect: true, focusGained: false }
  const edit = { userSelect: false, pointerSelect: false, focusGained: false }
  return { facts, settle, advance: c.advance, log, visible: () => visible, keys, pointer, edit }
}

describe('FormatBarSettle', () => {
  it('a keyboard selection shows the bar only once it has sat still', () => {
    const t = setup()
    t.facts.empty = false
    t.settle.update(t.keys)
    expect(t.visible()).toBe(false)
    t.advance(SETTLE_MS - 1)
    expect(t.visible()).toBe(false)
    t.advance(1)
    expect(t.visible()).toBe(true)
  })

  it('holding ⇧→ never strobes it: each change restarts the wait', () => {
    const t = setup()
    t.facts.empty = false
    for (let i = 0; i < 5; i++) {
      t.settle.update(t.keys)
      t.advance(100)
    }
    expect(t.log).toEqual([])
    t.advance(SETTLE_MS)
    expect(t.log).toEqual(['show'])
  })

  it('hides while the pointer is down, and shows when it lifts', () => {
    const t = setup()
    t.settle.pressed(true)
    t.facts.empty = false
    t.settle.update(t.pointer) // dragging
    t.settle.update(t.pointer)
    expect(t.visible()).toBe(false)
    t.settle.released()
    t.advance(0)
    expect(t.visible()).toBe(true)
  })

  it("CodeMirror's mouseup selection after the lift settles at once", () => {
    const t = setup()
    t.settle.pressed(true)
    t.settle.released()
    t.facts.empty = false
    t.settle.update(t.pointer)
    expect(t.visible()).toBe(true)
  })

  it('never shows for select-all from the keyboard', () => {
    const t = setup()
    t.facts.empty = false
    t.facts.wholeDoc = true
    t.settle.update(t.keys)
    t.advance(SETTLE_MS * 2)
    expect(t.visible()).toBe(false)
  })

  it('does show when a triple-click happens to take the whole entry', () => {
    const t = setup()
    t.settle.pressed(true)
    t.facts.empty = false
    t.facts.wholeDoc = true
    t.settle.update(t.pointer)
    t.settle.released()
    t.advance(0)
    expect(t.visible()).toBe(true)
  })

  it('a right-click belongs to the native menu: no bar, even as the selection changes under it', () => {
    const t = setup()
    t.settle.pressed(false)
    t.facts.empty = false
    t.settle.update(t.pointer) // WebKit selects the word under a right-click
    t.settle.contextMenu()
    t.settle.released()
    t.advance(SETTLE_MS * 2)
    expect(t.visible()).toBe(false)
    t.settle.key() // the next keystroke ends that
    t.settle.update(t.keys)
    t.advance(SETTLE_MS)
    expect(t.visible()).toBe(true)
  })

  it('Esc puts it away until the selection changes', () => {
    const t = setup()
    t.facts.empty = false
    t.settle.update(t.keys)
    t.advance(SETTLE_MS)
    t.settle.dismiss()
    expect(t.visible()).toBe(false)
    t.settle.refresh() // a scroll does not bring it back
    t.settle.update({ ...t.edit, focusGained: true })
    t.advance(SETTLE_MS)
    expect(t.visible()).toBe(false)
    t.settle.update(t.keys) // a new selection does
    t.advance(SETTLE_MS)
    expect(t.visible()).toBe(true)
  })

  it('follows its own edits in place, without hiding', () => {
    const t = setup()
    t.facts.empty = false
    t.settle.update(t.keys)
    t.advance(SETTLE_MS)
    t.log.length = 0
    t.settle.update(t.edit) // bold applied from the bar
    expect(t.log).toEqual(['show'])
  })

  it('summoned at the caret it shows at once', () => {
    const t = setup()
    t.facts.caret = true
    t.settle.update(t.edit)
    expect(t.visible()).toBe(true)
  })

  it('a collapsed caret puts it away', () => {
    const t = setup()
    t.facts.empty = false
    t.settle.update(t.keys)
    t.advance(SETTLE_MS)
    t.facts.empty = true
    t.settle.update(t.edit)
    expect(t.visible()).toBe(false)
  })

  it('a finger never strands it: a touch with no release still settles on the delay', () => {
    const t = setup()
    t.settle.pressed(true, false) // touch; WebKit may swallow the release
    t.facts.empty = false
    t.settle.update(t.keys) // handle drag, reported as a plain select
    t.advance(SETTLE_MS)
    expect(t.visible()).toBe(true)
  })
})
