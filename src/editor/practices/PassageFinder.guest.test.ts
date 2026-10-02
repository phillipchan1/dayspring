// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GuestModeProvider } from '@/context/GuestMode'
import { PassageFinder } from './PassageFinder'
import { PRACTICES } from './practicesData'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const loadChapter = vi.hoisted(() =>
  vi.fn(async () => {
    throw new Error('guest must not fetch a chapter')
  }),
)

vi.mock('./passageSource', () => ({
  peekChapter: () => null,
  loadChapter,
  loadLight: async () => ({ books: new Map(), chapters: new Map(), max: 0, returning: [] }),
  searchTopic: async () => [],
}))

const lectio = PRACTICES.find((p) => p.name === 'Lectio Divina')!

function clickNamed(host: HTMLElement, selector: string, name: string) {
  const el = [...host.querySelectorAll(selector)].find((n) => (n.textContent ?? '').trim() === name)
  if (!el) throw new Error(`no ${selector} named ${name}`)
  act(() => {
    ;(el as HTMLElement).click()
  })
}

describe('guest passage picker', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    loadChapter.mockClear()
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    document.body.innerHTML = ''
  })

  it('begins on a chapter from your own Bible, without fetching or erroring', async () => {
    const onChoose = vi.fn()
    await act(async () => {
      root.render(
        createElement(GuestModeProvider, {
          requestSignIn: () => {},
          children: createElement(PassageFinder, {
            practice: lectio,
            onChoose,
            onBack: () => {},
            backLabel: 'the library',
          }),
        }),
      )
    })

    // Said up front: signed out is why there is no passage to draw from.
    expect(host.querySelector('.pf__guest')?.textContent).toMatch(/not signed in/)
    expect(host.textContent).not.toMatch(/own Bible/i)

    clickNamed(host, '.pf__book', 'John')
    clickNamed(host, '.pf__ch', '15')

    expect(loadChapter).not.toHaveBeenCalled()
    expect(host.textContent).not.toMatch(/wouldn.t open just now/i)
    expect(onChoose).toHaveBeenCalledWith({ book: 'John', chapter: 15, from: null, to: null }, null)
  })
})
