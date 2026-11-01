// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EXIT_FALLBACK_MS,
  STRANDED_MS,
  exitDuration,
  useExit,
  usePresence,
  waitForExit,
} from './usePresence'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

/** What a sheet in this app looks like as it leaves: a 150ms exit animation. */
const LEAVING = {
  animationName: 'ds-sheet-fall',
  animationDuration: '0.15s',
  animationDelay: '0s',
  transitionDuration: '0s',
  transitionDelay: '0s',
}
const EXIT_TIMEOUT = 150 + 60

beforeEach(() => {
  vi.useFakeTimers()
  computed(LEAVING)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  // jsdom has no matchMedia; tests that stub one put it back.
  delete (window as { matchMedia?: unknown }).matchMedia
})

function reduceMotion(on: boolean) {
  ;(window as { matchMedia?: unknown }).matchMedia = (q: string) => ({
    matches: on && q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })
}

/** A computed style that says the node plays an exit of `ms` (or nothing). */
function computed(style: Partial<CSSStyleDeclaration>) {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue(style as CSSStyleDeclaration)
}

function end(node: Element, type = 'animationend') {
  act(() => {
    node.dispatchEvent(new Event(type, { bubbles: true }))
  })
}

// ── usePresence ──────────────────────────────────────────────────────────────

function Sheet({ value }: { value: { tab: string } | null }) {
  const p = usePresence(value)
  if (!p.mounted) return null
  return createElement(
    'div',
    { ref: p.ref, className: 'sheet', 'data-state': p.state },
    createElement('span', { className: 'child' }, p.value?.tab ?? ''),
  )
}

const sheet = () => host.querySelector<HTMLElement>('.sheet')
const show = (value: { tab: string } | null) => act(() => root.render(createElement(Sheet, { value })))

describe('usePresence', () => {
  it('mounts open, and stays mounted as "closing" when no longer wanted', () => {
    show({ tab: 'writing' })
    expect(sheet()?.dataset.state).toBe('open')
    show(null)
    expect(sheet()?.dataset.state).toBe('closing')
  })

  it('keeps the last open value to draw while it leaves', () => {
    show({ tab: 'about' })
    show(null)
    expect(sheet()?.textContent).toBe('about')
  })

  it('unmounts when its own exit animation ends', () => {
    show({ tab: 'writing' })
    show(null)
    end(sheet()!)
    expect(sheet()).toBeNull()
  })

  it('also takes a transitionend as the end of the exit', () => {
    show({ tab: 'writing' })
    show(null)
    end(sheet()!, 'transitionend')
    expect(sheet()).toBeNull()
  })

  it("ignores a descendant's animation ending", () => {
    show({ tab: 'writing' })
    show(null)
    end(host.querySelector('.child')!)
    expect(sheet()?.dataset.state).toBe('closing')
  })

  it('unmounts on a timeout read from the computed exit when it never reports', () => {
    show({ tab: 'writing' })
    show(null)
    act(() => vi.advanceTimersByTime(EXIT_TIMEOUT - 1))
    expect(sheet()).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(sheet()).toBeNull()
  })

  it("falls back to a fixed timeout when the style can't be read", () => {
    computed({ animationDuration: '', transitionDuration: '' })
    show({ tab: 'writing' })
    show(null)
    act(() => vi.advanceTimersByTime(EXIT_FALLBACK_MS - 1))
    expect(sheet()).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(sheet()).toBeNull()
  })

  it('unmounts straight away when there is no exit animation at all', () => {
    computed({ ...LEAVING, animationName: 'none', animationDuration: 'auto' })
    show({ tab: 'writing' })
    show(null)
    act(() => vi.advanceTimersByTime(0))
    expect(sheet()).toBeNull()
  })

  it('reopening mid-exit takes it back, and the old timeout does not fire', () => {
    show({ tab: 'writing' })
    show(null)
    show({ tab: 'writing' })
    expect(sheet()?.dataset.state).toBe('open')
    act(() => vi.advanceTimersByTime(EXIT_FALLBACK_MS * 3))
    expect(sheet()?.dataset.state).toBe('open')
  })

  it('is immediate under Reduce Motion', () => {
    reduceMotion(true)
    show({ tab: 'writing' })
    show(null)
    expect(sheet()).toBeNull()
  })

  it('never mounts something that was never wanted', () => {
    show(null)
    expect(sheet()).toBeNull()
    act(() => vi.advanceTimersByTime(EXIT_FALLBACK_MS))
    expect(sheet()).toBeNull()
  })

  it('accepts an object rebuilt every render without looping', () => {
    show({ tab: 'a' })
    show({ tab: 'b' })
    show({ tab: 'c' })
    expect(sheet()?.textContent).toBe('c')
  })
})

