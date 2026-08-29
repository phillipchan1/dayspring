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

/** True on phone-width viewports. Drives the single-column mobile layout.
 *  Boundary kept at 767px so it matches the CSS breakpoints (max-width: 767px)
 *  used by the settings sheet, entry rows, etc. — otherwise an exactly-768px
 *  viewport (iPad portrait) gets the mobile shell with desktop-styled chrome. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}

/**
 * Touch-primary device — phone, or tablet without a fine pointer. With a Magic
 * Keyboard trackpad the pointer becomes fine, so iPad then behaves like desktop.
 */
export function useTouchPrimary(): boolean {
  const isMobile = useIsMobile()
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  return isMobile || coarsePointer
}
