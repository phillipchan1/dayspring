// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createPortal } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_THRESHOLD,
  FLICK_MIN_TRAVEL,
  FLICK_SPEED,
  RUBBER_BAND,
  dismissDistance,
  rubberBand,
  sheetCommits,
  useSheetDismiss,
} from './useSheetDismiss'
import { STRANDED_MS } from './usePresence'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// ── the rules ────────────────────────────────────────────────────────────────

describe('dismissDistance', () => {
  it('is a quarter of the sheet', () => {
    expect(dismissDistance(800)).toBe(200)
    expect(dismissDistance(400)).toBe(100)
  })

  it('has a floor for short sheets', () => {
    expect(dismissDistance(120)).toBe(64)
  })

  it('falls back to the old fixed distance when the sheet could not be measured', () => {
    expect(dismissDistance(0)).toBe(DEFAULT_THRESHOLD)
  })

  it('lets a caller insist on its own threshold', () => {
    expect(dismissDistance(800, 90)).toBe(90)
  })
})

describe('rubberBand', () => {
  it('follows a downward drag all the way', () => {
    expect(rubberBand(120)).toBe(120)
  })

  it('gives a little to an upward one', () => {
    expect(rubberBand(-100)).toBeCloseTo(-100 * RUBBER_BAND)
  })
})

describe('sheetCommits', () => {
  const at = (dy: number, speed: number) => sheetCommits({ dy, speed, distance: 200 })

  it('takes a slow pull past a quarter of the sheet', () => {
    expect(at(201, 0)).toBe(true)
    expect(at(150, 0)).toBe(false)
  })

  it('takes a flick, however short', () => {
    expect(at(FLICK_MIN_TRAVEL, FLICK_SPEED)).toBe(true)
    expect(at(30, 1.2)).toBe(true)
  })

  it('does not read a tap that slid as a flick', () => {
    expect(at(FLICK_MIN_TRAVEL - 1, FLICK_SPEED)).toBe(false)
  })

  it('projects an ordinary drag speed forward', () => {
    // 150px at 0.4px/ms is headed for 190: not quite.
    expect(at(150, 0.4)).toBe(false)
    expect(at(170, 0.4)).toBe(true)
  })

  it('lets a throw back up cancel even a long drag', () => {
    expect(at(300, -FLICK_SPEED)).toBe(false)
  })

  it('never dismisses a sheet that was pushed up', () => {
    expect(at(-40, 2)).toBe(false)
    expect(at(0, 2)).toBe(false)
  })
})

// ── the gesture ──────────────────────────────────────────────────────────────

let host: HTMLDivElement
let root: Root
let clock = 0

