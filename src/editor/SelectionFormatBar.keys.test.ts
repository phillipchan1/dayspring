// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_INLINE } from './formatSelection'
import { SelectionFormatBar, type FormatBarAnchor, type FormatBarKeyHandler } from './SelectionFormatBar'

vi.mock('@/lib/platform', () => ({ isIOSTauri: () => false }))
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false, useIsMobile: () => false }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true })

describe('SelectionFormatBar keys (desktop)', () => {
  let root: Root
  let host: HTMLDivElement
  let view: EditorView
  const handler: { current: FormatBarKeyHandler | null } = { current: null }

  const anchor = (caret: boolean): FormatBarAnchor => ({
    view,
    rect: new DOMRect(40, 120, 100, 18),
    state: { inline: { ...EMPTY_INLINE }, link: false, line: null },
    ...(caret ? { caret: true } : null),
  })

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    view = new EditorView({
      state: EditorState.create({ doc: 'hello world', selection: { anchor: 6 } }),
      parent: document.body,
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    view.destroy()
    host.remove()
    vi.unstubAllGlobals()
  })

  const lit = () => document.querySelector('.format-bar [data-highlighted="true"]')?.getAttribute('aria-label')

  it('at the caret, lights the first button and roves with ←/→', () => {
    act(() => {
      root.render(
        createElement(SelectionFormatBar, { anchor: anchor(true), onRequestLink: () => {}, keyHandlerRef: handler }),
      )
    })
    expect(lit()).toBe('Bold')
    let used = false
    act(() => {
      used = handler.current!(key('ArrowRight'))
    })
    expect(used).toBe(true)
    expect(lit()).toBe('Italic')
    act(() => {
      handler.current!(key('ArrowLeft'))
      handler.current!(key('ArrowLeft'))
    })
    // wraps to the last button
    expect(lit()).not.toBe('Bold')
    expect(lit()).not.toBe('Italic')
  })

  it('Return presses the lit button', () => {
    act(() => {
      root.render(
        createElement(SelectionFormatBar, { anchor: anchor(true), onRequestLink: () => {}, keyHandlerRef: handler }),
      )
    })
    act(() => {
      handler.current!(key('Enter'))
    })
    // Bold at a caret inside a word wraps the word.
    expect(view.state.doc.toString()).toBe('hello **world**')
  })

  it('a selection bar leaves the arrows to the text, but Esc dismisses it', () => {
    const onDismiss = vi.fn()
    act(() => {
      root.render(
        createElement(SelectionFormatBar, {
          anchor: anchor(false),
          onRequestLink: () => {},
          onDismiss,
          keyHandlerRef: handler,
        }),
      )
    })
    expect(lit()).toBeUndefined()
    expect(handler.current!(key('ArrowRight'))).toBe(false)
    expect(handler.current!(key('Enter'))).toBe(false)
    expect(handler.current!(key('Escape'))).toBe(true)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('fades out rather than vanishing', () => {
    act(() => {
      root.render(createElement(SelectionFormatBar, { anchor: anchor(false), onRequestLink: () => {} }))
    })
    act(() => {
      root.render(createElement(SelectionFormatBar, { anchor: null, onRequestLink: () => {} }))
    })
    const bar = document.querySelector('.format-bar')
    expect(bar?.getAttribute('data-leaving')).toBe('true')
  })
})
