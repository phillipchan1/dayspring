// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RitualComposer } from './RitualComposer'
import { composeRitualMarkdown } from './ritualDocument'
import { PRACTICES } from './practicesData'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/*
 * Embla expects a browser jsdom does not fully provide. These three stubs are
 * the whole cost of the dependency at test time: it reads media queries on
 * init, watches slides with an IntersectionObserver, and re-measures on a
 * ResizeObserver. None of them do anything here — jsdom gives every element a
 * zero size, so Embla initialises and then has nothing to scroll, which is
 * exactly why the dragging itself is verified in a real browser instead.
 */
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: NoopObserver,
})
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: NoopObserver,
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})

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
  })

  describe('moving between movements', () => {
    /*
     * Dragging itself belongs to Embla now, and cannot be exercised here: it
     * measures a container that jsdom gives no width. What these pin is the part
     * that is ours — that the buttons move the surface, and that the index the
     * rest of the component reads stays in step whether or not Embla has
     * managed to measure anything.
     */
    const foot = () => document.querySelector<HTMLElement>('.rc__foot .rc__next')!
    const label = () =>
      document.querySelector('.rc__pane:not([aria-hidden="true"]) .rc__label')?.textContent

    it('advances on Next', () => {
      render()
      expect(label()).toBe('Gratitude')
      act(() => foot().click())
      expect(label()).toBe('Awareness')
    })

    it('goes back', () => {
      render()
      act(() => foot().click())
      act(() => document.querySelector<HTMLElement>('.rc__back')!.click())
      expect(label()).toBe('Gratitude')
    })

    it('stops at the close rather than running off the end', () => {
      render()
      for (let n = 0; n < 8; n++) act(() => foot()?.click())
      expect(document.querySelector('.rc__close')).toBeTruthy()
      // The footer's next button is gone at the close; nothing to run past.
      expect(document.querySelector('.rc__foot .rc__next')).toBeNull()
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
