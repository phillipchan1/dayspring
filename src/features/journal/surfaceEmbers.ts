import { useSyncExternalStore } from 'react'
import { track } from '@/lib/analytics'

/**
 * Discovery embers — a faint warm dot on a Return destination (Ascent, Lamp,
 * Altar) the first time it holds something real: the first scripture citation
 * lights the Lamp, the first prayer lights the Altar, a finished backfill
 * lights all three. Strictly one-time: the first visit puts an ember out for
 * good, and a surface that's already been visited never lights again. The
 * point is a single quiet "there's something of yours in here now" — never a
 * recurring badge.
 *
 * State lives in localStorage so it survives restarts; a same-tab event keeps
 * every subscribed nav (rail, mobile bar) in sync without prop drilling.
 */

export type EmberSurface = 'reflections' | 'scripture' | 'altar'

const SURFACES: EmberSurface[] = ['reflections', 'scripture', 'altar']
const EVENT = 'dayspring:embers'

const keyFor = (surface: EmberSurface) => `dayspring.discovery.${surface}`

type DiscoveryState = 'lit' | 'visited' | null

function read(surface: EmberSurface): DiscoveryState {
  try {
    const v = localStorage.getItem(keyFor(surface))
    return v === 'lit' || v === 'visited' ? v : null
  } catch {
    return null
  }
}

function write(surface: EmberSurface, state: Exclude<DiscoveryState, null>) {
  try {
    localStorage.setItem(keyFor(surface), state)
  } catch {
    /* private mode — embers just won't persist */
  }
}

export type EmberMap = Record<EmberSurface, boolean>

function computeSnapshot(): EmberMap {
  const map = {} as EmberMap
  for (const s of SURFACES) map[s] = read(s) === 'lit'
  return map
}

let snapshot = computeSnapshot()

function notify() {
  snapshot = computeSnapshot()
  window.dispatchEvent(new Event(EVENT))
}

/** Light a surface's ember — no-op if it's already lit or ever visited. */
export function lightEmber(surface: EmberSurface) {
  if (read(surface) !== null) return
  write(surface, 'lit')
  track('ember_lit', { surface })
  notify()
}

/** Record a visit: puts the ember out and bars it from ever relighting. */
export function markSurfaceVisited(surface: EmberSurface) {
  const prev = read(surface)
  if (prev === 'visited') return
  write(surface, 'visited')
  if (prev === 'lit') track('ember_followed', { surface })
  notify()
}

/** True once the surface has been opened at least once on this device. */
export function hasVisitedSurface(surface: EmberSurface): boolean {
  return read(surface) === 'visited'
}

function subscribe(onChange: () => void) {
  // 'storage' covers a second tab/window flipping state.
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

/** Live ember state per surface, for the rail and mobile bar. */
export function useSurfaceEmbers(): EmberMap {
  return useSyncExternalStore(subscribe, () => snapshot)
}
