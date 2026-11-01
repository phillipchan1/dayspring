// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/lib/photoSet', () => ({ cleanCaption: (s: string) => s.trim() }))

const { PhotoViewer } = await import('./PhotoViewer')

const PHOTOS = [
  { key: 'a.jpg', url: null, caption: 'First' },
  { key: 'b.jpg', url: null, caption: 'Second' },
  { key: 'c.jpg', url: null, caption: 'Third' },
]

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  // Reduce Motion: closing is immediate, so the tests need not wait it out.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function mount(index: number) {
  const onIndex = vi.fn()
  const onClose = vi.fn()
  act(() => {
    root.render(createElement(PhotoViewer, { photos: PHOTOS, index, onIndex, onClose }))
  })
  return { onIndex, onClose }
}

function key(k: string, init: KeyboardEventInit = {}) {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })
  act(() => {
    window.dispatchEvent(ev)
  })
  return ev
}

describe('PhotoViewer', () => {
  // As in Photos: the last photo has nothing after it.
  it('does not wrap from the last photo to the first', () => {
    const { onIndex } = mount(2)
    key('ArrowRight')
    expect(onIndex).not.toHaveBeenCalled()
    key('ArrowLeft')
    expect(onIndex).toHaveBeenCalledWith(1)
  })

  it('does not wrap from the first photo to the last', () => {
    const { onIndex } = mount(0)
    key('ArrowLeft')
    expect(onIndex).not.toHaveBeenCalled()
  })

  it('disables the button that would wrap', () => {
    mount(0)
    expect(host.ownerDocument.querySelector<HTMLButtonElement>('[aria-label="Previous photo"]')?.disabled).toBe(true)
    expect(host.ownerDocument.querySelector<HTMLButtonElement>('[aria-label="Next photo"]')?.disabled).toBe(false)
  })

  // Quick Look: Space opens a preview, and Space puts it away.
  it('closes on Space, but not on a held key’s repeats', () => {
    const { onClose } = mount(1)
    key(' ', { repeat: true })
    expect(onClose).not.toHaveBeenCalled()
    const ev = key(' ')
    expect(ev.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Esc', () => {
    const { onClose } = mount(1)
    key('Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders only the photo and its neighbours', () => {
    mount(0)
    expect(host.ownerDocument.querySelectorAll('.photo-viewer__frame')).toHaveLength(2)
  })
})
