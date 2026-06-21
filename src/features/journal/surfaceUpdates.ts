import { useSyncExternalStore } from 'react'
import { track } from '@/lib/analytics'

/**
 * "New since you last looked" — the second, recurring layer beneath the one-time
 * discovery ember (see surfaceEmbers.ts). Where the ember only ever says "your
 * material lives here now" once, this remembers the *specific* things that have
 * landed on a Return surface since you last opened it: the verses you cited, the
 * prayers you laid down. The rail dot can relight from it after the discovery
 * ember is spent, and — the point of the whole feature — the surface can name
 * what's new on arrival, so the glow finally connects to a thing.
 *
 * Each surface keeps a small ordered list of unseen items. Recording is a no-op
 * for a duplicate id (re-committing an edited block must not re-flag it). Opening
 * the surface consumes the list. State lives in localStorage so it survives
 * restarts; a same-tab event keeps every subscribed nav in sync.
 */

export type UpdateSurface = 'reflections' | 'scripture' | 'altar'

const SURFACES: UpdateSurface[] = ['reflections', 'scripture', 'altar']
const EVENT = 'dayspring:surface-updates'
/** Cap the remembered list — the named arrival line collapses the rest to a count. */
const MAX_ITEMS = 8

export interface SurfaceUpdateItem {
  /** The spiritual block id — stable across edits, so re-commits dedupe. */
  id: string
  /** Human label shown in the arrival line ("John 3:16", a prayer's first words). */
  label: string
  ts: number
}

const keyFor = (surface: UpdateSurface) => `dayspring.updates.${surface}`

function read(surface: UpdateSurface): SurfaceUpdateItem[] {
  try {
    const raw = localStorage.getItem(keyFor(surface))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (i): i is SurfaceUpdateItem =>
        i && typeof i.id === 'string' && typeof i.label === 'string' && typeof i.ts === 'number',
    )
  } catch {
    return []
  }
}

function write(surface: UpdateSurface, items: SurfaceUpdateItem[]) {
  try {
    localStorage.setItem(keyFor(surface), JSON.stringify(items))
  } catch {
    /* private mode — updates just won't persist */
  }
}

export type UpdateMap = Record<UpdateSurface, SurfaceUpdateItem[]>

function computeSnapshot(): UpdateMap {
  const map = {} as UpdateMap
  for (const s of SURFACES) map[s] = read(s)
  return map
}

let snapshot = computeSnapshot()

function notify() {
  snapshot = computeSnapshot()
  window.dispatchEvent(new Event(EVENT))
}

/**
 * Remember a new item on a surface. No-op if the id is already pending (an edit
 * re-committing the same block must not re-flag it as new).
 */
export function recordSurfaceUpdate(surface: UpdateSurface, item: SurfaceUpdateItem) {
  const list = read(surface)
  if (list.some((i) => i.id === item.id)) return
  write(surface, [...list, item].slice(-MAX_ITEMS))
  track('surface_update_recorded', { surface })
  notify()
}

/** Read a surface's pending items without subscribing — for one-shot arrival capture. */
export function peekSurfaceUpdates(surface: UpdateSurface): SurfaceUpdateItem[] {
  return read(surface)
}

/** Mark a surface's updates as seen. Called once the arrival has been shown. */
export function clearSurfaceUpdates(surface: UpdateSurface) {
  if (read(surface).length === 0) return
  write(surface, [])
  notify()
}

function subscribe(onChange: () => void) {
  const onStorage = () => {
    snapshot = computeSnapshot()
    onChange()
  }
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** Live pending-update state per surface, for the rail and mobile bar. */
export function useSurfaceUpdates(): UpdateMap {
  return useSyncExternalStore(subscribe, () => snapshot)
}
