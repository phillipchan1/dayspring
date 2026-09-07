// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_INLINE } from './formatSelection'
import { SelectionFormatBar, type FormatBarAnchor } from './SelectionFormatBar'

vi.mock('@/lib/platform', () => ({
  isIOSTauri: () => true,
}))

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
  useIsMobile: () => true,
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function anchor(view: EditorView): FormatBarAnchor {
  return {
    view,
    rect: new DOMRect(40, 120, 100, 18),
    state: { inline: { ...EMPTY_INLINE }, link: false, line: null },
  }
}

describe('SelectionFormatBar (touch)', () => {
  let root: Root
  let host: HTMLDivElement
  let view: EditorView

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    view = new EditorView({
      state: EditorState.create({
        doc: 'hello world',
        selection: { anchor: 0, head: 5 },
      }),
      parent: document.body,
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    view.destroy()
    host.remove()
  })

  it('uses words and a scroll track instead of icon-only chips', () => {
    act(() => {
      root.render(
        createElement(SelectionFormatBar, { anchor: anchor(view), onRequestLink: () => {} }),
      )
    })
    const bar = document.querySelector('.format-bar')
    expect(bar).toBeTruthy()
    expect(bar?.className).toContain('format-bar--touch')
    expect(bar?.querySelector('.format-bar__scroller')).toBeTruthy()

    const labels = [...document.querySelectorAll('.format-bar button')].map((b) =>
      (b.getAttribute('aria-label') ?? '').trim(),
    )
    expect(labels).toEqual(
      expect.arrayContaining(['Cut', 'Copy', 'Paste', 'Bold', 'Highlight', 'Link', 'More']),
    )
    expect(bar?.textContent).toMatch(/Cut/)
    expect(bar?.textContent).toMatch(/Copy/)
    expect(bar?.querySelector('.format-bar__glyph--bold')?.textContent).toBe('B')
    expect(bar?.querySelector('.format-bar__word')?.textContent).toBe('Cut')
  })

  it('opens the overflow page as labeled verbs, with Back pinned outside the scroller', () => {
    act(() => {
      root.render(
        createElement(SelectionFormatBar, { anchor: anchor(view), onRequestLink: () => {} }),
      )
    })
    const more = document.querySelector('[data-action="more"]') as HTMLButtonElement
    act(() => {
      more.click()
    })
    const bar = document.querySelector('.format-bar')
    expect(bar?.getAttribute('aria-label')).toBe('Edit')
    const labels = [...document.querySelectorAll('.format-bar button')].map((b) =>
      (b.getAttribute('aria-label') ?? '').trim(),
    )
    expect(labels).toEqual(
      expect.arrayContaining([
        'Back to formatting',
        'Look Up',
        'Translate',
        'Search Web',
        'Share',
        'Speak',
        'Replace',
        'Select All',
      ]),
    )
    const scroller = bar?.querySelector('.format-bar__scroller')
    expect(scroller?.querySelector('[aria-label="Look Up"]')).toBeTruthy()
    expect(scroller?.querySelector('[aria-label="Back to formatting"]')).toBeFalsy()
  })
})