// ── useExit ──────────────────────────────────────────────────────────────────

function Card({ onClose }: { onClose: () => void }) {
  const exit = useExit(onClose)
  return createElement(
    'div',
    { ref: exit.ref, className: 'card', 'data-state': exit.state },
    createElement('button', { className: 'x', onClick: exit.close }),
    createElement('button', { className: 'y', onClick: exit.close }),
  )
}

const card = () => host.querySelector<HTMLElement>('.card')
const click = (sel: string) =>
  act(() => {
    host.querySelector<HTMLElement>(sel)!.click()
  })

describe('useExit', () => {
  it('plays the exit first, then tells the parent', () => {
    const onClose = vi.fn()
    act(() => root.render(createElement(Card, { onClose })))
    click('.x')
    expect(card()?.dataset.state).toBe('closing')
    expect(onClose).not.toHaveBeenCalled()
    end(card()!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('tells the parent once, however many ways it was asked to close', () => {
    const onClose = vi.fn()
    act(() => root.render(createElement(Card, { onClose })))
    click('.x')
    click('.y')
    end(card()!)
    end(card()!)
    act(() => vi.advanceTimersByTime(EXIT_TIMEOUT))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('falls back to a timeout when the exit never reports', () => {
    const onClose = vi.fn()
    act(() => root.render(createElement(Card, { onClose })))
    click('.x')
    act(() => vi.advanceTimersByTime(EXIT_TIMEOUT))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays closed while the parent takes it away, and reopens if it never does', () => {
    const onClose = vi.fn()
    act(() => root.render(createElement(Card, { onClose })))
    click('.x')
    end(card()!)
    expect(card()?.dataset.state).toBe('closing')
    act(() => vi.advanceTimersByTime(STRANDED_MS))
    expect(card()?.dataset.state).toBe('open')
    // And it can be closed again.
    click('.x')
    end(card()!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('closes at once under Reduce Motion', () => {
    reduceMotion(true)
    const onClose = vi.fn()
    act(() => root.render(createElement(Card, { onClose })))
    click('.x')
    expect(onClose).toHaveBeenCalledTimes(1)
    click('.y')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ── the pieces ───────────────────────────────────────────────────────────────

describe('exitDuration', () => {
  const el = () => document.createElement('div')

  it('reads the longest animation, delay included', () => {
    computed({
      animationName: 'a, b',
      animationDuration: '150ms, 0.2s',
      animationDelay: '0s, 50ms',
      transitionDuration: '0s',
      transitionDelay: '0s',
    })
    expect(exitDuration(el())).toBe(250)
  })

  it('counts transitions too', () => {
    computed({
      animationName: 'none',
      animationDuration: '0s',
      animationDelay: '0s',
      transitionDuration: '0.3s',
      transitionDelay: '0s',
    })
    expect(exitDuration(el())).toBe(300)
  })

  it('ignores the duration of an animation that is not there', () => {
    computed({
      animationName: 'none',
      animationDuration: '1s',
      animationDelay: '0s',
      transitionDuration: '0s',
      transitionDelay: '0s',
    })
    expect(exitDuration(el())).toBe(0)
  })

  it("says it can't tell when the style is blank", () => {
    computed({ animationDuration: '', transitionDuration: '' })
    expect(exitDuration(el())).toBeNull()
    expect(exitDuration(null)).toBeNull()
  })
})

describe('waitForExit', () => {
  it('finishes at once when there is no exit to wait for', () => {
    computed({
      animationName: 'none',
      animationDuration: '0s',
      animationDelay: '0s',
      transitionDuration: '0s',
      transitionDelay: '0s',
    })
    const done = vi.fn()
    waitForExit(document.createElement('div'), done)
    act(() => vi.advanceTimersByTime(0))
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('can be cancelled', () => {
    const done = vi.fn()
    const node = document.createElement('div')
    const cancel = waitForExit(node, done, 100)
    cancel()
    node.dispatchEvent(new Event('animationend'))
    vi.advanceTimersByTime(200)
    expect(done).not.toHaveBeenCalled()
  })

  it('copes with no node at all', () => {
    computed({ animationDuration: '', transitionDuration: '' })
    const done = vi.fn()
    waitForExit(null, done)
    vi.advanceTimersByTime(EXIT_FALLBACK_MS)
    expect(done).toHaveBeenCalledTimes(1)
  })
})
