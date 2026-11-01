import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Presence: keep a layer on screen long enough to leave.
 *
 * Settings, the shortcuts sheet, the capture sheets and the drill-ins all had
 * entrances and no exits: closing unmounted them in the same frame, so a sheet
 * that rose from the bottom edge simply blinked out (NATIVE_FEEL_AUDIT §3,
 * DESIGN_PRINCIPLES N3: "exits are faster than entrances", not absent).
 *
 * The contract is one attribute. While the layer is wanted it renders with
 * `data-state="open"`; when it stops being wanted it stays mounted with
 * `data-state="closing"`, CSS plays the exit, and it unmounts when that exit
 * reports `animationend` / `transitionend` — or when a timeout says it should
 * have by now, because those events are not guaranteed: an animation that is
 * removed, a `display: none`, a backgrounded tab, or a Reduce Motion stylesheet
 * that deletes the animation outright all end it without a word.
 *
 * Two shapes, for the two ways a layer is closed:
 *
 *  - `usePresence(value)` — the PARENT decides. Mount on `presence.mounted`,
 *    not on the flag. The last open value is kept, so a panel rendered from
 *    `state.settings` still has its tab to draw while it slides away.
 *  - `useExit(onClose)` — the LAYER decides. For something its parent mounts
 *    conditionally (and which this file has no business editing): call
 *    `exit.close()` wherever it used to call `onClose()`, and the parent hears
 *    about it once the exit has played.
 *
 * Under Reduce Motion both are immediate. The sheets still cross-fade IN there
 * (global.css, "Presence"), but nothing makes anyone wait on the way out.
 */

export type PresenceState = 'open' | 'closing'

/** Used when the exit's length can't be read off the node at all. */
export const EXIT_FALLBACK_MS = 400

/** Added to a duration read off the node, for a frame that lands late. */
const EXIT_SLACK_MS = 60

/**
 * How long a layer that asked to close waits to be taken away before it comes
 * back. Only a failure path: a parent that refused the close, or a history
 * frame that never popped. Without it the layer would sit invisible and inert
 * (closing ignores pointers) for good.
 */
export const STRANDED_MS = 1500

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** "0.15s, 200ms" → [150, 200]. Anything unparseable (`auto`, '') is 0. */
function times(list: string): number[] {
  return list.split(',').map((raw) => {
    const t = raw.trim()
    const n = parseFloat(t)
    if (!Number.isFinite(n)) return 0
    return t.endsWith('ms') ? n : n * 1000
  })
}

/** Longest duration + delay across a comma list; lists repeat to match. */
function longest(durations: string, delays: string): number {
  const d = times(durations)
  const l = times(delays)
  let max = 0
  for (let i = 0; i < d.length; i++) max = Math.max(max, d[i]! + (l[i % l.length] ?? 0))
  return max
}

/**
 * The longest exit this node will play, in ms, from its computed style — or
 * null when the style can't be read (no node, or an environment like jsdom that
 * returns empty strings). Zero is a real answer: no animation, nothing to wait
 * for.
 */
export function exitDuration(node: Element | null): number | null {
  if (!node || typeof getComputedStyle !== 'function') return null
  const cs = getComputedStyle(node)
  const animation = cs.animationName && cs.animationName !== 'none' ? cs.animationDuration : ''
  if (!cs.animationDuration && !cs.transitionDuration) return null
  return Math.max(
    animation ? longest(animation, cs.animationDelay || '0s') : 0,
    cs.transitionDuration ? longest(cs.transitionDuration, cs.transitionDelay || '0s') : 0,
  )
}

/**
 * Call `done` once `node` has finished its exit: on its own `animationend` or
 * `transitionend` (never a descendant's — a waveform bar finishing its shimmer
 * is not the sheet leaving), or on a timeout read from its computed style.
 * Returns a cancel function. `done` runs at most once.
 */
export function waitForExit(node: Element | null, done: () => void, timeout?: number): () => void {
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const onEnd = (e: Event) => {
    if (e.target === node) finish()
  }
  function cleanup() {
    if (timer !== undefined) clearTimeout(timer)
    node?.removeEventListener('animationend', onEnd)
    node?.removeEventListener('transitionend', onEnd)
  }
  function finish() {
    if (settled) return
    settled = true
    cleanup()
    done()
  }
  let ms = timeout
  if (ms === undefined) {
    const read = exitDuration(node)
    ms = read === null ? EXIT_FALLBACK_MS : read === 0 ? 0 : read + EXIT_SLACK_MS
  }
  node?.addEventListener('animationend', onEnd)
  node?.addEventListener('transitionend', onEnd)
  timer = setTimeout(finish, ms)
  return () => {
    settled = true
    cleanup()
  }
}

