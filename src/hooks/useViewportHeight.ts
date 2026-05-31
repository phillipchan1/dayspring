import { useEffect, useState } from 'react'

/**
 * Tracks the *visual* viewport height in px, which shrinks when the mobile
 * keyboard opens. Use it as the app height so the bottom bar stays above the
 * keyboard. Returns null until measured (fall back to 100dvh in CSS).
 */
export function useViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(
    typeof window !== 'undefined' && window.visualViewport
      ? window.visualViewport.height
      : null,
  )

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => setHeight(vv.height)
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [])

  return height
}
