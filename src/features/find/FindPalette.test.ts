// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// jsdom does no layout.
Element.prototype.scrollIntoView ??= () => {}

vi.mock('./findLocal', () => {
  const hit = (id: string) => ({
    entry: { id, created_at: '2026-10-01T09:00:00Z' },
    snippet: { before: 'the ', match: 'light', after: ' came' },
  })
  return {
    warmFindCorpus: () => Promise.resolve(),
    warmConcordance: () => Promise.resolve(),
    findEntries: (q: string) => (q ? [hit('a'), hit('b'), hit('c')] : []),
    findCount: (q: string) => (q ? 3 : 0),
    findBridge: () => null,
  }
})

import { FindPalette } from './FindPalette'

let root: Root
let host: HTMLDivElement

async function mount(initialQuery = '') {
  const onClose = vi.fn()
  const onOpenEntry = vi.fn()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => {
    root.render(createElement(FindPalette, { onClose, onOpenEntry, onAsk: vi.fn(), initialQuery }))
  })
  return { onClose, onOpenEntry }
}

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const input = () => document.querySelector('.find__input') as HTMLInputElement
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('.find__row'))
const selected = () => rows().findIndex((r) => r.dataset.sel === 'true')
const esc = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  })
const move = (el: Element, movement: number) =>
  act(() => {
    const e = new MouseEvent('mousemove', { bubbles: true })
    Object.defineProperty(e, 'movementX', { value: movement })
    Object.defineProperty(e, 'movementY', { value: 0 })
    el.dispatchEvent(e)
  })

describe('FindPalette', () => {
  it('is a search field, focused the moment it opens', async () => {
    await mount()
    const el = input()
    expect(el.type).toBe('search')
    expect(el.getAttribute('enterkeyhint')).toBe('search')
    expect(el.getAttribute('autocorrect')).toBe('off')
    expect(el.getAttribute('autocapitalize')).toBe('none')
    expect(document.activeElement).toBe(el)
  })

  it('the first Esc clears the query, the second closes', async () => {
    const { onClose } = await mount('light')
    esc()
    expect(input().value).toBe('')
    expect(onClose).not.toHaveBeenCalled()
    esc()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('offers a clear button while there is something to clear', async () => {
    await mount('light')
    const clear = document.querySelector('.find__clear') as HTMLButtonElement
    expect(clear).toBeTruthy()
    act(() => clear.click())
    expect(input().value).toBe('')
    expect(document.querySelector('.find__clear')).toBeNull()
  })

  it('a row under a resting pointer does not take the selection; a moving pointer does', async () => {
    await mount('light')
    expect(selected()).toBe(0)
    move(rows()[2]!, 0)
    expect(selected()).toBe(0)
    move(rows()[2]!, 3)
    expect(selected()).toBe(2)
  })
})