export interface PresenceOptions {
  /** Longest the exit may take, in ms. Default: read off the node's style. */
  timeout?: number
}

export interface Presence<T> {
  /** Render the layer while this is true — through its exit, not just while open. */
  mounted: boolean
  /** For `data-state`: 'open', or 'closing' while the exit plays. */
  state: PresenceState
  /** The value while open; the last open value while closing. */
  value: T | undefined
  /** On the element whose exit decides when the layer is gone. */
  ref: (node: Element | null) => void
}

/**
 * Parent-driven presence. `value` is the thing that says the layer is wanted —
 * a boolean, or the state object it renders from; null, undefined and false
 * all mean "not wanted".
 */
export function usePresence<T>(
  value: T | null | undefined | false,
  options: PresenceOptions = {},
): Presence<T> {
  const open = value !== null && value !== undefined && value !== false
  /*
   * The previous `open`, in state, so the change is seen DURING the render it
   * happens in. React's documented "adjust state when a prop changes" pattern:
   * an effect would be a render too late, and that render would have unmounted
   * the layer before the exit could start.
   */
  const [wasOpen, setWasOpen] = useState(open)
  const [exiting, setExiting] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    setExiting(!open && !prefersReducedMotion())
  }
  /*
   * The last open value, as a ref: callers hand in objects that may be rebuilt
   * every render, and keeping those in state would re-render forever.
   */
  const kept = useRef<T | undefined>(open ? (value as T) : undefined)
  if (open) kept.current = value as T

  const node = useRef<Element | null>(null)
  const ref = useCallback((el: Element | null) => {
    node.current = el
  }, [])

  const { timeout } = options
  useEffect(() => {
    if (!exiting) return
    return waitForExit(node.current, () => setExiting(false), timeout)
  }, [exiting, timeout])

  return {
    mounted: open || exiting,
    state: open ? 'open' : 'closing',
    value: open ? (value as T) : kept.current,
    ref,
  }
}

export interface Exit {
  /** For `data-state`. */
  state: PresenceState
  closing: boolean
  /** Play the exit, then call `onClose`. Safe to call more than once. */
  close: () => void
  ref: (node: Element | null) => void
}

/**
 * Layer-driven presence: the layer plays its own exit, then tells its parent.
 *
 * `onClose` is called exactly once per close, after the exit — and the layer
 * then STAYS closed rather than springing back, because a parent that closes
 * through history (`back()`) takes a tick or two to actually unmount it. If it
 * is still here `STRANDED_MS` later, the close was refused and it reopens.
 */
export function useExit(onClose: () => void, options: PresenceOptions = {}): Exit {
  const [closing, setClosing] = useState(false)
  const asked = useRef(false)
  const latest = useRef(onClose)
  latest.current = onClose
  const stranded = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const node = useRef<Element | null>(null)
  const ref = useCallback((el: Element | null) => {
    node.current = el
  }, [])

  const strand = useCallback(() => {
    stranded.current = setTimeout(() => {
      asked.current = false
      setClosing(false)
    }, STRANDED_MS)
  }, [])

  const close = useCallback(() => {
    if (asked.current) return
    asked.current = true
    if (prefersReducedMotion()) {
      latest.current()
      strand()
      return
    }
    setClosing(true)
  }, [strand])

  const { timeout } = options
  useEffect(() => {
    if (!closing) return
    return waitForExit(
      node.current,
      () => {
        latest.current()
        strand()
      },
      timeout,
    )
  }, [closing, timeout, strand])

  useEffect(
    () => () => {
      if (stranded.current !== undefined) clearTimeout(stranded.current)
    },
    [],
  )

  return { state: closing ? 'closing' : 'open', closing, close, ref }
}

/**
 * One callback ref that feeds several — the presence hook and a drag hook both
 * want the same sheet. Pass the same number of refs on every render.
 */
export function useMergedRef<T extends Element>(
  ...refs: Array<((node: T | null) => void) | undefined>
): (node: T | null) => void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((node: T | null) => refs.forEach((r) => r?.(node)), refs)
}
