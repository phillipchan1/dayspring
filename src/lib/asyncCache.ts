/** In-memory cache for heavy surface reads — survives React unmounts. */

type Entry<T> = { value: T; at: number }

const store = new Map<string, Entry<unknown>>()

export function windowCacheKey(window?: { from?: Date; to?: Date }): string {
  const f = window?.from?.toISOString() ?? ''
  const t = window?.to?.toISOString() ?? ''
  return f || t ? `${f}|${t}` : 'all'
}

export function getCache<T>(key: string): T | undefined {
  return store.get(key)?.value as T | undefined
}

export function setCache<T>(key: string, value: T): void {
  store.set(key, { value, at: Date.now() })
}

/** Keys currently held under a prefix. Lets a reader ask "is a WIDER window
 *  already cached?" and slice that in memory instead of re-reading the table. */
export function cacheKeysWithPrefix(prefix: string): string[] {
  const out: string[] = []
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) out.push(key)
  }
  return out
}

export function invalidateCache(key: string): void {
  store.delete(key)
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

let generation = 0
const onClear = new Set<() => void>()

/** Thrown when a read outlives the owner it started under. */
export class CacheOwnerChangedError extends Error {
  constructor() {
    super('cache owner changed mid-read')
    this.name = 'CacheOwnerChangedError'
  }
}

/** Guard the tail of an async read: capture `cacheGeneration()` before going to
 *  the network, then call this before caching or returning the rows. If the
 *  cache was scrubbed while the read was in flight, the rows belong to the
 *  previous owner and must not land in this session. */
export function cacheGeneration(): number {
  return generation
}

export function assertSameOwner(gen: number): void {
  if (gen !== generation) throw new CacheOwnerChangedError()
}

/** Run `fn` whenever the cache is scrubbed — for module state that mirrors it
 *  (in-flight reads, memoized promises) and has to be dropped alongside it. */
export function onCacheCleared(fn: () => void): void {
  onClear.add(fn)
}

/** Drop every cached surface read — used on sign-out / owner switch so one
 *  account's altar/ascent content can't surface under another's session. */
export function clearAllCache(): void {
  store.clear()
  generation++
  for (const fn of onClear) fn()
}
