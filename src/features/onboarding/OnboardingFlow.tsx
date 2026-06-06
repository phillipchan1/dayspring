import { useCallback, useState } from 'react'
import { useSettings } from '@/hooks/useSettings'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import { setOnboarded } from '@/lib/profile'
import { setSeedPrompt } from '@/lib/onboardingSeed'
import { WelcomeFlow } from '@/features/welcome/WelcomeFlow'
import { onboardingCopy as copy, pickOpeningPrompt } from './onboardingCopy'
import { ImportFlow } from './ImportFlow'
import './Onboarding.css'

type Step = 'welcome' | 'fork' | 'import' | 'fresh'

interface Props {
  /** Called once onboarded_at is persisted; the parent re-reads and routes to
   *  the editor. */
  onFinish: () => void
}

/**
 * The first-run experience: Welcome → Fork → (Import path | Fresh-start path).
 * Completing EITHER path — or the low-emphasis "Skip for now" link — stamps
 * onboarded_at so it never reappears. Nothing here gates on entitlement: the
 * whole flow runs inside the already-active in-app trial.
 */
export function OnboardingFlow({ onFinish }: Props) {
  const [step, setStep] = useState<Step>('welcome')
  const [showTour, setShowTour] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const { settings, update: updateSettings } = useSettings()
  const isLight = useResolvedTheme(settings) === 'dawn'

  const toggleTheme = useCallback(() => {
    updateSettings({ appearance: isLight ? 'dark' : 'light' })
  }, [isLight, updateSettings])

  // Persist onboarded_at, then hand back to the parent. Best-effort: even if the
  // write fails we still enter the app (localStorage guards a re-show).
  const finish = useCallback(
    async (seed?: string) => {
      if (finishing) return
      setFinishing(true)
      if (seed) setSeedPrompt(seed)
      try {
        await setOnboarded()
      } catch {
        /* non-fatal */
      }
      onFinish()
    },
    [finishing, onFinish],
  )

  const skip = useCallback(() => void finish(), [finish])

  return (
    <div className="ob-root">
      <div className="ob-bg" aria-hidden />
      <div className="ob-glow" aria-hidden />

      <main className="ob-column">
        {step === 'welcome' && (
          <div className="ob-screen ob-fade-in">
            <h1 className="ob-title ob-title--hero">{copy.welcome.title}</h1>
            <p className="ob-body">{copy.welcome.body}</p>
            <button type="button" className="ob-primary" onClick={() => setStep('fork')}>
              {copy.welcome.primary}
            </button>
            <button type="button" className="ob-tertiary" onClick={() => setShowTour(true)}>
              {copy.welcome.tour}
            </button>
          </div>
        )}

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

            <button
              type="button"
              className="ob-primary"
              onClick={() => void finish(pickOpeningPrompt())}
            >
              {copy.fresh.primary}
            </button>
          </div>
        )}

        {/* Hidden escape hatch — only on Welcome and Fork. */}
        {(step === 'welcome' || step === 'fork') && (
          <button type="button" className="ob-skip" onClick={skip} disabled={finishing}>
            {copy.skip}
          </button>
        )}
      </main>

      {/* Folded-in product tour — the existing Welcome carousel, reused as an
          optional step. Closing or finishing it returns to the flow. */}
      {showTour && (
        <WelcomeFlow
          isLight={isLight}
          onToggleTheme={toggleTheme}
          onClose={() => setShowTour(false)}
          onBegin={() => setShowTour(false)}
        />
      )}
    </div>
  )
}
