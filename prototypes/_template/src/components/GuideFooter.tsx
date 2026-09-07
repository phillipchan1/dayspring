import type { SceneId } from '../guide'
import { GUIDE_STEPS } from '../guide'

export function GuideFooter({
  scene,
  onGo,
}: {
  scene: SceneId
  onGo: (id: SceneId) => void
}) {
  const idx = GUIDE_STEPS.findIndex((s) => s.id === scene)
  const step = GUIDE_STEPS[idx]
  const prev = idx > 0 ? GUIDE_STEPS[idx - 1] : null
  const next = idx < GUIDE_STEPS.length - 1 ? GUIDE_STEPS[idx + 1] : null

  if (!step || scene === 'prefer') return null

  return (
    <footer className="guide-footer">
      <p className="guide-footer__note">{step.note}</p>
      <div className="guide-footer__nav">
        <span className="guide-footer__step">
          {step.step} / {GUIDE_STEPS.length}
        </span>
        <div className="guide-footer__buttons">
          {prev ? (
            <button type="button" className="guide-footer__btn" onClick={() => onGo(prev.id)}>
              Previous
            </button>
          ) : (
            <span />
          )}
          {next ? (
            <button type="button" className="guide-footer__btn guide-footer__btn--primary" onClick={() => onGo(next.id)}>
              Next
            </button>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
