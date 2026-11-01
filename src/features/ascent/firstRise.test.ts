// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { resetFirstRise, useFirstRise } from './firstRise'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Room() {
  const first = useFirstRise()
  return createElement('div', { 'data-settled': first ? undefined : 'true' })
}

/** Open the Ascent, read whether it rose, and leave it. */
function visit(): boolean {
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(createElement(Room)))
  const rose = host.firstElementChild?.getAttribute('data-settled') !== 'true'
  act(() => root.unmount())
  return rose
}

afterEach(() => resetFirstRise())

describe('useFirstRise', () => {
  it('rises on the first visit of the session only', () => {
    expect(visit()).toBe(true)
    expect(visit()).toBe(false)
    expect(visit()).toBe(false)
  })

  it('keeps its answer for the life of a visit', () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => root.render(createElement(Room)))
    act(() => root.render(createElement(Room)))
    expect(host.firstElementChild?.getAttribute('data-settled')).toBeNull()
    act(() => root.unmount())
  })

  it('rises again in a new session', () => {
    visit()
    resetFirstRise()
    expect(visit()).toBe(true)
  })
})
