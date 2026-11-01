// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: null }))

import {
  attachmentImageExtension,
  primeAttachmentPreview,
  sizedPhotoWidth,
  type ImageMenuPoint,
} from './attachmentImageExtension'

const HASH = 'a'.repeat(64)
const KEY = `${HASH}.jpg`
const DOC = `Before\n\n![](attachment:${KEY})\n\nAfter`

function pointer(type: string, pointerType: string, x = 10, y = 10): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

// jsdom does no layout: no point resolves to a position, so the photo is found
// by its own key — the same fallback a press on a tight-packed photo takes.
vi.spyOn(EditorView.prototype, 'posAtCoords').mockReturnValue(null)

const mounted: EditorView[] = []
afterEach(() => {
  for (const view of mounted.splice(0)) view.destroy()
  document.body.replaceChildren()
  vi.useRealTimers()
})

function mount(meta: { width?: number; height?: number } | null = { width: 4000, height: 3000 }) {
  primeAttachmentPreview(KEY, 'blob:photo', meta)
  const presses: ImageMenuPoint[] = []
  const view = new EditorView({
    state: EditorState.create({
      doc: DOC,
      extensions: attachmentImageExtension((_target, point) => presses.push(point)),
    }),
    parent: document.body,
  })
  mounted.push(view)
  const photo = view.dom.querySelector('.cm-attachment--interactive') as HTMLElement
  return { view, presses, photo }
}

describe('a photo in the editor', () => {
  it('carries no tooltip of instructions', () => {
    const { photo } = mount()
    expect(photo.hasAttribute('title')).toBe(false)
  })

  it('reserves its final shape from the stored size, before it decodes', () => {
    const { photo } = mount({ width: 4000, height: 3000 })
    const media = photo.querySelector('.cm-attachment__media') as HTMLElement
    expect(photo.classList.contains('cm-attachment--sized')).toBe(true)
    expect(media.style.aspectRatio.replace(/\s/g, '')).toBe('4000/3000')
  })

  it('settles at the width its size gives it (jsdom cannot parse min(), so the rule itself)', () => {
    expect(sizedPhotoWidth('f', 4000, 3000)).toBe('100%')
    expect(sizedPhotoWidth('m', 3000, 4000)).toBe('min(100%, calc(min(56vh, 480px) * 0.75000))')
    expect(sizedPhotoWidth('s', 4000, 3000)).toBe('min(100%, calc(min(34vh, 260px) * 1.33333))')
  })

  it('without stored dimensions falls back to the old box', () => {
    const { photo } = mount(null)
    expect(photo.classList.contains('cm-attachment--sized')).toBe(false)
  })

  it('a click looks', () => {
    const { photo, presses } = mount()
    photo.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
    expect(presses).toEqual([expect.objectContaining({ intent: 'look' })])
  })

  it('a right-click asks for options', () => {
    const { photo, presses } = mount()
    photo.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }))
    expect(presses).toHaveLength(1)
    expect(presses[0]!.intent).toBeUndefined()
  })

  it('a tap looks, on the release', () => {
    const { photo, presses } = mount()
    photo.dispatchEvent(pointer('pointerdown', 'touch'))
    expect(presses).toEqual([])
    photo.dispatchEvent(pointer('pointerup', 'touch'))
    expect(presses).toEqual([expect.objectContaining({ intent: 'look' })])
  })

  it('a long-press asks for options, and its release looks at nothing', () => {
    vi.useFakeTimers()
    const { photo, presses } = mount()
    photo.dispatchEvent(pointer('pointerdown', 'touch'))
    vi.advanceTimersByTime(600)
    expect(presses).toHaveLength(1)
    expect(presses[0]!.intent).toBeUndefined()
    photo.dispatchEvent(pointer('pointerup', 'touch'))
    expect(presses).toHaveLength(1)
  })

  it('a finger that moves is a scroll, not a press', () => {
    vi.useFakeTimers()
    const { photo, presses } = mount()
    photo.dispatchEvent(pointer('pointerdown', 'touch', 10, 10))
    photo.dispatchEvent(pointer('pointermove', 'touch', 10, 80))
    vi.advanceTimersByTime(600)
    photo.dispatchEvent(pointer('pointerup', 'touch', 10, 80))
    expect(presses).toEqual([])
  })
})
