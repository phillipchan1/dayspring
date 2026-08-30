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
vi.mock('@/hooks/useViewportHeight', () => ({ useViewportHeight: () => null }))
vi.mock('@/hooks/useKeyboard', () => ({ useKeyboardOpen: () => false, useKeyboardInset: () => 0 }))

const examen = PRACTICES.find((p) => p.name === 'The Daily Examen')!
const LABELS = examen.prompts.map((p) => p.label)

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

  it('opens on the first movement still waiting', () => {
    doc = composeRitualMarkdown(examen.name, LABELS, ['Bread.', 'Distant.', '', ''])
    render()
    expect(
      document.querySelector('.rc__pane:not([aria-hidden="true"]) .rc__label')?.textContent,
    ).toBe('Examination')
  })
})
