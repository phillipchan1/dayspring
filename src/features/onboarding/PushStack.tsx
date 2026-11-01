import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { prefersReducedMotion } from '@/hooks/usePresence'
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss'

/**
 * How one setup screen hands over to the next.
 *
 * `forward` and `back` are a navigation push and pop: the new screen comes in
 * from the right edge while the old one moves a third of the way left and
 * fades (and the reverse on the way back), at `--dur-push` on `--ease-ios`.
 * `fade` is for a screen that is not a place you navigate to — the import's
 * progress, the reveal — and simply replaces the last.
 */
export type PushDirection = 'forward' | 'back' | 'fade'

/** A touch this close to the left edge can be a swipe back (UIKit's edge pan). */
const EDGE_PX = 24

/** Longer than `--dur-push`; only for when `animationend` never comes. */
const SETTLE_FALLBACK_MS = 480

interface Leaving {
  key: string
  node: ReactNode
  dir: PushDirection
  /** Set when a swipe already carried it part of the way: where it starts. */
  fromX?: number | undefined
}

interface Entering {
  dir: PushDirection | 'appear'
  /** Set when a swipe already revealed it: how far it had come (0–1). */
  progress?: number | undefined
}

export function PushStack({
  screenKey,
  direction,
  back,
  children,
}: {
  /** Identity of the screen showing now; a change is a transition. */
  screenKey: string
  /** How the change that produced `screenKey` should move. */
  direction: PushDirection
  /**
   * Where an edge swipe goes. `render` draws that screen underneath while the
   * finger is down, so the swipe reveals what it is going back to; without it
   * the swipe still works and reveals the ground.
   */
  back?: { key: string; go: () => void; render?: () => ReactNode } | undefined
  children: ReactNode
}) {
  const lastChildren = useRef<ReactNode>(children)
  const [shownKey, setShownKey] = useState(screenKey)
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  const [entering, setEntering] = useState<Entering | null>({ dir: 'appear' })
  /** Where the finger let go, when a swipe is what changed the screen. */
  const swiped = useRef<{ x: number; progress: number } | null>(null)
  const lastDrag = useRef(0)

  // The screen changed: keep the old one up, leaving, until it has gone.
  // Derived during render so the first frame of the new screen already has the
  // old one beside it — no frame with neither.
  if (shownKey !== screenKey) {
    const still = prefersReducedMotion()
    // Read here, cleared after commit (below): StrictMode renders twice, and
    // a ref emptied in the first pass would be gone in the second.
    const fromSwipe = swiped.current
    setShownKey(screenKey)
    if (fromSwipe) {
      setLeaving({ key: shownKey, node: lastChildren.current, dir: 'back', fromX: fromSwipe.x })
      setEntering({ dir: 'back', progress: fromSwipe.progress })
    } else {
      setLeaving({ key: shownKey, node: lastChildren.current, dir: still ? 'fade' : direction })
      setEntering({ dir: still ? 'fade' : direction })
    }
  }

  useLayoutEffect(() => {
    lastChildren.current = children
  })

  useLayoutEffect(() => {
    swiped.current = null
  }, [shownKey])

  // If an animation never reports its end, don't leave a ghost screen behind.
  useEffect(() => {
    if (!leaving && !entering) return
    const t = window.setTimeout(() => {
      setLeaving(null)
      setEntering(null)
    }, SETTLE_FALLBACK_MS)
    return () => window.clearTimeout(t)
  }, [leaving, entering])

  const swipe = useSwipeToDismiss({
    enabled: back != null && leaving == null,
    onDismiss: () => {
      const w = typeof window === 'undefined' ? 0 : window.innerWidth
      swiped.current = { x: lastDrag.current, progress: w ? Math.min(1, lastDrag.current / w) : 0 }
      back?.go()
    },
  })
  if (swipe.dragging) lastDrag.current = swipe.dragX

  const width = typeof window === 'undefined' ? 1 : window.innerWidth || 1
  const progress = swipe.dragging ? Math.min(1, swipe.dragX / width) : 0

  type Layer = { key: string; node: ReactNode; role: 'current' | 'leaving' | 'under' }
  const layers: Layer[] = [{ key: screenKey, node: children, role: 'current' }]
  if (leaving && leaving.key !== screenKey) layers.push({ key: leaving.key, node: leaving.node, role: 'leaving' })
  if (swipe.dragging && back && back.key !== screenKey) {
    layers.push({ key: back.key, node: back.render?.() ?? null, role: 'under' })
  }
  // A stable DOM order (by key), with stacking done by z-index: moving a node
  // in the DOM restarts its animation, and the screen that was underneath a
  // swipe becomes the current one in place.
  layers.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  return (
    <div
      className="ob-push"
      onTouchStart={(e) => {
        const t = e.touches[0]
        if (!t || !('onTouchStart' in swipe.handlers)) return
        const edge = EDGE_PX + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-left')) || 0)
        if (t.clientX > edge) return
        // An inner stack with somewhere to go back to takes the edge first.
        e.stopPropagation()
        swipe.handlers.onTouchStart(e)
      }}
    >
      {layers.map((layer) => {
        if (layer.role === 'under') {
          return (
            <div
              key={`layer:${layer.key}`}
              className="ob-push__layer"
              data-role="under"
              aria-hidden
              inert
              style={{ transform: `translateX(${-30 * (1 - progress)}%)`, opacity: 0.35 + 0.65 * progress }}
            >
              {layer.node}
            </div>
          )
        }
        if (layer.role === 'leaving' && leaving) {
          return (
            <div
              key={`layer:${layer.key}`}
              className="ob-push__layer"
              data-role="leaving"
              data-leave={leaving.dir}
              aria-hidden
              inert
              style={leaving.fromX != null ? ({ '--ob-from': `${leaving.fromX}px` } as CSSProperties) : undefined}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) setLeaving(null)
              }}
            >
              {layer.node}
            </div>
          )
        }
        const style: CSSProperties & Record<string, string> = {}
        if (swipe.dragging) style.transform = `translateX(${swipe.dragX}px)`
        if (entering?.progress != null) {
          style['--ob-from'] = `${-30 * (1 - entering.progress)}%`
          style['--ob-from-opacity'] = String(0.35 + 0.65 * entering.progress)
        }
        return (
          <div
            key={`layer:${layer.key}`}
            className="ob-push__layer"
            data-role="current"
            data-enter={entering?.dir}
            data-dragging={swipe.dragging || undefined}
            style={style}
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) setEntering(null)
            }}
          >
            {layer.node}
          </div>
        )
      })}
    </div>
  )
}
