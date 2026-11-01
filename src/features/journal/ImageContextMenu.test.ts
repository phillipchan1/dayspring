// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AttachmentEditTarget } from '@/editor/attachmentInsert'
import type { ImageMenuPoint } from '@/editor/attachmentImageExtension'
import { __resetMenuInputForTests } from '@/hooks/useMenuKeyboard'
import { ImageContextMenu } from './ImageContextMenu'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const target = { hash: 'a'.repeat(64), ext: 'jpg', alt: '', size: 'm', from: 0, to: 10 } as unknown as AttachmentEditTarget

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  __resetMenuInputForTests('pointer')
})

function render(point: ImageMenuPoint | null, handlers: { onLook?: () => void; onClose?: () => void } = {}) {
  const noop = () => {}
  act(() => {
    root.render(
      createElement(ImageContextMenu, {
        // Built inline on every render, as JournalScreen does.
        phase: point ? { kind: 'menu', target, point } : { kind: 'closed' },
        onClose: handlers.onClose ?? noop,
        onLook: handlers.onLook ?? noop,
        onEditCaption: noop,
        onReplaceFile: noop,
        onSetSize: noop,
        onArrange: noop,
        onAddPhotos: noop,
        onArrangeSet: noop,
        onRemove: noop,
      }),
    )
  })
}

describe('ImageContextMenu', () => {
  it('a press that asks to look opens the viewer and shows no menu', () => {
    const onLook = vi.fn()
    const onClose = vi.fn()
    const point: ImageMenuPoint = { x: 10, y: 10, intent: 'look' }
    render(point, { onLook, onClose })
    render(point, { onLook, onClose }) // a parent re-render
    expect(onLook).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('an open menu keeps its highlight through a parent re-render', () => {
    __resetMenuInputForTests('keyboard')
    const point: ImageMenuPoint = { x: 10, y: 10 }
    render(point)
    const lit = () => document.querySelector('[data-highlighted="true"]')?.textContent
    expect(lit()).toBe('Look')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    const after = lit()
    expect(after).not.toBe('Look')
    render(point) // same press, new phase object
    expect(lit()).toBe(after)
  })
})
