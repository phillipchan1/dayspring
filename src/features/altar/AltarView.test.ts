// @vitest-environment jsdom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllCache, setCache } from '@/lib/asyncCache'
import type { AltarSource } from './data'

const pending = vi.hoisted(() => {
  let resolve: (value: AltarSource) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const loadAltarSource = vi.fn(
    () =>
      new Promise<AltarSource>((res, rej) => {
        resolve = res
        reject = rej
      }),
  )
  return {
    loadAltarSource,
    settle: () => resolve,
    fail: () => reject,
  }
})

vi.mock('./data', async () => {
  const actual = await vi.importActual<typeof import('./data')>('./data')
  return { ...actual, loadAltarSource: pending.loadAltarSource }
})

const { AltarView } = await import('./AltarView')

const EMPTY: AltarSource = { rawThreads: [], rawMembers: [], meta: new Map() }

const DAD: AltarSource = {
  rawThreads: [
    {
      id: 't-dad',
      lens: 'Dad',
      domain: null,
      rope_id: null,
      label: 'Dad',
      label_ai: null,
      label_user: null,
      private: false,
      dismissed: false,
    },
  ],
  rawMembers: [
    { thread_id: 't-dad', entry_id: 'a', created_at: '2020-01-01T00:00:00.000Z', body: 'alpha line for dad' },
    { thread_id: 't-dad', entry_id: 'b', created_at: '2022-06-01T00:00:00.000Z', body: 'beta line for dad' },
    { thread_id: 't-dad', entry_id: 'c', created_at: '2024-03-01T00:00:00.000Z', body: 'gamma line for dad' },
  ],
  meta: new Map([
    ['t-dad', { id: 't-dad', label: 'Dad', label_ai: null, label_user: null, type: 'prayer', subject_kind: 'person' }],
  ]),
}

let root: Root | null = null
let host: HTMLDivElement | null = null

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })),
  })
})

beforeEach(() => {
  clearAllCache()
  localStorage.clear()
  pending.loadAltarSource.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

function text(): string {
  return host?.textContent ?? ''
}

describe('AltarView first paint', () => {
  it('shows the altar while the field is still loading, not the empty copy', async () => {
    await act(async () => {
      root!.render(createElement(AltarView, { onOpenEntry: () => {} }))
    })
    expect(text()).toContain('Altar')
    expect(text()).toContain('Preparing your altar…')
    expect(text()).not.toContain('Nothing has gathered')

    await act(async () => {
      pending.settle()(EMPTY)
    })
    expect(text()).toContain('Nothing has gathered here yet')
    expect(text()).not.toContain('Preparing your altar')
  })

  it('shows the failure on a cold load, and keeps a field already on screen', async () => {
    await act(async () => {
      root!.render(createElement(AltarView, { onOpenEntry: () => {} }))
    })
    await act(async () => {
      pending.fail()(new Error('Could not load'))
    })
    expect(text()).toContain('Could not load')
    expect(text()).toContain('Altar')
    expect(text()).not.toContain('Nothing has gathered')

    act(() => root?.unmount())
    // The carried year would hide these older lines. "All" is the field they belong to.
    localStorage.setItem('dayspring:remember-period', 'all')
    setCache('altar:source:v1', DAD)
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => {
      root!.render(createElement(AltarView, { onOpenEntry: () => {} }))
    })
    expect(text()).toContain('Dad')
    expect(text()).toContain('beta line for dad')
    await act(async () => {
      pending.fail()(new Error('Could not load'))
    })
    expect(text()).toContain('Dad')
    expect(text()).not.toContain('Could not load')
  })
})
