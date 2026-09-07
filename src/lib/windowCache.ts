/**
 * Window-aware cache lookup — the piece that stops the Ascent and the Lamp from
 * re-scanning the same table once per altitude.
 *
 * Every windowed read is cached under a key that encodes its own window (see
 * `windowCacheKey`). A read over a WIDER window already contains the answer for
 * any narrower one, so before going to the network we ask: is a superset cached?
 * If it is, the narrower answer is a client-side filter — free. That makes the
 * Lamp's all-time read warm all four Ascent altitudes, and makes one union read
 * cover the four altitudes instead of four overlapping scans.
 *
 * The containment rules are pure functions, so the "which cached read answers
 * this window" decision is testable without a network or a fake clock.
 */

import { cacheKeysWithPrefix, getCache, invalidateCache, setCache, windowCacheKey } from './asyncCache'

export interface CacheWindow {
  from?: Date
  to?: Date
}

/** Reverse of `windowCacheKey`. Returns null for a key we didn't write. */
export function parseWindowKey(key: string): CacheWindow | null {
  if (key === 'all') return {}
  const parts = key.split('|')
  if (parts.length !== 2) return null
  const [f, t] = parts
  const out: CacheWindow = {}
  if (f) {
    const from = new Date(f)
    if (Number.isNaN(from.getTime())) return null
    out.from = from
  }
  if (t) {
    const to = new Date(t)
    if (Number.isNaN(to.getTime())) return null
    out.to = to
  }
  return out
}

/** Does `outer` fully contain `inner`? An absent bound means unbounded, so `{}`
 *  contains everything and nothing but `{}` contains an unbounded inner side. */
export function windowContains(outer: CacheWindow, inner: CacheWindow): boolean {
  if (outer.from) {
    if (!inner.from || inner.from.getTime() < outer.from.getTime()) return false
  }
  if (outer.to) {
    if (!inner.to || inner.to.getTime() > outer.to.getTime()) return false
  }
  return true
}

/** Rough width, for preferring the TIGHTEST superset (least filtering, and the
 *  freshest-scoped data). Unbounded on either side sorts last. */
function span(w: CacheWindow): number {
  if (!w.from || !w.to) return Number.POSITIVE_INFINITY
  return w.to.getTime() - w.from.getTime()
}

/** The union of a set of windows — one read that covers them all. Unbounded on
 *  a side if any input is unbounded there. */
export function unionWindows(windows: CacheWindow[]): CacheWindow {
  let from: number | null = null
  let to: number | null = null
  let openStart = false
  let openEnd = false
  for (const w of windows) {
    if (w.from) from = from === null ? w.from.getTime() : Math.min(from, w.from.getTime())
    else openStart = true
    if (w.to) to = to === null ? w.to.getTime() : Math.max(to, w.to.getTime())
    else openEnd = true
  }
  const out: CacheWindow = {}
  if (!openStart && from !== null) out.from = new Date(from)
  if (!openEnd && to !== null) out.to = new Date(to)
  return out
}

/**
 * The cached rows that answer `window` — an exact hit, or the tightest cached
 * superset filtered down by `dateOf`. Returns null when nothing cached covers it.
 */
export function readWindowCache<T>(
  prefix: string,
  window: CacheWindow | undefined,
  dateOf: (row: T) => string,
): T[] | null {
  const want = window ?? {}
  const exact = getCache<T[]>(prefix + windowCacheKey(want))
  if (exact) return exact

  let best: { rows: T[]; width: number } | null = null
  for (const key of cacheKeysWithPrefix(prefix)) {
    const outer = parseWindowKey(key.slice(prefix.length))
    if (!outer || !windowContains(outer, want)) continue
    const rows = getCache<T[]>(key)
    if (!rows) continue
    const width = span(outer)
    if (!best || width < best.width) best = { rows, width }
  }
  if (!best) return null
  return best.rows.filter((row) => inWindow(dateOf(row), want))
}

/** Cache `rows` for `window`, dropping any cached window this one now subsumes —
 *  so repeatedly widening the range doesn't pile up redundant copies. */
export function writeWindowCache<T>(prefix: string, window: CacheWindow | undefined, rows: T[]): void {
  const want = window ?? {}
  const key = prefix + windowCacheKey(want)
  for (const other of cacheKeysWithPrefix(prefix)) {
    if (other === key) continue
    const inner = parseWindowKey(other.slice(prefix.length))
    if (inner && windowContains(want, inner)) invalidateCache(other)
  }
  setCache(key, rows)
}

/** True when `iso` falls inside `w` (absent bounds are unbounded). */
export function inWindow(iso: string, w?: CacheWindow): boolean {
  if (!w) return true
  const t = Date.parse(iso)
  if (w.from && t < w.from.getTime()) return false
  if (w.to && t > w.to.getTime()) return false
  return true
}
