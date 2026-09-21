// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RitualComposer } from './RitualComposer'
import { composeRitualMarkdown } from './ritualDocument'
import { RitualHeaderWidget } from './ritualWidgets'
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

const tracked = vi.hoisted(() => [] as { event: string; props?: unknown }[])
vi.mock('@/lib/analytics', () => ({
  track: (event: string, props?: unknown) => tracked.push({ event, props }),
}))

// The composer is under test, not the viewport hooks. A phone unless a test
// sits down at a desk.
const viewport = vi.hoisted(() => ({ desk: false }))
vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => !viewport.desk,
  useTouchPrimary: () => !viewport.desk,
  useMediaQuery: () => viewport.desk,
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
    tracked.length = 0
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

  it('does not ask the editor to take the caret when writing back', () => {
    const focusFlags: Array<boolean | undefined> = []
    act(() => {
      root.render(
        createElement(RitualComposer, {
          blockIndex: 0,
          getDoc: () => doc,
          replaceRange: (from: number, to: number, text: string, opts?: { focus?: boolean }) => {
            focusFlags.push(opts?.focus)
            doc = doc.slice(0, from) + text + doc.slice(to)
          },
          onClose,
          onAbout: () => {},
        }),
      )
    })
    act(() => type(liveTextarea(), 'The long walk after dinner.'))
    act(() => vi.advanceTimersByTime(500))
    expect(focusFlags.length).toBeGreaterThan(0)
    expect(focusFlags.every((flag) => flag === false)).toBe(true)
  })

  it('removes the ritual from the entry when asked', () => {
    doc = `Morning.\n\n${composeRitualMarkdown(examen.name, LABELS, ['Bread.', '', '', ''])}\n\nEvening.`
    render()
    act(() => {
      document.querySelector<HTMLButtonElement>('.rc__remove')!.click()
    })
    expect(onClose).toHaveBeenCalled()
    expect(doc).toBe('Morning.\n\nEvening.')
    expect(doc).not.toContain('ritual:name')
  })

  it('takes an untouched ritual with it on the way out', () => {
    render()
    act(() => {
      document.querySelector<HTMLButtonElement>('.rc__x')!.click()
    })
    expect(onClose).toHaveBeenCalled()
    expect(doc).toBe('')
  })

  it('keeps a written ritual when leaving', () => {
    doc = composeRitualMarkdown(examen.name, LABELS, ['Bread.', '', '', ''])
    render()
    act(() => {
      document.querySelector<HTMLButtonElement>('.rc__x')!.click()
    })
    expect(onClose).toHaveBeenCalled()
    expect(doc).toContain('Bread.')
    expect(doc).toContain('ritual:name')
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

  it('offers remove on the in-entry masthead, finished or not', () => {
    const open = new RitualHeaderWidget('The Daily Examen', true, false).toDOM()
    const done = new RitualHeaderWidget('The Daily Examen', false, false).toDOM()
    expect(open.querySelector('.cm-practice-action--remove')?.textContent).toBe('remove')
    expect(done.querySelector('.cm-practice-action--remove')?.textContent).toBe('remove')
  })

  it('always offers a way back into the composer, finished or not', () => {
    const open = new RitualHeaderWidget('The Daily Examen', true, false).toDOM()
    const done = new RitualHeaderWidget('The Daily Examen', false, false).toDOM()
    expect(open.querySelector('.cm-practice-action--continue')?.textContent).toBe('continue')
    expect(done.querySelector('.cm-practice-action--continue')?.textContent).toBe('open')
  })

  it('reopens a finished ritual at its beginning, not on the close', () => {
    doc = composeRitualMarkdown(examen.name, LABELS, ['Bread.', 'Distant.', 'Short.', 'Patience.'])
    render()
    expect(document.querySelector('.rc__close')?.closest('[aria-hidden="true"]')).toBeTruthy()
    expect(
      document.querySelector('.rc__pane:not([aria-hidden="true"]) .rc__label')?.textContent,
    ).toBe('Gratitude')
  })

  /**
   * The composer has two exits and `leave` delegates to `removeBlock` when
   * nothing was written, so the count is easy to lose entirely or to fire twice
   * on exactly the abandonment case it exists to measure.
   */
  describe('ritual_finished', () => {
    const finished = () => tracked.filter((t) => t.event === 'ritual_finished')

    it('reports how much was written when the writer leaves', () => {
      doc = composeRitualMarkdown(examen.name, LABELS, ['Bread.', 'Distant.', '', ''])
      render()
      act(() => {
        document.querySelector<HTMLButtonElement>('.rc__x')!.click()
      })
      expect(finished()).toHaveLength(1)
      expect(finished()[0]!.props).toEqual({ movements: 4, answered: 2 })
    })

    it('reports once, not twice, when leaving an untouched ritual removes it', () => {
      render()
      act(() => {
        document.querySelector<HTMLButtonElement>('.rc__x')!.click()
      })
      expect(finished()).toHaveLength(1)
      expect(finished()[0]!.props).toEqual({ movements: 4, answered: 0 })
    })

    it('reports when the ritual is deliberately removed', () => {
      // The strongest abandonment signal there is, and it bypasses `leave`.
      doc = composeRitualMarkdown(examen.name, LABELS, ['Bread.', '', '', ''])
      render()
      act(() => {
        document.querySelector<HTMLButtonElement>('.rc__remove')!.click()
      })
      expect(finished()).toHaveLength(1)
      expect(finished()[0]!.props).toEqual({ movements: 4, answered: 1 })
    })
  })

  it('opens on the first movement still waiting', () => {
    doc = composeRitualMarkdown(examen.name, LABELS, ['Bread.', 'Distant.', '', ''])
    render()
    expect(
      document.querySelector('.rc__pane:not([aria-hidden="true"]) .rc__label')?.textContent,
    ).toBe('Examination')
  })

  describe('at a desk', () => {
    beforeEach(() => {
      viewport.desk = true
    })
    afterEach(() => {
      viewport.desk = false
    })

    const page = () => document.querySelector('.rc__page .rc__label')?.textContent
    const path = () =>
      [...document.querySelectorAll<HTMLElement>('.rc__path li')].map((li) => li.dataset.state)
    const write = () => document.querySelector<HTMLTextAreaElement>('.rc__page .rc__write')!

    it('lays the ritual out as a rail and a page, not a filmstrip', () => {
      render()
      expect(document.querySelector('.rc--desk')).toBeTruthy()
      expect(document.querySelector('.rc__viewport')).toBeNull()
      expect(page()).toBe('Gratitude')
    })

    it('names the movements ahead but never asks their questions', () => {
      render()
      expect(path()).toEqual(['on', 'ahead', 'ahead', 'ahead'])
      const text = document.querySelector('.ritual-composer')!.textContent!
      expect(text).toContain('Awareness')
      expect(text).not.toContain(examen.prompts[1]!.question)
    })

    it('shows what was said to a movement behind you, and lets you go back to it', () => {
      render()
      act(() => type(write(), 'Bread.'))
      act(() => document.querySelector<HTMLElement>('.rc__foot .rc__next')!.click())
      expect(page()).toBe('Awareness')
      expect(path()).toEqual(['done', 'on', 'ahead', 'ahead'])
      expect(document.querySelector('.rc__gist')?.textContent).toBe('Bread.')
      act(() => document.querySelector<HTMLElement>('.rc__path li button')!.click())
      expect(page()).toBe('Gratitude')
      // Having walked there, Awareness stays open to come back to.
      expect(path()).toEqual(['on', 'open', 'ahead', 'ahead'])
    })

    it('moves on with ⌘↵ and leaves plain Enter to the paragraph', () => {
      render()
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      })
      expect(page()).toBe('Gratitude')
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }))
      })
      expect(page()).toBe('Awareness')
    })

    it('says where leaving goes, and keeps what was written', () => {
      render()
      act(() => type(write(), 'Bread.'))
      const home = document.querySelector<HTMLButtonElement>('.rc__home')!
      expect(home.textContent).toContain('Back to your entry')
      act(() => home.click())
      expect(onClose).toHaveBeenCalled()
      expect(doc).toContain('Bread.')
    })

    it('resumes on the movement still waiting, with what is behind it open', () => {
      doc = composeRitualMarkdown(examen.name, LABELS, ['Bread.', 'Distant.', '', ''])
      render()
      expect(page()).toBe('Examination')
      expect(path()).toEqual(['done', 'done', 'on', 'ahead'])
    })
  })

  describe('as a ritual entry — one entry, one ritual', () => {
    beforeEach(() => {
      viewport.desk = true
    })
    afterEach(() => {
      viewport.desk = false
    })

    const onDelete = vi.fn<() => void>()
    const onFreeWrite = vi.fn<() => void>()
    const renderEntry = (seed = true) => {
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
            entry: {
              ...(seed ? { seed: { name: examen.name, labels: LABELS } } : {}),
              backTo: 'your journal',
              backShort: 'Journal',
              onDelete,
              onFreeWrite,
            },
          }),
        )
      })
    }
    const write = () => document.querySelector<HTMLTextAreaElement>('.rc__page .rc__write')!
    const page = () => document.querySelector('.rc__page .rc__label')?.textContent
    const next = () => act(() => document.querySelector<HTMLElement>('.rc__foot .rc__next')!.click())

    it('keeps nothing until something is written', () => {
      doc = ''
      renderEntry()
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(doc).toBe('')
      expect(document.querySelector('.rc__saved')?.textContent).toBe('Nothing is kept until you write.')
      act(() => type(write(), 'Bread.'))
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(doc).toBe(composeRitualMarkdown(examen.name, LABELS, ['Bread.', '', '', '']))
      expect(document.querySelector('.rc__saved')?.textContent).toBe('Saved as you write.')
    })

    it('ends on After, written below the ritual as ordinary prose', () => {
      doc = ''
      renderEntry()
      act(() => type(write(), 'Bread.'))
      for (let n = 0; n < 4; n++) next()
      expect(page()).toBe('After')
      expect(document.querySelector('.rc__page .rc__q')).toBeNull()
      act(() => type(write(), 'A quiet evening.'))
      act(() => document.querySelector<HTMLElement>('.rc__home')!.click())
      expect(doc).toBe(
        `${composeRitualMarkdown(examen.name, LABELS, ['Bread.', '', '', ''])}\n\nA quiet evening.`,
      )
      expect(onClose).toHaveBeenCalled()
    })

    it('says where leaving goes', () => {
      doc = ''
      renderEntry()
      expect(document.querySelector('.rc__home')?.textContent).toContain('Back to your journal')
    })

    it('reopens an existing ritual entry with its After', () => {
      doc = `${composeRitualMarkdown(examen.name, LABELS, ['Bread.', 'Far.', 'Short.', 'Patience.'])}\n\nLater.`
      renderEntry(false)
      expect(page()).toBe('Gratitude')
      for (let n = 0; n < 4; n++) next()
      expect(write().value).toBe('Later.')
    })

    it('leaves no page behind when nothing was written', () => {
      doc = ''
      renderEntry()
      act(() => document.querySelector<HTMLElement>('.rc__home')!.click())
      expect(doc).toBe('')
      expect(onDelete).not.toHaveBeenCalled()
    })

    it('free write keeps every word and drops the questions', () => {
      doc = `${composeRitualMarkdown(examen.name, LABELS, ['Bread.', '', 'Short.', ''])}\n\nLater.`
      renderEntry(false)
      const tool = [...document.querySelectorAll<HTMLButtonElement>('.rc__rail-tools button')].find(
        (b) => b.textContent === 'Free write',
      )!
      act(() => tool.click())
      expect(tool.textContent).toBe('Make it an ordinary page?')
      act(() => tool.click())
      expect(doc).toBe('Bread.\n\nShort.\n\nLater.')
      expect(onFreeWrite).toHaveBeenCalled()
    })

    it('deletes the page, after asking', () => {
      doc = composeRitualMarkdown(examen.name, LABELS, ['Bread.', '', '', ''])
      renderEntry(false)
      const tool = [...document.querySelectorAll<HTMLButtonElement>('.rc__rail-tools button')].find(
        (b) => b.textContent === 'Delete page',
      )!
      act(() => tool.click())
      expect(onDelete).not.toHaveBeenCalled()
      act(() => tool.click())
      expect(onDelete).toHaveBeenCalled()
    })
  })
})
