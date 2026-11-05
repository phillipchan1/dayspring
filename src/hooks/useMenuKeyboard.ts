import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, type RefObject } from 'react'
import { prefersReducedMotion } from './usePresence'

/**
 * Menus that behave like NSMenu / UIMenu and look like Dayspring
 * (DESIGN_PRINCIPLES N4, "Rulings": custom glass menus vs a real NSMenu).
 *
 * One hook for every glass menu in the app, so they all speak the same
 * grammar:
 *
 *  - ↑/↓ move the highlight (wrapping), Home/End jump to the ends.
 *  - Typing selects: first-letter type-ahead, and a quick run of letters
 *    narrows to the row that starts with them.
 *  - Return or Space activates the highlighted row; Esc closes; Tab closes.
 *  - The first row is highlighted only when the menu was opened from the
 *    keyboard. A right-click opens with nothing lit, as on the Mac: a lit row
 *    under the pointer reads as a choice already made.
 *  - A menu opened while a mouse button is still down (a right-click on the
 *    Mac opens on press) commits on release over a row once the pointer has
 *    moved — press, drag to the row, let go.
 *  - One highlight, shared by the mouse and the keys: hovering a row moves it
 *    there, and the arrows carry on from wherever the pointer left it.
 *
 * The highlight is a `data-highlighted` attribute written straight onto the row and
 * the row is focused, so styling needs no React state and a screen reader
 * hears each row as it lights. Nothing here touches the editor's keystroke
 * path: the listeners exist only while a menu is open.
 */

/** Rows the hook moves through. Disabled rows are skipped. */
export const MENU_ROW_SELECTOR =
  '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"]'

/** How long a run of typed letters stays one search (NSMenu is about this). */
export const TYPEAHEAD_RESET_MS = 750

/** Travel (px) past which a held press becomes a drag through the menu. */
export const DRAG_COMMIT_SLOP = 4

// ── Input modality ─────────────────────────────────────────────────────────

type Modality = 'keyboard' | 'pointer'

let lastModality: Modality = 'pointer'
/** The mouse button currently held down, if any, and where it went down. */
let heldMouse: { x: number; y: number } | null = null
let trackerInstalled = false

function installModalityTracker(): void {
  if (trackerInstalled || typeof window === 'undefined') return
  trackerInstalled = true
  window.addEventListener(
    'keydown',
    (e) => {
      // A bare modifier is not "using the keyboard" — ⌘ held on the way to a
      // click is still a click.
      if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift') return
      lastModality = 'keyboard'
    },
    true,
  )
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastModality = 'pointer'
      heldMouse = e.pointerType === 'mouse' ? { x: e.clientX, y: e.clientY } : null
    },
    true,
  )
  const lift = () => {
    heldMouse = null
  }
  window.addEventListener('pointerup', lift, true)
  window.addEventListener('pointercancel', lift, true)
  window.addEventListener('blur', lift)
}

// Install at import so the very first menu already knows how it was opened.
installModalityTracker()

/** Whether the last thing the person did was press a key (vs. point). */
export function lastInputWasKeyboard(): boolean {
  return lastModality === 'keyboard'
}

/** Test seam: reset the module's view of input. */
export function __resetMenuInputForTests(modality: Modality = 'pointer', held: { x: number; y: number } | null = null) {
  installModalityTracker()
  lastModality = modality
  heldMouse = held
}

/**
 * The press that asks for a context menu: the right button, or ⌃-click on a
 * Mac. Menus use it to let that press fall through their backdrop to whatever
 * is under it, so a right-click outside an open menu re-targets instead of
 * merely closing.
 */
export function isContextPress(e: { button: number; ctrlKey: boolean }): boolean {
  return e.button === 2 || (e.button === 0 && e.ctrlKey)
}

// ── Pure navigation (unit-tested) ──────────────────────────────────────────

/** Next row index for ↑/↓, wrapping; from "nothing lit" (-1) ↓ is the first, ↑ the last. */
export function stepIndex(current: number, count: number, dir: 1 | -1): number {
  if (count <= 0) return -1
  if (current < 0 || current >= count) return dir === 1 ? 0 : count - 1
  return (current + dir + count) % count
}

