import { useSyncExternalStore } from 'react'

/** Reactive media-query match. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false, // SSR / no-window fallback
  )
}

/** True on phone-width viewports. Drives the single-column mobile layout. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)')
}
