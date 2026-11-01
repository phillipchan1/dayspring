// @vitest-environment jsdom
import { act, createElement, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MENU_EXIT_MS,
  __resetMenuInputForTests,
  isContextPress,
  stepIndex,
  typeaheadIndex,
  useMenuExit,
  useMenuKeyboard,
} from './useMenuKeyboard'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('stepIndex', () => {
  it('starts at the first row going down and the last going up', () => {
    expect(stepIndex(-1, 4, 1)).toBe(0)
    expect(stepIndex(-1, 4, -1)).toBe(3)
  })
  it('wraps at both ends', () => {
    expect(stepIndex(3, 4, 1)).toBe(0)
    expect(stepIndex(0, 4, -1)).toBe(3)
  })
  it('has nowhere to go in an empty menu', () => {
    expect(stepIndex(-1, 0, 1)).toBe(-1)
  })
})

describe('typeaheadIndex', () => {
  const labels = ['serif', 'sans', 'literary', 'lora', 'lato', 'mono']
  it('lands on the first row starting with the letter', () => {
    expect(typeaheadIndex(labels, -1, 'l')).toBe(2)
    expect(typeaheadIndex(labels, -1, 'M')).toBe(5)
  })
  it('cycles through rows with the same first letter when the letter repeats', () => {
    expect(typeaheadIndex(labels, 2, 'l')).toBe(3)
    expect(typeaheadIndex(labels, 3, 'll')).toBe(4)
    expect(typeaheadIndex(labels, 4, 'lll')).toBe(2)
  })
  it('narrows to a prefix for a run of different letters, staying on a row that still matches', () => {
    expect(typeaheadIndex(labels, -1, 'la')).toBe(4)
    expect(typeaheadIndex(labels, 3, 'lo')).toBe(3)
  })
  it('finds nothing for a letter no row starts with', () => {
    expect(typeaheadIndex(labels, 0, 'z')).toBe(-1)
  })
})

describe('isContextPress', () => {
  it('is the right button or a ⌃-click', () => {
    expect(isContextPress({ button: 2, ctrlKey: false })).toBe(true)
    expect(isContextPress({ button: 0, ctrlKey: true })).toBe(true)
    expect(isContextPress({ button: 0, ctrlKey: false })).toBe(false)
  })
})

describe('MENU_EXIT_MS', () => {
  it('matches the --dur-exit token', () => {
    const themes = readFileSync(resolve(__dirname, '../styles/themes.css'), 'utf8')
    const m = themes.match(/--dur-exit:\s*(\d+)ms/)
    expect(Number(m?.[1])).toBe(MENU_EXIT_MS)
  })
})

// ── The hook, mounted ───────────────────────────────────────────────────────

interface Mounted {
  host: HTMLElement
  onClose: ReturnType<typeof vi.fn>
  clicks: string[]
  rows: () => HTMLElement[]
  highlighted: () => string | null
  unmount: () => void
}

function mountMenu(opts: { initial?: 'auto' | 'selected' | 'none'; selected?: string } = {}): Mounted {
  const onClose = vi.fn()
  const clicks: string[] = []
  const labels = ['Copy text', 'Copy Markdown', 'Duplicate', 'Delete entry…']
  const Probe = () => {
    const ref = useRef<HTMLDivElement>(null)
    const keys = useMenuKeyboard({ open: true, menuRef: ref, onClose, initial: opts.initial ?? 'auto' })
    return createElement(
      'div',
      { ref, role: 'menu', ...keys.menuProps },
      createElement('div', { className: 'head' }, 'Head'),
      ...labels.map((label) =>
        createElement(
          'button',
          {
            key: label,
            type: 'button',
            role: 'menuitem',
            'aria-checked': opts.selected === label ? 'true' : undefined,
            onClick: () => clicks.push(label),
          },
          label,
        ),
      ),
    )
  }
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(createElement(Probe)))
  const rows = () => Array.from(host.querySelectorAll<HTMLElement>('[role="menuitem"]'))
  return {
    host,
    onClose,
    clicks,
    rows,
    highlighted: () => host.querySelector('[data-highlighted="true"]')?.textContent ?? null,
    unmount: () => {
      act(() => root.unmount())
      host.remove()
    },
  }
}

