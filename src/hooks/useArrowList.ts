import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * Arrow keys through a list of rows, the way a Mac list answers them.
 *
 * A roving tabindex (DESIGN_PRINCIPLES N4, "keyboard everywhere"): the list is
 * ONE stop in the Tab order — the row last focused, or the first — and ↑/↓
 * (Home/End) move between its rows. Return opens the focused row because each
 * row is already a button; Esc is left to the surface, which knows what "back"
 * means there.
 *
 * Rows are found by selector inside the container, not registered, so a list
 * that grows, filters or re-sorts never has to tell the hook.
 */

/** The row a key moves to, or null when the key is not a list key. */
export function nextIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null
  switch (key) {
    case 'ArrowDown':
      return Math.min(count - 1, current + 1)
    case 'ArrowUp':
      return Math.max(0, current - 1)
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

export function useArrowList<T extends HTMLElement = HTMLDivElement>(rowSelector: string) {
  const ref = useRef<T>(null)
  /** The row that holds the list's one tab stop. */
  const current = useRef<HTMLElement | null>(null)

  const rows = useCallback(
    () => (ref.current ? [...ref.current.querySelectorAll<HTMLElement>(rowSelector)] : []),
    [rowSelector],
  )

  const settle = useCallback(
    (on: HTMLElement | null) => {
      const all = rows()
      const stop = on && all.includes(on) ? on : (all[0] ?? null)
      current.current = stop
      for (const el of all) el.tabIndex = el === stop ? 0 : -1
    },
    [rows],
  )

  // After every render: rows may have come, gone or moved.
  useLayoutEffect(() => {
    settle(current.current)
  })

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return
      const all = rows()
      const at = all.indexOf(e.target as HTMLElement)
      if (at < 0) return
      const to = nextIndex(at, e.key, all.length)
      if (to === null) return
      e.preventDefault()
      const row = all[to]!
      settle(row)
      row.focus()
      row.scrollIntoView?.({ block: 'nearest' })
    },
    [rows, settle],
  )

  const onFocus = useCallback(
    (e: React.FocusEvent) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>(rowSelector)
      if (row && ref.current?.contains(row)) settle(row)
    },
    [rowSelector, settle],
  )

  return { ref, onKeyDown, onFocus }
}
