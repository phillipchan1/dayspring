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

describe('useJournalShortcuts Back', () => {
  const escapes = () => {
    const seen: KeyboardEvent[] = []
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') seen.push(e)
    }
    window.addEventListener('keydown', listener)
    return { seen, stop: () => window.removeEventListener('keydown', listener) }
  }

  it('⌘[ goes up one layer by the road Esc takes', () => {
    const { unmount } = mount()
    const esc = escapes()
    const event = press({ key: '[', metaKey: true })
    expect(event.defaultPrevented).toBe(true)
    expect(esc.seen).toHaveLength(1)
    esc.stop()
    unmount()
  })

  it('leaves ⌘[ to the editor, where it is Outdent', () => {
    const { unmount } = mount()
    const editor = document.createElement('div')
    editor.className = 'cm-editor'
    const content = document.createElement('div')
    content.tabIndex = 0
    editor.append(content)
    document.body.append(editor)
    const esc = escapes()
    const event = new KeyboardEvent('keydown', { key: '[', metaKey: true, bubbles: true, cancelable: true })
    act(() => {
      content.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(false)
    expect(esc.seen).toHaveLength(0)
    esc.stop()
    editor.remove()
    unmount()
  })

  it("the mouse's back button goes up one layer", () => {
    const { unmount } = mount()
    const esc = escapes()
    const up = new MouseEvent('mouseup', { button: 3, bubbles: true, cancelable: true })
    act(() => {
      window.dispatchEvent(up)
    })
    expect(up.defaultPrevented).toBe(true)
    expect(esc.seen).toHaveLength(1)
    esc.stop()
    unmount()
  })
})

describe('useJournalShortcuts ⌘P', () => {
  it('prints the entry, and never lets the browser print the app', () => {
    const onPrint = vi.fn()
    const { unmount } = mount({ onPrint })
    const event = press({ key: 'p', metaKey: true })
    expect(event.defaultPrevented).toBe(true)
    expect(onPrint).toHaveBeenCalledOnce()
    unmount()
  })
})