function key(k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

function pointer(type: string, target: EventTarget, init: { x: number; y: number; button?: number }) {
  const Ctor = (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent
  const event = new Ctor(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x,
    clientY: init.y,
    button: init.button ?? 0,
  }) as PointerEvent
  if (!('pointerType' in event) || !event.pointerType) {
    Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  }
  act(() => {
    target.dispatchEvent(event)
  })
}

afterEach(() => {
  __resetMenuInputForTests('pointer', null)
})

describe('useMenuKeyboard', () => {
  it('opens with nothing lit when the pointer opened it', () => {
    __resetMenuInputForTests('pointer')
    const m = mountMenu()
    expect(m.highlighted()).toBeNull()
    m.unmount()
  })

  it('lights the first row when the keyboard opened it', () => {
    __resetMenuInputForTests('keyboard')
    const m = mountMenu()
    expect(m.highlighted()).toBe('Copy text')
    expect(document.activeElement?.textContent).toBe('Copy text')
    m.unmount()
  })

  it('opens a picker on its current value', () => {
    const m = mountMenu({ initial: 'selected', selected: 'Duplicate' })
    expect(m.highlighted()).toBe('Duplicate')
    m.unmount()
  })

  it('never pre-lights a sheet', () => {
    __resetMenuInputForTests('keyboard')
    const m = mountMenu({ initial: 'none' })
    expect(m.highlighted()).toBeNull()
    m.unmount()
  })

  it('moves with ↑/↓, wrapping, and jumps with Home/End', () => {
    const m = mountMenu()
    expect(key('ArrowDown').defaultPrevented).toBe(true)
    expect(m.highlighted()).toBe('Copy text')
    key('ArrowDown')
    expect(m.highlighted()).toBe('Copy Markdown')
    key('ArrowUp')
    key('ArrowUp')
    expect(m.highlighted()).toBe('Delete entry…')
    key('Home')
    expect(m.highlighted()).toBe('Copy text')
    key('End')
    expect(m.highlighted()).toBe('Delete entry…')
    m.unmount()
  })

  it('selects by typing', () => {
    const m = mountMenu()
    key('d')
    expect(m.highlighted()).toBe('Duplicate')
    key('d')
    expect(m.highlighted()).toBe('Delete entry…')
    m.unmount()
  })

  it('activates the lit row on Return and on Space', () => {
    const m = mountMenu()
    key('Enter')
    expect(m.clicks).toEqual([]) // nothing lit, nothing pressed
    key('ArrowDown')
    key('Enter')
    key('ArrowDown')
    key(' ')
    expect(m.clicks).toEqual(['Copy text', 'Copy Markdown'])
    m.unmount()
  })

  it('closes on Esc, and the key goes no further', () => {
    const m = mountMenu()
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    const e = key('Escape')
    expect(m.onClose).toHaveBeenCalledOnce()
    expect(e.defaultPrevented).toBe(true)
    expect(outer).not.toHaveBeenCalled()
    document.removeEventListener('keydown', outer)
    m.unmount()
  })

  it('leaves ⌘-chords alone', () => {
    const m = mountMenu()
    const e = key('n', { metaKey: true })
    expect(e.defaultPrevented).toBe(false)
    expect(m.highlighted()).toBeNull()
    m.unmount()
  })

  it('moves the highlight with the pointer and clears it when the pointer leaves', () => {
    const m = mountMenu()
    const [, second] = m.rows()
    pointer('pointermove', second!, { x: 10, y: 30 })
    expect(m.highlighted()).toBe('Copy Markdown')
    key('ArrowDown') // the keys carry on from where the pointer left it
    expect(m.highlighted()).toBe('Duplicate')
    pointer('pointermove', m.host.querySelector('.head')!, { x: 10, y: 2 })
    expect(m.highlighted()).toBeNull()
    m.unmount()
  })

  it('commits on release after a press-drag from the right-click that opened it', () => {
    __resetMenuInputForTests('pointer', { x: 5, y: 5 })
    const m = mountMenu()
    const [, , third] = m.rows()
    pointer('pointermove', third!, { x: 30, y: 60 })
    pointer('pointerup', third!, { x: 30, y: 60, button: 2 })
    expect(m.clicks).toEqual(['Duplicate'])
    m.unmount()
  })

  it('does not commit when the opening press is released without moving', () => {
    __resetMenuInputForTests('pointer', { x: 5, y: 5 })
    const m = mountMenu()
    const [first] = m.rows()
    pointer('pointerup', first!, { x: 5, y: 5, button: 2 })
    expect(m.clicks).toEqual([])
    m.unmount()
  })

  it('does not arm press-drag-release for a menu opened by a click', () => {
    __resetMenuInputForTests('pointer', null)
    const m = mountMenu()
    const [, second] = m.rows()
    pointer('pointermove', second!, { x: 40, y: 40 })
    pointer('pointerup', second!, { x: 40, y: 40 })
    expect(m.clicks).toEqual([])
    m.unmount()
  })
})

describe('useMenuExit', () => {
  it('keeps the last open value while it fades, then lets go', () => {
    vi.useFakeTimers()
    const seen: Array<{ shown: string | null; leaving: boolean }> = []
    let setValue: (v: string | null) => void = () => {}
    const Probe = () => {
      const [value, set] = useState<string | null>('menu')
      setValue = set
      seen.push(useMenuExit(value))
      return null
    }
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => root.render(createElement(Probe)))
    expect(seen.at(-1)).toEqual({ shown: 'menu', leaving: false })
    act(() => setValue(null))
    expect(seen.at(-1)).toEqual({ shown: 'menu', leaving: true })
    act(() => {
      vi.advanceTimersByTime(MENU_EXIT_MS)
    })
    expect(seen.at(-1)).toEqual({ shown: null, leaving: false })
    act(() => root.unmount())
    vi.useRealTimers()
  })

  it('a menu re-opened mid-fade is simply open again', () => {
    vi.useFakeTimers()
    const seen: Array<{ shown: string | null; leaving: boolean }> = []
    let setValue: (v: string | null) => void = () => {}
    const Probe = () => {
      const [value, set] = useState<string | null>('a')
      setValue = set
      seen.push(useMenuExit(value))
      return null
    }
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => root.render(createElement(Probe)))
    act(() => setValue(null))
    act(() => setValue('b'))
    act(() => {
      vi.advanceTimersByTime(MENU_EXIT_MS * 2)
    })
    expect(seen.at(-1)).toEqual({ shown: 'b', leaving: false })
    act(() => root.unmount())
    vi.useRealTimers()
  })
})
