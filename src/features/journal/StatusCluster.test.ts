// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GuestModeProvider } from '@/context/GuestMode'
import { StatusCluster } from './StatusCluster'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SAVED_AT = Date.now() - 120_000

function renderCluster(root: Root, guest: boolean) {
  const cluster = createElement(StatusCluster, {
    status: 'saved' as const,
    lastSavedAt: SAVED_AT,
    saveError: null,
    onSync: () => {},
  })
  act(() => {
    root.render(guest ? createElement(GuestModeProvider, { requestSignIn: () => {}, children: cluster }) : cluster)
  })
}

describe('status cluster tooltip', () => {
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
  })

  it('for guests matches Saved on this device and never offers sync', () => {
    renderCluster(root, true)
    const el = host.querySelector('.status-cluster')
    expect(el?.tagName).toBe('SPAN')
    expect(el?.getAttribute('title')).toMatch(/on this device/i)
    expect(el?.getAttribute('title')).not.toMatch(/click to sync now/i)
    expect(el?.getAttribute('aria-label')).not.toMatch(/sync now/i)
    expect(el?.textContent).toMatch(/Saved on this device/)
  })

  it('for a signed-in writer still says click to sync now', () => {
    renderCluster(root, false)
    const el = host.querySelector('.status-cluster')
    expect(el?.tagName).toBe('BUTTON')
    expect(el?.getAttribute('title')).toMatch(/click to sync now/i)
    expect(el?.getAttribute('aria-label')).toMatch(/sync now/i)
  })
})
