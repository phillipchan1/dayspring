// @vitest-environment jsdom

import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AppNavigationProvider,
  useAppNavigation,
} from './AppNavigation'
import {
  DEFAULT_APP_HISTORY,
  mergeAppHistory,
} from '@/lib/appHistory'

type Navigation = ReturnType<typeof useAppNavigation>

let root: Root
let host: HTMLDivElement
let navigation: Navigation

function Probe() {
  const next = useAppNavigation()
  useEffect(() => {
    navigation = next
  }, [next])
  return createElement('output', {
    'data-entry-id': next.state.entryId ?? '',
  })
}

describe('AppNavigationProvider history', () => {
  beforeEach(() => {
    vi.useRealTimers()
    history.replaceState(DEFAULT_APP_HISTORY, '', '/')
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => {
      root.render(
        createElement(
          AppNavigationProvider,
          null,
          createElement(Probe),
        ),
      )
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('flushes the active entry before committing a history pop', async () => {
    act(() => navigation.go({ entryId: 'first' }))
    const first = mergeAppHistory(DEFAULT_APP_HISTORY, { entryId: 'first' })
    act(() => navigation.go({ entryId: 'second' }))

    let release!: () => void
    const barrier = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    navigation.setHistoryPopBarrier(barrier)

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: first }))
    })

    expect(barrier).toHaveBeenCalledOnce()
    expect(navigation.state.entryId).toBe('second')

    await act(async () => {
      release()
      await Promise.resolve()
    })
    expect(navigation.state.entryId).toBe('first')
  })

  it('uses mouse X1 as Back when the host leaves history untouched', () => {
    vi.useFakeTimers()
    const back = vi.spyOn(history, 'back').mockImplementation(() => {})

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousedown', { button: 3, bubbles: true }),
      )
      window.dispatchEvent(
        new MouseEvent('mouseup', { button: 3, bubbles: true }),
      )
      vi.runAllTimers()
    })

    expect(back).toHaveBeenCalledOnce()
  })

  it('uses mouse X2 as Forward when the host leaves history untouched', () => {
    vi.useFakeTimers()
    const forward = vi.spyOn(history, 'forward').mockImplementation(() => {})

    act(() => {
      window.dispatchEvent(
        new MouseEvent('mousedown', { button: 4, bubbles: true }),
      )
      window.dispatchEvent(
        new MouseEvent('mouseup', { button: 4, bubbles: true }),
      )
      vi.runAllTimers()
    })

    expect(forward).toHaveBeenCalledOnce()
  })
})
