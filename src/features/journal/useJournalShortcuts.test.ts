// @vitest-environment jsdom
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { useJournalShortcuts, type JournalShortcutActions } from './useJournalShortcuts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mount(overrides: Partial<JournalShortcutActions> = {}) {
  const onFindInPages = vi.fn()
  const actions: JournalShortcutActions = {
    onNew: vi.fn(),
    onSave: vi.fn(),
    onPages: vi.fn(),
    onLookBack: vi.fn(),
    onScripture: vi.fn(),
    onAltar: vi.fn(),
    onOpenSettings: vi.fn(),
    onFindOrAsk: vi.fn(),
    onFindInPages,
    onToggleRailLabels: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
    focusActive: false,
    settingsOpen: false,
    ...overrides,
  }
  const Probe = () => {
    useJournalShortcuts(actions)
    return null
  }
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(createElement(Probe)))
  return {
    onFindInPages,
    unmount: () => act(() => root.unmount()),
  }
}

function press(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

describe('useJournalShortcuts ⌘F', () => {
  it('opens Look for on ⌘F', () => {
    const { onFindInPages, unmount } = mount()
    const event = press({ key: 'f', metaKey: true })
    expect(event.defaultPrevented).toBe(true)
    expect(onFindInPages).toHaveBeenCalledOnce()
    unmount()
  })

  it('leaves ⌃⌘F to Enter Full Screen', () => {
    const { onFindInPages, unmount } = mount()
    const event = press({ key: 'f', metaKey: true, ctrlKey: true })
    expect(event.defaultPrevented).toBe(false)
    expect(onFindInPages).not.toHaveBeenCalled()
    unmount()
  })
})
