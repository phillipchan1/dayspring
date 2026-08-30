// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RitualComposer } from './RitualComposer'
import { composeRitualMarkdown } from './ritualDocument'
import { PRACTICES } from './practicesData'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// The composer is under test, not the viewport hooks.
vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => true,
  useTouchPrimary: () => true,
  useMediaQuery: () => false,
}))

const examen = PRACTICES.find((p) => p.name === 'The Daily Examen')!
const LABELS = examen.prompts.map((p) => p.label)

/**
 * jsdom has no visualViewport, and the whole point is what happens when iOS
 * moves it, so it is faked here and moved on purpose.
 */
function fakeVisualViewport(top: number, height: number) {
  const listeners = new Map<string, Set<() => void>>()
  const vv = {
    offsetTop: top,
    height,
    addEventListener(type: string, fn: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(fn)
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.get(type)?.delete(fn)
    },
    /** Move it the way the soft keyboard does, and tell everyone. */
    moveTo(nextTop: number, nextHeight: number) {
      vv.offsetTop = nextTop
      vv.height = nextHeight
      listeners.get('scroll')?.forEach((fn) => fn())
      listeners.get('resize')?.forEach((fn) => fn())
    },
  }
  Object.defineProperty(window, 'visualViewport', {
    value: vv,
    configurable: true,
    writable: true,
  })
  return vv
}

/** jsdom has no constructible TouchEvent; only these fields are read. */
function touchEvent(type: string, x: number, y: number): Event {
  const e = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    touches: unknown[]
    changedTouches: unknown[]
  }
  const t = { identifier: 1, clientX: x, clientY: y }
  e.touches = type === 'touchend' ? [] : [t]
  e.changedTouches = [t]
  return e
}

/** Returns true when a listener called preventDefault — the claim we care about. */
function dispatchMove(x: number, y: number): boolean {
  return !window.dispatchEvent(touchEvent('touchmove', x, y))
}

