import { useEffect, useState } from 'react'

/**
 * Height of the soft keyboard (plus any bottom browser chrome) in px, derived
 * from the visual viewport. Lets bottom-docked UI sit directly above the
 * keyboard instead of behind it. Returns 0 on desktop / when idle.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setInset(0)
      return
    }
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])
  return inset
}

/**
 * True when the soft keyboard is (almost certainly) open. The 120px floor
 * filters out URL-bar collapse and small chrome shifts — real keyboards are
 * ~250px+. Drives the contextual bottom bar (commands while typing, nav while
 * idle), mirroring how Notes/Bear/iA Writer let the keyboard "cover" the tab bar.
 */
export function useKeyboardOpen(enabled = true): boolean {
  return useKeyboardInset(enabled) > 120
}
