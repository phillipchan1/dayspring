import { useCallback, useRef, useState } from 'react'
import { useSettings } from '@/hooks/useSettings'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import { setOnboarded } from '@/lib/profile'
import { setSeedPrompt } from '@/lib/onboardingSeed'
import { WelcomeFlow } from '@/features/welcome/WelcomeFlow'
import { onboardingCopy as copy, pickOpeningPrompt } from './onboardingCopy'
import { ImportFlow } from './ImportFlow'
import './Onboarding.css'

type Step = 'tour' | 'fork' | 'import' | 'fresh'

interface Props {
  /** Called once onboarded_at is persisted; the parent re-reads and routes to
   *  the editor. */
  onFinish: () => void
}

/**
 * The first-run experience, as ONE styled arc:
 *   Welcome carousel (the vision + the surfaces) → Setup fork → (Import | Fresh)
 *   → editor.
 * The carousel is the front door — the beautiful first thing a new user sees —
 * not a redundant tour bolted onto a plain welcome. Reaching the editor stamps
 * onboarded_at. Nothing gates on entitlement; the whole flow runs inside the
 * already-active in-app trial.
 */
export function OnboardingFlow({ onFinish }: Props) {
  const [step, setStep] = useState<Step>('tour')
  const [finishing, setFinishing] = useState(false)
  // Carried from the fresh-start path into the editor as a gentle first prompt.
  const seedRef = useRef<string | undefined>(undefined)
  const { settings, update: updateSettings } = useSettings()
  const isLight = useResolvedTheme(settings) === 'dawn'

  const toggleTheme = useCallback(() => {
    updateSettings({ appearance: isLight ? 'dark' : 'light' })
  }, [isLight, updateSettings])

  // Persist onboarded_at, then hand back to the parent. Best-effort: even if the
  // write fails we still enter the app (localStorage guards a re-show).
  const finish = useCallback(async () => {
    if (finishing) return
    setFinishing(true)
    if (seedRef.current) setSeedPrompt(seedRef.current)
    try {
      await setOnboarded()
    } catch {
      /* non-fatal */
    }
    onFinish()
  }, [finishing, onFinish])

  const startFresh = useCallback(() => {
    seedRef.current = pickOpeningPrompt()
    void finish()
  }, [finish])

  return (
    <div className={`ob-root${isLight ? ' is-light' : ''}`}>
      <div className="ob-bg" aria-hidden />
      <div className="ob-glow" aria-hidden />

      {/* The welcome carousel is the front door — Begin/Skip lead INTO setup,
          not into the editor. */}
      {step === 'tour' && (
        <WelcomeFlow
          isLight={isLight}
          onToggleTheme={toggleTheme}
          onClose={() => setStep('fork')}
          onBegin={() => setStep('fork')}
        />
      )}

      <main className="ob-column">
        {step === 'fork' && (
          <div className="ob-screen ob-fade-in">
            <h1 className="ob-title">{copy.fork.title}</h1>
            <div className="ob-fork">
              <button type="button" className="ob-card" onClick={() => setStep('import')}>
                <span className="ob-card__icon" aria-hidden>❧</span>
                <span className="ob-card__label">{copy.fork.veteran.label}</span>
                <span className="ob-card__sub">{copy.fork.veteran.sub}</span>
              </button>
              <button type="button" className="ob-card" onClick={() => setStep('fresh')}>
                <span className="ob-card__icon" aria-hidden>✦</span>
                <span className="ob-card__label">{copy.fork.fresh.label}</span>
                <span className="ob-card__sub">{copy.fork.fresh.sub}</span>
              </button>
            </div>
            <button type="button" className="ob-tertiary" onClick={() => setStep('tour')}>
              ← Back to the welcome
            </button>
          </div>
        )}

        {step === 'import' && (
          <ImportFlow onComplete={() => void finish()} onBack={() => setStep('fork')} />
        )}

        {step === 'fresh' && (
          <div className="ob-screen ob-fade-in">
            <h1 className="ob-title">{copy.fresh.title}</h1>
            <p className="ob-body">{copy.fresh.body}</p>

            <figure className="ob-example">
              <figcaption className="ob-example__label">{copy.fresh.exampleLabel}</figcaption>
              <p className="ob-example__text">{copy.fresh.example}</p>
            </figure>

            <button type="button" className="ob-primary" onClick={startFresh} disabled={finishing}>
              {copy.fresh.primary}
            </button>
            <button type="button" className="ob-tertiary" onClick={() => setStep('fork')}>
              ← Back
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
