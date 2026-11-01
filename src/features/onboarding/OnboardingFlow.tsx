import { useCallback, useEffect, useRef, useState } from 'react'
import { track } from '@/lib/analytics'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useSettings } from '@/hooks/useSettings'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import { isLightTheme } from '@/lib/resolveTheme'
import { setOnboarded } from '@/lib/profile'
import { setSeedPrompt } from '@/lib/onboardingSeed'
import { WelcomeFlow } from '@/features/welcome/WelcomeFlow'
import { onboardingCopy as copy, pickOpeningPrompt } from './onboardingCopy'
import { ImportFlow } from './ImportFlow'
import { BackControl } from './BackControl'
import { PushStack, type PushDirection } from './PushStack'
import './Onboarding.css'
import { CURRENT_RELEASE_ID } from '@/features/firstlight/releases'

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
  // Which way the last step change went, so the screens push and pop like a
  // navigation stack instead of swapping in place.
  const [direction, setDirection] = useState<PushDirection>('forward')
  const goTo = useCallback((next: Step, dir: PushDirection = 'forward') => {
    setDirection(dir)
    setStep(next)
  }, [])
  // Inside the desktop import, Back can mean "choose a different file"; the
  // import says which, and this draws the one control for every step.
  const [importBack, setImportBack] = useState<(() => void) | null>(null)
  const onImportBackChange = useCallback((back: (() => void) | null) => setImportBack(() => back), [])
  const backToFork = useCallback(() => goTo('fork', 'back'), [goTo])
  const [finishing, setFinishing] = useState(false)
  // Carried from the fresh-start path into the editor as a gentle first prompt.
  const seedRef = useRef<string | undefined>(undefined)
  const { settings, update: updateSettings } = useSettings()
  const isMobile = useIsMobile()
  const isLight = isLightTheme(useResolvedTheme(settings))

  useEffect(() => {
    track('onboarding_step_viewed', { step })
  }, [step])

  const toggleTheme = useCallback(() => {
    updateSettings({ appearance: isLight ? 'dark' : 'light' })
  }, [isLight, updateSettings])

  // Persist onboarded_at, then hand back to the parent. Best-effort: even if the
  // write fails we still enter the app (localStorage guards a re-show).
  const finish = useCallback(async () => {
    if (finishing) return
    setFinishing(true)
    if (seedRef.current) setSeedPrompt(seedRef.current)
    // Someone who just arrived is caught up by definition — never tell a new
    // account "the entries list moved" about a list it never had. Stamped here
    // rather than at sign-up so it also covers the import path.
    if (CURRENT_RELEASE_ID) updateSettings({ lastSeenRelease: CURRENT_RELEASE_ID })
    try {
      await setOnboarded()
    } catch {
      /* non-fatal */
    }
    onFinish()
  }, [finishing, onFinish, updateSettings])

  const startFresh = useCallback(() => {
    track('onboarding_step_completed', { step: 'fresh' })
    seedRef.current = pickOpeningPrompt()
    void finish()
  }, [finish])

  const backAction =
    step === 'fork'
      ? () => goTo('tour', 'back')
      : step === 'fresh' || (step === 'import' && isMobile)
        ? backToFork
        : step === 'import'
          ? importBack
          : null

  return (
    <div className={`ob-root${isLight ? ' is-light' : ''}`}>
      <div className="ob-bg" aria-hidden />
      <div className="ob-glow" aria-hidden />

      {/* Theme toggle — present on the setup screens too (the carousel renders
          its own). Lets the user pick light/dark anywhere in onboarding. */}
      {step !== 'tour' && (
        <div className="ob-theme" role="group" aria-label="Appearance">
          <span className="ob-theme__pill" data-light={isLight} aria-hidden />
          <button
            type="button"
            className="ob-theme__opt"
            data-active={!isLight}
            aria-pressed={!isLight}
            aria-label="Dark"
            onClick={() => { if (isLight) toggleTheme() }}
          >
            <IconMoon />
          </button>
          <button
            type="button"
            className="ob-theme__opt"
            data-active={isLight}
            aria-pressed={isLight}
            aria-label="Light"
            onClick={() => { if (!isLight) toggleTheme() }}
          >
            <IconSun />
          </button>
        </div>
      )}

      {/* The welcome carousel is the front door — Begin/Skip lead INTO setup,
          not into the editor. */}
      {step === 'tour' && (
        <WelcomeFlow
          isLight={isLight}
          onToggleTheme={toggleTheme}
          onClose={() => {
            // Welcome's own Skip button — a genuine skip, distinct from Begin
            // even though both land on the same next step.
            track('onboarding_skipped', { step: 'tour' })
            goTo('fork')
          }}
          onBegin={() => {
            track('onboarding_step_completed', { step: 'tour' })
            goTo('fork')
          }}
        />
      )}

      {/* The way back lives in the top-leading corner, as a navigation bar
          keeps it — outside the moving screens, so it stays put while they
          push and pop. */}
      {backAction && <BackControl disabled={finishing} onBack={backAction} />}

      <main className="ob-column">
        {step !== 'tour' && (
          <PushStack
            screenKey={step}
            direction={direction}
            back={
              step === 'fork'
                ? { key: 'tour', go: () => goTo('tour', 'back') }
                : // Once an import has started there is no going back from it.
                  step === 'import' && !isMobile && !importBack
                  ? undefined
                  : { key: 'fork', go: backToFork, render: forkScreen }
            }
          >
            {step === 'fork' && forkScreen()}

            {/* Import parses a whole archive in memory. Settings refuses to offer
                that on a phone (ImportPanel.tsx) but this fork did not, so a
                first-run iPhone user could hand a multi-hundred-MB zip to the
                WKWebView. Same gate, same reason. */}
            {step === 'import' &&
              (isMobile ? (
                <div className="ob-screen">
                  <div className="ob-screen__body">
                    <h1 className="ob-title">{copy.importMobile.title}</h1>
                    <p className="ob-body">{copy.importMobile.body}</p>
                  </div>
                  <div className="ob-screen__foot">
                    <button
                      type="button"
                      className="ob-primary"
                      onClick={() => {
                        // The mobile fallback never offers a real import — this IS
                        // how the step resolves there, not a skip of it.
                        track('onboarding_step_completed', { step: 'import' })
                        void finish()
                      }}
                      disabled={finishing}
                    >
                      {copy.importMobile.cta}
                    </button>
                  </div>
                </div>
              ) : (
                <ImportFlow
                  onComplete={() => void finish()}
                  onBack={backToFork}
                  onBackChange={onImportBackChange}
                />
              ))}

            {step === 'fresh' && (
              <div className="ob-screen">
                <div className="ob-screen__body">
                  <h1 className="ob-title">{copy.fresh.title}</h1>
                  <p className="ob-body">{copy.fresh.body}</p>

                  <figure className="ob-example">
                    <figcaption className="ob-example__label">{copy.fresh.exampleLabel}</figcaption>
                    <p className="ob-example__text">{copy.fresh.example}</p>
                  </figure>
                </div>
                <div className="ob-screen__foot">
                  <button type="button" className="ob-primary" onClick={startFresh} disabled={finishing}>
                    {copy.fresh.primary}
                  </button>
                </div>
              </div>
            )}
          </PushStack>
        )}
      </main>
    </div>
  )

  /** The fork, drawn as its own screen and again under a swipe back to it. */
  function forkScreen() {
    return (
      <div className="ob-screen">
        <div className="ob-screen__body">
          <h1 className="ob-title">{copy.fork.title}</h1>
          <div className="ob-fork">
            <button
              type="button"
              className="ob-card"
              onClick={() => {
                track('onboarding_step_completed', { step: 'fork' })
                goTo('import')
              }}
            >
              <span className="ob-card__icon" aria-hidden>❧</span>
              <span className="ob-card__label">{copy.fork.veteran.label}</span>
              <span className="ob-card__sub">{copy.fork.veteran.sub}</span>
            </button>
            <button
              type="button"
              className="ob-card"
              onClick={() => {
                track('onboarding_step_completed', { step: 'fork' })
                goTo('fresh')
              }}
            >
              <span className="ob-card__icon" aria-hidden>✦</span>
              <span className="ob-card__label">{copy.fork.fresh.label}</span>
              <span className="ob-card__sub">{copy.fork.fresh.sub}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 14.3A8 8 0 1 1 9.7 4a6.3 6.3 0 0 0 10.3 10.3Z" />
    </svg>
  )
}
