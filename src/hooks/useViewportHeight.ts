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

export interface VisualViewportFrame {
  /**
   * How far the visible area's top sits below the *layout* viewport's top.
   *
   * Usually 0. On iOS it becomes non-zero when the soft keyboard opens and the
   * page is scrolled to keep the focused field in view — and that is the number
   * a full-screen overlay has to know about.
   */
  top: number
  height: number
}

/**
 * Where the visible area actually is, and how big it is.
 *
 * `position: fixed` on iOS is anchored to the LAYOUT viewport, not this one.
 * So an overlay pinned to `inset: 0` with a visual-viewport height ends up
 * `offsetTop` pixels too high the moment the keyboard scrolls the page: its top
 * slides up under the Dynamic Island, and its bottom stops the same distance
 * short of the keyboard, leaving a gap. Both symptoms, one cause. Drive the
 * overlay's `top` and `height` from this instead and it stays put.
 *
 * `scroll` matters as much as `resize` here: `offsetTop` changes on scroll
 * without the height changing at all.
 */
export function useVisualViewportFrame(): VisualViewportFrame | null {
  const read = (): VisualViewportFrame | null => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    return vv ? { top: vv.offsetTop, height: vv.height } : null
  }
  const [frame, setFrame] = useState<VisualViewportFrame | null>(read)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setFrame((prev) =>
        prev && prev.top === vv.offsetTop && prev.height === vv.height
          ? prev
          : { top: vv.offsetTop, height: vv.height },
      )
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return frame
}
