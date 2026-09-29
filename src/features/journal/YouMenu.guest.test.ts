// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GuestModeProvider } from '@/context/GuestMode'
import { YouMenu } from './YouMenu'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/lib/auth', () => ({
  signOut: vi.fn(),
}))

vi.mock('@/features/concordance/ConcordanceDrawer', () => ({
  ConcordanceDrawer: () => null,
}))

function menuProps(userEmail: string) {
  return {
    userEmail,
    onLifeMap: () => {},
    onRitualThreads: () => {},
    onOpenSettings: () => {},
    concordanceEnabled: false,
    labelsExpanded: true,
  }
}

function openYouMenu(host: HTMLElement) {
  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="You"]')
  if (!trigger) throw new Error('no You trigger')
  act(() => {
    trigger.click()
  })
}

describe('guest account menu', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    document.body.innerHTML = ''
  })

  it('has no Sign out and no blank email — Sign in instead', () => {
    act(() => {
      root.render(
        createElement(GuestModeProvider, {
          requestSignIn: () => {},
          children: createElement(YouMenu, menuProps('')),
        }),
      )
    })
    openYouMenu(host)

    const menu = document.querySelector('[role="menu"]')
    expect(menu).toBeTruthy()
    expect(menu?.textContent).not.toMatch(/Sign out/)
    expect(menu?.querySelector('.you__who')).toBeNull()
    expect(menu?.textContent).toMatch(/Sign in/)
  })

  it('signed-in menu still shows the email and Sign out', () => {
    act(() => {
      root.render(createElement(YouMenu, menuProps('you@example.com')))
    })
    openYouMenu(host)

    const menu = document.querySelector('[role="menu"]')
    expect(menu?.textContent).toMatch(/you@example.com/)
    expect(menu?.textContent).toMatch(/Sign out/)
    expect(menu?.textContent).not.toMatch(/Sign in/)
  })
})
