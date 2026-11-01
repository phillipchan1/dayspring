import { useLayoutEffect, useRef } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useEdgeSwipeBack } from '@/features/pages/edgeSwipe'

/**
 * A volume, pushed over what it was opened from.
 *
 * It used to replace the shelf in place: the same scroller, re-filled, so a
 * volume opened from four rows down the shelf opened four rows down itself
 * (the scroll position leaked across), and coming back put you at the top of
 * a shelf you had scrolled. And it arrived the way nothing on a phone arrives
 * — by swapping, with a text link as the only way back.
 *
 * Now it is a pushed view, the reader's twin: a layer over the shelf (or the
 * wall, when a ribbon on the wall opened it), in from the right on a phone,
 * back out to the right with an edge swipe. What is underneath stays mounted
 * and keeps its place for free, and is made inert while covered.
 *
 * The layer writes `--vol-out` onto its parent, the way the reader writes
 * `--pg-out`, so the view underneath parallaxes with it (Volumes.css).
 */
export function VolumePush({
  onBack,
  children,
}: {
  /** Up one level: the shelf, or the pages the volume was opened from. */
  onBack: () => void
  children: React.ReactNode
}) {
  const touch = useMediaQuery('(pointer: coarse)')
  const back = useEdgeSwipeBack({ onBack, enabled: touch })
  const layerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    layerRef.current?.parentElement?.style.setProperty('--vol-out', String(back.out))
  }, [back.out])

  /*
   * What is underneath can be neither clicked nor tabbed into while covered.
   * Written on the siblings directly because they are other components' roots
   * (the wall, the shelf) and keep their place in the tree — wrapping them to
   * hand down a prop would remount them, which is exactly the scroll position
   * this layer exists to keep. Only the siblings present on arrival: the
   * reader, if a page is opened from here, mounts later and stays live.
   */
  useLayoutEffect(() => {
    const layer = layerRef.current
    const host = layer?.parentElement
    if (!layer || !host) return
    const covered = [...host.children].filter(
      (el): el is HTMLElement => el !== layer && el instanceof HTMLElement && !el.inert,
    )
    for (const el of covered) el.inert = true
    return () => {
      for (const el of covered) el.inert = false
      host.style.removeProperty('--vol-out')
    }
  }, [])

  return (
    <div
      ref={layerRef}
      className="vol-push"
      data-dragging={back.dragging ? 'true' : undefined}
      data-leaving={back.leaving ? 'true' : undefined}
      style={{ ['--vol-out']: back.out } as React.CSSProperties}
      {...back.handlers}
    >
      <div
        className="vol-push__slide"
        style={back.dragX && !back.leaving ? { transform: `translateX(${back.dragX}px)` } : undefined}
      >
        {children}
      </div>
    </div>
  )
}
