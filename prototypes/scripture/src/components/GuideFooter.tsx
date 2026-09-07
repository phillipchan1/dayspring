import { useLayoutEffect, useRef } from 'react'
import type { SceneId } from '../guide'
import { GUIDE_STEPS, guideFor } from '../guide'

interface Props {
  scene: SceneId
  onGo: (id: SceneId) => void
}

export function GuideFooter({ scene, onGo }: Props) {
  const current = guideFor(scene)
  const idx = GUIDE_STEPS.findIndex((s) => s.id === scene)
  const prev = idx > 0 ? GUIDE_STEPS[idx - 1] : null
  const next = idx < GUIDE_STEPS.length - 1 ? GUIDE_STEPS[idx + 1] : null
  const footerRef = useRef<HTMLElement>(null)

  // The footer is sticky and overlays the stage. Publish its height so panes
  // can size themselves to the space that's actually visible.
  useLayoutEffect(() => {
    const el = footerRef.current
    if (!el) return
    const publish = () => {
      document.documentElement.style.setProperty(
        '--guide-footer-h',
        `${Math.round(el.getBoundingClientRect().height)}px`,
      )
    }
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scene])

  return (
    <footer className="guide-footer" ref={footerRef}>
      <div className="guide-footer__inner">
        <p className="guide-footer__step">
          {current.step} of {GUIDE_STEPS.length}
        </p>
        <h2 className="guide-footer__title">{current.title}</h2>
        {current.action && <p className="guide-footer__action">{current.action}</p>}
        <p className="guide-footer__note">{current.note}</p>
        <nav className="guide-footer__nav" aria-label="Walkthrough">
          <button type="button" disabled={!prev} onClick={() => prev && onGo(prev.id)}>
            ← Previous
          </button>
          <button
            type="button"
            className="guide-footer__next"
            disabled={!next}
            onClick={() => next && onGo(next.id)}
          >
            {next ? (next.id === 'prefer' ? 'Pick your favorite →' : 'Next →') : 'Done'}
          </button>
        </nav>
      </div>
    </footer>
  )
}
