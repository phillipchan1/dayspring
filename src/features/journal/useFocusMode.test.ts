// @vitest-environment jsdom
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { useFocusMode, type FocusMode } from './useFocusMode'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mount(blocked: boolean) {
  const out: { focus: FocusMode | null } = { focus: null }
  const Probe = ({ b }: { b: boolean }) => {
    out.focus = useFocusMode(b)
    return null
  }
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(createElement(Probe, { b: blocked })))
  return { out, unmount: () => act(() => root.unmount()) }
}

const cmdEnter = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true }))
  })

describe('useFocusMode', () => {
  it('toggles on ⌘↵', () => {
    const { out, unmount } = mount(false)
    cmdEnter()
    expect(out.focus?.active).toBe(true)
    unmount()
  })

  it('leaves ⌘↵ to an overlay that owns the keyboard (the ritual rail’s “continue”)', () => {
    const { out, unmount } = mount(true)
    cmdEnter()
    expect(out.focus?.active).toBe(false)
    unmount()
  })
})
