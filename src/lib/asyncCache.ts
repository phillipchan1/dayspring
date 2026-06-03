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

export function invalidateCache(key: string): void {
  store.delete(key)
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
