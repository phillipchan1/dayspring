// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const go = vi.hoisted(() => vi.fn())
const update = vi.hoisted(() => vi.fn())
const DECK = vi.hoisted(() => ({
  seenId: 'r-test',
  land: 'pages' as const,
  landLabel: 'Open Pages',
  cards: [
    { kicker: 'ONE', title: 'First card', body: ['One.'] },
    { kicker: 'TWO', title: 'Second card', body: ['Two.'] },
    { kicker: 'THREE', title: 'Third card', body: ['Three.'] },
  ],
}))

vi.mock('@/context/AppNavigation', () => ({ useAppNavigation: () => ({ go }) }))
vi.mock('@/lib/settings', () => ({ settingsStore: { get: () => ({}), update } }))
vi.mock('./pickCards', () => ({ pickCards: () => DECK, latestDeck: () => DECK }))
vi.mock('./assets/open-your-bible.jpg', () => ({ default: 'still.jpg' }))
vi.mock('./assets/open-your-bible.gif', () => ({ default: 'steps.gif' }))

const { FirstLight } = await import('./FirstLight')

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  // Reduce Motion: closing is immediate, so nothing has to wait out the fade.
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
  go.mockClear()
  update.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(createElement(FirstLight)))
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const button = (name: string) =>
  [...host.querySelectorAll('button')].find((b) => b.textContent === name) as HTMLButtonElement

describe('What’s new', () => {
  it('lays the cards out as one paged track, with only the shown card reachable', () => {
    const cards = host.querySelectorAll<HTMLElement>('.firstlight__card')
    expect(cards).toHaveLength(3)
    expect(cards[0]!.hasAttribute('inert')).toBe(false)
    expect(cards[1]!.hasAttribute('inert')).toBe(true)
    // The dialog is named by the card that is showing.
    expect(host.querySelector('#firstlight-title')?.textContent).toBe('First card')
  })

  it('pages with Next and names the new card', () => {
    act(() => button('Next').click())
    const track = host.querySelector<HTMLElement>('.firstlight__track')!
    expect(track.style.transform).toContain('-100%')
    expect(host.querySelector('#firstlight-title')?.textContent).toBe('Second card')
  })

  it('gives every page dot a button of its own', () => {
    const dots = host.querySelectorAll('.firstlight__dot')
    expect(dots).toHaveLength(3)
    act(() => (dots[2] as HTMLButtonElement).click())
    expect(button('Open Pages')).toBeTruthy()
  })

  it('marks the deck seen and lands where it says, from Done', () => {
    act(() => (host.querySelectorAll('.firstlight__dot')[2] as HTMLButtonElement).click())
    act(() => button('Open Pages').click())
    expect(update).toHaveBeenCalledWith({ lastSeenRelease: 'r-test' })
    expect(go).toHaveBeenCalledWith({ surface: 'pages' })
    expect(host.querySelector('.firstlight')).toBeNull()
  })

  it('marks it seen from Not now without landing anywhere', () => {
    act(() => button('Not now').click())
    expect(update).toHaveBeenCalledWith({ lastSeenRelease: 'r-test' })
    expect(go).not.toHaveBeenCalled()
    expect(host.querySelector('.firstlight')).toBeNull()
  })
})