beforeEach(() => {
  vi.useFakeTimers()
  clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function touch(type: string, target: EventTarget, x: number, y: number) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  const list = type === 'touchend' ? [] : [{ clientX: x, clientY: y, target }]
  Object.defineProperty(e, 'touches', { value: list })
  act(() => {
    target.dispatchEvent(e)
  })
  return e
}

/** A drag down the sheet: land, then one move per 16ms step, then lift. */
function drag(target: Element, path: number[], { lift = true, x = 100 } = {}) {
  touch('touchstart', target, x, path[0]!)
  for (const y of path.slice(1)) {
    clock += 16
    touch('touchmove', window, x, y)
  }
  if (lift) touch('touchend', window, x, path[path.length - 1]!)
}

/** A slow drag from `from` to `to`, at about 0.1px/ms, held still at the end. */
function slow(target: Element, from: number, to: number, opts?: { lift?: boolean }) {
  const path = [from]
  for (let y = from; y !== to; ) {
    y += Math.sign(to - from) * Math.min(2, Math.abs(to - y))
    path.push(y)
  }
  drag(target, path, { lift: false })
  clock += 200 // rest before lifting: no fling left in it
  if (opts?.lift !== false) touch('touchend', window, 100, to)
}

let renders = 0

function Sheet({
  onDismiss,
  dom,
  exit,
  scrollTop = 0,
}: {
  onDismiss: () => void
  dom?: boolean
  exit?: boolean
  scrollTop?: number
}) {
  renders++
  const s = useSheetDismiss({ onDismiss, exit: exit ?? false })
  return createElement(
    'div',
    {
      className: 'sheet',
      ref: dom ? s.ref : undefined,
      style: dom ? undefined : { transform: s.dragY ? `translateY(${s.dragY}px)` : undefined },
      'data-dragging': s.dragging ? 'true' : undefined,
      ...s.handlers,
    },
    createElement('div', { className: 'grab' }),
    createElement(
      'div',
      {
        className: 'scroll',
        'data-sheet-scroll': '',
        ref: (el: HTMLDivElement | null) => {
          if (el) el.scrollTop = scrollTop
        },
      },
      createElement('p', { className: 'row' }, 'row'),
    ),
    createElement(
      'div',
      { className: 'portal-host' },
      createPortal(createElement('div', { className: 'drawer' }), document.body),
    ),
  )
}

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!
const mount = (props: Parameters<typeof Sheet>[0]) => act(() => root.render(createElement(Sheet, props)))

/** The jsdom sheet has no layout, so it measures 0 and falls back to 110px. */
const FAR = DEFAULT_THRESHOLD + 20
const NEAR = DEFAULT_THRESHOLD - 30

describe('useSheetDismiss — the old contract (no ref)', () => {
  it('draws the travel through dragY while the finger is down', () => {
    mount({ onDismiss: vi.fn() })
    slow(q('.grab'), 100, 160, { lift: false })
    // 60px of finger, less the 8px it took to say which way it was going.
    expect(q('.sheet').style.transform).toBe('translateY(52px)')
    expect(q('.sheet').dataset.dragging).toBe('true')
  })

  it('dismisses a slow pull past the distance, at once', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss })
    slow(q('.grab'), 100, 100 + FAR)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('puts a short pull back', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss })
    slow(q('.grab'), 100, 100 + NEAR)
    expect(onDismiss).not.toHaveBeenCalled()
    expect(q('.sheet').style.transform).toBe('')
    expect(q('.sheet').dataset.dragging).toBeUndefined()
  })

  it('takes a quick flick that never got near the distance', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss })
    // ~1.9px/ms over a few frames — a flick, ~100px short of the threshold.
    drag(q('.grab'), [100, 110, 140, 170])
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  /*
   * The quick gestures are the ones most likely to be a dismissal, and the
   * ones that land their touchend before React has drawn the last move.
   */
  it('decides on the live travel, not on a render that may not have happened', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss })
    touch('touchstart', q('.grab'), 100, 100)
    clock += 16
    touch('touchmove', window, 100, 112)
    clock += 16
    touch('touchmove', window, 100, 100 + FAR + 12)
    touch('touchend', window, 100, 100 + FAR + 12)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('cancels a long drag thrown back up at the end', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss })
    drag(q('.grab'), [100, 110, 150, 200, 260, 300, 270, 230])
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('rubber-bands an upward pull off the grabber', () => {
    mount({ onDismiss: vi.fn() })
    slow(q('.grab'), 300, 200, { lift: false })
    // The 8px of slop isn't travel: measured from where the drag was recognised.
    expect(q('.sheet').style.transform).toBe(`translateY(${-92 * RUBBER_BAND}px)`)
  })

  it('leaves an upward drag inside the scroller to the scroller', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss })
    const move = (() => {
      touch('touchstart', q('.row'), 100, 300)
      clock += 16
      return touch('touchmove', window, 100, 260)
    })()
    expect(q('.sheet').style.transform).toBe('')
    expect(move.defaultPrevented).toBe(false)
  })

  it('takes a downward drag from a scroller already at the top — and stops it scrolling', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss })
    touch('touchstart', q('.row'), 100, 100)
    clock += 16
    touch('touchmove', window, 100, 120)
    clock += 16
    const move = touch('touchmove', window, 100, 160)
    expect(move.defaultPrevented).toBe(true)
    expect(q('.sheet').style.transform).not.toBe('')
  })

  it('leaves a scrolled scroller alone entirely', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss, scrollTop: 40 })
    slow(q('.row'), 100, 100 + FAR)
    expect(onDismiss).not.toHaveBeenCalled()
    expect(q('.sheet').style.transform).toBe('')
  })

  it('ignores a sideways drag', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss })
    drag(q('.grab'), [100, 100, 101, 102], { x: 10 })
    touch('touchstart', q('.grab'), 10, 100)
    clock += 16
    touch('touchmove', window, 60, 104)
    clock += 16
    touch('touchmove', window, 140, 120)
    touch('touchend', window, 140, 120)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('ignores a touch that only reached it through a portal', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss })
    slow(q('.drawer'), 100, 100 + FAR)
    expect(onDismiss).not.toHaveBeenCalled()
  })
})

describe('useSheetDismiss — drawn on the element (ref)', () => {
  it('writes the travel to the element without a render per move', () => {
    mount({ onDismiss: vi.fn(), dom: true })
    touch('touchstart', q('.grab'), 100, 100)
    clock += 16
    touch('touchmove', window, 100, 110) // recognised: one render, for `dragging`
    const before = renders
    for (let y = 120; y <= 200; y += 10) {
      clock += 16
      touch('touchmove', window, 100, y)
    }
    expect(renders).toBe(before)
    expect(q('.sheet').style.translate).toBe('0 90px')
    expect(q('.sheet').style.transform).toBe('')
  })

  it('leaves the sheet where the finger let go, for the exit to carry on from', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss, dom: true })
    slow(q('.grab'), 100, 100 + FAR)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(q('.sheet').style.translate).toBe(`0 ${FAR - 8}px`)
    expect(q('.sheet').dataset.released).toBe('true')
  })

  it('springs a short pull home, then lets go of the inline style', () => {
    mount({ onDismiss: vi.fn(), dom: true })
    slow(q('.grab'), 100, 100 + NEAR)
    expect(q('.sheet').style.translate).toBe('0 0')
    expect(q('.sheet').style.transition).toContain('translate')
    act(() => {
      q('.sheet').dispatchEvent(new Event('transitionend'))
    })
    expect(q('.sheet').style.translate).toBe('')
    expect(q('.sheet').style.transition).toBe('')
  })

  it('with `exit`, carries itself off before saying so', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss, dom: true, exit: true })
    slow(q('.grab'), 100, 100 + FAR)
    expect(onDismiss).not.toHaveBeenCalled()
    expect(q('.sheet').style.translate).toBe('0 100%')
    act(() => {
      q('.sheet').dispatchEvent(new Event('transitionend'))
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('ignores touches while it is leaving', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss, dom: true })
    slow(q('.grab'), 100, 100 + FAR)
    slow(q('.grab'), 100, 100 + FAR)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('comes back if nobody takes it away', () => {
    const onDismiss = vi.fn()
    mount({ onDismiss, dom: true })
    slow(q('.grab'), 100, 100 + FAR)
    act(() => vi.advanceTimersByTime(STRANDED_MS))
    expect(q('.sheet').style.translate).toBe('0 0')
    // And answers to a finger again.
    slow(q('.grab'), 100, 100 + FAR)
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })
})