/** Normalise a row's text for type-ahead: lowercase, trimmed, accents kept. */
export function typeaheadLabel(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

/**
 * The row type-ahead lands on.
 *
 * A run of one repeated letter ("s", "ss", "sss") cycles through the rows that
 * start with it, starting after the current one — the Finder and NSMenu
 * behaviour. Anything longer is a prefix search that starts AT the current row,
 * so typing "me" while "Merriweather" is lit stays on it.
 */
export function typeaheadIndex(labels: readonly string[], current: number, buffer: string): number {
  const query = typeaheadLabel(buffer)
  if (!query || labels.length === 0) return -1
  const repeated = [...query].every((c) => c === query[0])
  const needle = repeated ? query[0]! : query
  const start = repeated ? current + 1 : Math.max(current, 0)
  for (let i = 0; i < labels.length; i++) {
    const idx = (start + i + labels.length) % labels.length
    if (labels[idx]!.startsWith(needle)) return idx
  }
  return -1
}

// ── Exit fade ──────────────────────────────────────────────────────────────

/** `--dur-exit` (themes.css). Kept in step with the token by a test. */
export const MENU_EXIT_MS = 150

/**
 * Keep a closed menu on screen long enough to fade out.
 *
 * The menus' own, lighter cousin of usePresence: a menu's exit is one fixed
 * opacity fade, so a timer on the token is enough and no node has to report
 * its animation's end.
 *
 * Mac menus appear instantly and fade over ~150ms when they go
 * (DESIGN_PRINCIPLES N3). Pass the menu's open value (null when closed); you
 * get back the value to render — the last open one while it fades — and a
 * `leaving` flag to put on the menu as `data-leaving`, which the CSS fades and
 * makes click-through. Reduce Motion skips the fade.
 */
export function useMenuExit<T>(value: T | null, exitMs = MENU_EXIT_MS): { shown: T | null; leaving: boolean } {
  const lastRef = useRef<T | null>(value)
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  if (value != null) lastRef.current = value
  const leaving = value == null && lastRef.current != null

  useEffect(() => {
    if (!leaving) return
    const done = () => {
      lastRef.current = null
      rerender()
    }
    if (prefersReducedMotion() || exitMs <= 0) {
      done()
      return
    }
    const t = window.setTimeout(done, exitMs)
    return () => window.clearTimeout(t)
  }, [leaving, exitMs])

  return { shown: lastRef.current, leaving }
}

// ── The hook ───────────────────────────────────────────────────────────────

export interface MenuKeyboardOptions {
  /** True while the menu is open and interactive (false while it fades out). */
  open: boolean
  menuRef: RefObject<HTMLElement | null>
  onClose: () => void
  /**
   * Which row is lit when the menu opens.
   *  - `'auto'` (default): the first row if the menu was opened from the
   *    keyboard, nothing otherwise.
   *  - `'selected'`: the row marked `aria-selected="true"` / `aria-checked="true"`
   *    (a picker opens on its current value), else as `'auto'`.
   *  - `'none'`: never pre-light (phone sheets: a lit row under a thumb reads
   *    as a choice already made).
   */
  initial?: 'auto' | 'selected' | 'none'
  /** Rows to move through. Defaults to the menu roles. */
  itemSelector?: string
  /** Put focus back where it was when the menu closes. Default true. */
  restoreFocus?: boolean
  /** Bump to re-run the opening highlight (a menu re-opened at a new target). */
  openKey?: unknown
}

export interface MenuKeyboard {
  /** Spread on the menu element. */
  menuProps: {
    onPointerMove: (e: React.PointerEvent) => void
    onPointerLeave: (e: React.PointerEvent) => void
  }
}

function rowsOf(menu: HTMLElement | null, selector: string): HTMLElement[] {
  if (!menu) return []
  return Array.from(menu.querySelectorAll<HTMLElement>(selector)).filter(
    (el) =>
      !(el as HTMLButtonElement).disabled &&
      el.getAttribute('aria-disabled') !== 'true' &&
      !el.hidden,
  )
}

function labelOf(el: HTMLElement): string {
  return typeaheadLabel(el.dataset.typeahead ?? el.getAttribute('aria-label') ?? el.textContent ?? '')
}

export function useMenuKeyboard({
  open,
  menuRef,
  onClose,
  initial = 'auto',
  itemSelector = MENU_ROW_SELECTOR,
  restoreFocus = true,
  openKey,
}: MenuKeyboardOptions): MenuKeyboard {
  const activeRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const setActive = useCallback(
    (el: HTMLElement | null, how: 'key' | 'pointer' = 'key') => {
      const prev = activeRef.current
      if (prev && prev !== el) prev.removeAttribute('data-highlighted')
      activeRef.current = el
      if (!el) {
        // Nothing lit: keep focus inside the menu so keys still land here.
        const menu = menuRef.current
        if (menu && menu.contains(document.activeElement) && document.activeElement !== menu) {
          menu.focus({ preventScroll: true })
        }
        return
      }
      el.setAttribute('data-highlighted', 'true')
      el.focus({ preventScroll: true })
      if (how === 'key') el.scrollIntoView?.({ block: 'nearest' })
    },
    [menuRef],
  )

  // Opening highlight + focus in; focus back out on close.
  useLayoutEffect(() => {
    if (!open) return
    const menu = menuRef.current
    if (!menu) return
    const opener = document.activeElement as HTMLElement | null
    const rows = rowsOf(menu, itemSelector)
    let first: HTMLElement | null = null
    if (initial === 'selected') {
      first =
        rows.find(
          (r) => r.getAttribute('aria-selected') === 'true' || r.getAttribute('aria-checked') === 'true',
        ) ?? null
    }
    if (!first && initial !== 'none' && lastInputWasKeyboard()) first = rows[0] ?? null
    if (!menu.hasAttribute('tabindex')) menu.setAttribute('tabindex', '-1')
    if (first) setActive(first, 'key')
    else {
      activeRef.current?.removeAttribute('data-highlighted')
      activeRef.current = null
      menu.focus({ preventScroll: true })
    }
    return () => {
      activeRef.current?.removeAttribute('data-highlighted')
      activeRef.current = null
      if (!restoreFocus) return
      // Only hand focus back if it is still ours to give: a row's action may
      // have moved it on purpose (a dialog, an input).
      const restore = () => {
        const now = document.activeElement
        const stillOurs = !now || now === document.body || menu.contains(now) || !now.isConnected
        if (stillOurs && opener && opener.isConnected && opener !== document.body && !menu.contains(opener)) {
          opener.focus({ preventScroll: true })
        }
      }
      restore()
      // A menu fading out is still mounted, and React puts focus back on its
      // row at the end of the commit (it restores what was focused before
      // one). Hand it over again once the commit is done.
      queueMicrotask(restore)
    }
    // openKey re-runs this for a menu re-opened elsewhere while mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openKey])

  // Keys.
  useEffect(() => {
    if (!open) return
    let buffer = ''
    let bufferTimer: number | undefined

    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      const menu = menuRef.current
      if (!menu) return
      const rows = rowsOf(menu, itemSelector)
      const current = activeRef.current ? rows.indexOf(activeRef.current) : -1
      const handled = () => {
        e.preventDefault()
        e.stopPropagation()
      }

      switch (e.key) {
        case 'Escape':
          handled()
          onCloseRef.current()
          return
        case 'Tab':
          handled()
          onCloseRef.current()
          return
        case 'ArrowDown':
        case 'ArrowUp': {
          if (e.metaKey || e.ctrlKey) return
          handled()
          const next = stepIndex(current, rows.length, e.key === 'ArrowDown' ? 1 : -1)
          setActive(rows[next] ?? null)
          return
        }
        case 'Home':
        case 'PageUp':
          handled()
          setActive(rows[0] ?? null)
          return
        case 'End':
        case 'PageDown':
          handled()
          setActive(rows[rows.length - 1] ?? null)
          return
        case 'Enter':
        case ' ': {
          // Space mid-word is part of a type-ahead run ("follow the"), not a press.
          if (e.key === ' ' && buffer) {
            handled()
            buffer += ' '
            return
          }
          handled()
          const row = activeRef.current
          if (row && menu.contains(row)) row.click()
          return
        }
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.length !== 1) return
      handled()
      buffer += e.key
      window.clearTimeout(bufferTimer)
      bufferTimer = window.setTimeout(() => {
        buffer = ''
      }, TYPEAHEAD_RESET_MS)
      const idx = typeaheadIndex(rows.map(labelOf), current, buffer)
      if (idx >= 0) setActive(rows[idx] ?? null)
    }

    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.clearTimeout(bufferTimer)
    }
  }, [open, menuRef, itemSelector, setActive])

  // Press, drag to a row, release — for a menu opened while the mouse is held.
  useEffect(() => {
    if (!open) return
    const origin = heldMouse
    if (!origin) return
    let dragged = false
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > DRAG_COMMIT_SLOP) dragged = true
    }
    const onUp = (e: PointerEvent) => {
      cleanup()
      if (e.pointerType !== 'mouse' || !dragged) return
      const menu = menuRef.current
      const target = e.target instanceof Element ? e.target : null
      const row = target?.closest<HTMLElement>(itemSelector)
      if (!menu || !row || !menu.contains(row)) return
      if (!rowsOf(menu, itemSelector).includes(row)) return
      e.preventDefault()
      row.click()
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
    }
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    return cleanup
  }, [open, menuRef, itemSelector])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      // A finger moving across a menu is a scroll or a press, not a hover.
      if (e.pointerType === 'touch') return
      const menu = menuRef.current
      const target = e.target instanceof Element ? e.target : null
      const row = target?.closest<HTMLElement>(itemSelector) ?? null
      if (row && menu?.contains(row) && rowsOf(menu, itemSelector).includes(row)) {
        if (row !== activeRef.current) setActive(row, 'pointer')
      } else if (activeRef.current) {
        setActive(null, 'pointer')
      }
    },
    [menuRef, itemSelector, setActive],
  )

  const onPointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return
      if (activeRef.current) setActive(null, 'pointer')
    },
    [setActive],
  )

  return { menuProps: { onPointerMove, onPointerLeave } }
}