/** React tracks its own value on inputs, so a plain assignment is ignored. */
function type(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )!.set!
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('RitualComposer', () => {
  let root: Root
  let host: HTMLDivElement
  let doc: string
  let onClose: ReturnType<typeof vi.fn<() => void>>

  /**
   * Render the way JournalScreen really does — fresh inline closures every
   * time, which is the thing that used to break the debounce.
   */
  const render = (blocked = false) => {
    act(() => {
      root.render(
        createElement(RitualComposer, {
          blockIndex: 0,
          getDoc: () => doc,
          replaceRange: (from: number, to: number, text: string) => {
            doc = doc.slice(0, from) + text + doc.slice(to)
          },
          onClose,
          onAbout: () => {},
          blocked,
        }),
      )
    })
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    doc = composeRitualMarkdown(examen.name, LABELS, ['', '', '', ''])
    onClose = vi.fn<() => void>()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.useRealTimers()
  })

  const liveTextarea = () =>
    document.querySelector<HTMLTextAreaElement>(
      '.rc__pane:not([aria-hidden="true"]) .rc__write',
    )!

  it('writes what was typed into the entry', () => {
    render()
    act(() => type(liveTextarea(), 'The long walk after dinner.'))
    act(() => vi.advanceTimersByTime(500))
    expect(doc).toContain('<!-- ritual:section:Gratitude -->\nThe long walk after dinner.')
  })

  it('holds the write for the debounce, even as the parent re-renders', () => {
    /*
     * The regression, and why it hid: `commit` depended on the parent's inline
     * callbacks, so every parent render rebuilt it. That restarted the 400ms
     * timer — *and* ran the cleanup of the effect written as "commit on
     * unmount", which committed immediately. The two faults cancelled, so the
     * text still landed and nothing looked wrong; what actually happened was a
     * CodeMirror transaction dispatched on every render of a busy entry, into
     * the one code path that is supposed to stay cheap.
     *
     * So the assertion is not "it eventually writes" — the broken version did
     * too. It is that the write waits.
     */
    render()
    act(() => type(liveTextarea(), 'Bread, and the walk.'))
    act(() => vi.advanceTimersByTime(150))
    render()
    act(() => vi.advanceTimersByTime(150))
    render()
    expect(doc).not.toContain('Bread, and the walk.')

    act(() => vi.advanceTimersByTime(400))
    expect(doc).toContain('Bread, and the walk.')
  })

  it('writes on the way out, without waiting for the debounce', () => {
    render()
    act(() => type(liveTextarea(), 'Unflushed.'))
    act(() => root.unmount())
    expect(doc).toContain('Unflushed.')
    // Re-mount so afterEach's unmount has something to unmount.
    root = createRoot(host)
    render()
  })

  it('leaves on Escape', () => {
    render()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('ignores Escape while a sheet is open over it', () => {
    // Both listen on window in the capture phase, and `stopPropagation` does not
    // stop a sibling listener on the same target — so without this the one
    // Escape meant for the About sheet also threw the writer out of the ritual.
    render(true)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('follows the visual viewport instead of the layout viewport', () => {
    /*
     * A `position: fixed` overlay is anchored to the LAYOUT viewport. When iOS
     * opens the keyboard it scrolls the page to keep the focused field in view,
     * and the overlay then sits `offsetTop` pixels too high: its masthead slides
     * up under the Dynamic Island and its footer stops the same distance short
     * of the keyboard. One cause, both symptoms — which is how it was found.
     */
    const vv = fakeVisualViewport(0, 800)
    render()
    const el = () => document.querySelector<HTMLElement>('.ritual-composer')!
    expect(el().style.top).toBe('0px')
    expect(el().style.height).toBe('800px')

    act(() => vv.moveTo(141, 600))
    expect(el().style.top).toBe('141px')
    expect(el().style.height).toBe('600px')
    // And the masthead stops padding for an island it is now well below.
    expect(el().style.getPropertyValue('--rc-offset')).toBe('141px')
  })

  describe('the swipe', () => {
    const track = () => document.querySelector('.rc__track')!

    it('claims a horizontal drag, so the browser cannot pan instead', () => {
      /*
       * React registers `touchmove` passively at its root, so a `preventDefault`
       * inside an `onTouchMove` prop is a no-op — see the note above `follow()`
       * in `useSwipeToDismiss.ts`. The composer had exactly that, and the cost
       * was not a dead swipe: WebKit took the drag as a pan, and with the
       * keyboard up the only thing left to pan is the visual viewport, so the
       * whole overlay slid up under the Dynamic Island and left a gap of the
       * same size above the keyboard.
       */
      render()
      act(() => {
        track().dispatchEvent(touchEvent('touchstart', 300, 300))
      })
      let claimed = false
      act(() => {
        claimed = dispatchMove(260, 302)
      })
      expect(claimed).toBe(true)
    })

    it('leaves a vertical drag to the browser, so a long answer still scrolls', () => {
      render()
      act(() => {
        track().dispatchEvent(touchEvent('touchstart', 300, 300))
      })
      let claimed = true
      act(() => {
        claimed = dispatchMove(302, 380)
      })
      expect(claimed).toBe(false)
    })

    it('moves to the next movement when the drag carries far enough', () => {
      render()
      act(() => {
        track().dispatchEvent(touchEvent('touchstart', 300, 300))
        dispatchMove(200, 302)
        dispatchMove(120, 304)
        window.dispatchEvent(touchEvent('touchend', 120, 304))
      })
      expect(
        document.querySelector('.rc__pane:not([aria-hidden="true"]) .rc__label')?.textContent,
      ).toBe('Awareness')
    })

    it('snaps back when the drag is only a wobble', () => {
      render()
      act(() => {
        track().dispatchEvent(touchEvent('touchstart', 300, 300))
        dispatchMove(280, 302)
        window.dispatchEvent(touchEvent('touchend', 280, 302))
      })
      expect(
        document.querySelector('.rc__pane:not([aria-hidden="true"]) .rc__label')?.textContent,
      ).toBe('Gratitude')
    })
  })

  it('opens on the first movement still waiting', () => {
    doc = composeRitualMarkdown(examen.name, LABELS, ['Bread.', 'Distant.', '', ''])
    render()
    expect(
      document.querySelector('.rc__pane:not([aria-hidden="true"]) .rc__label')?.textContent,
    ).toBe('Examination')
  })
})
