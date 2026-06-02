import { Brand } from '@/components/Mark'
import './Paywall.css'

interface Props {
  variant: 'trial' | 'resubscribed'
  onDismiss: () => void
}

export function TrialWelcome({ variant, onDismiss }: Props) {
  const isTrial = variant === 'trial'

  return (
    <div className="trial-welcome">
      <div className="trial-welcome__bg-glow" aria-hidden />

      <div className="trial-welcome__motif" aria-hidden>
        <svg viewBox="0 0 400 220" className="tw-svg" preserveAspectRatio="xMidYMax meet">
          <defs>
            <radialGradient id="tw-sun-grad" cx="50%" cy="100%" r="80%">
              <stop offset="0%" stopColor="#f4cd8a" stopOpacity="1" />
              <stop offset="35%" stopColor="#e8b873" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#e8b873" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="200" cy="220" rx="200" ry="160" fill="url(#tw-sun-grad)" />
          <line x1="0" y1="184" x2="400" y2="184" stroke="rgba(244,205,138,.2)" strokeWidth="1" />
          <circle cx="200" cy="220" r="52" fill="#f4cd8a" opacity="0.88" className="tw-core" />
          {Array.from({ length: 11 }).map((_, i) => {
            const angle = (Math.PI / 10) * (i - 5) - Math.PI / 2
            return (
              <line
                key={i}
                x1="200" y1="220"
                x2={200 + Math.cos(angle) * 170}
                y2={220 + Math.sin(angle) * 170}
                stroke="rgba(244,205,138,.15)"
                strokeWidth="1"
                className="tw-ray"
                style={{ animationDelay: `${i * 0.08}s` }}
              />
            )
          })}
        </svg>
      </div>

      <div className="trial-welcome__content">
        <div className="trial-welcome__mark">
          <Brand size={30} wordmarkRem={1.8} />
        </div>

        <p className="trial-welcome__eyebrow">
          {isTrial ? 'WELCOME TO DAYSPRING' : 'WELCOME BACK'}
        </p>

        <h1 className="trial-welcome__headline">
          {isTrial ? "You're in." : 'Your journal is here.'}
        </h1>

        <p className="trial-welcome__body">
          {isTrial
            ? 'The slow work begins now. 14 days free — your first entry is waiting.'
            : "Everything you've written is right where you left it. Welcome home."}
        </p>

        <button className="trial-welcome__cta" onClick={onDismiss}>
          {isTrial ? 'Begin writing' : 'Continue writing'}
          <span aria-hidden="true"> →</span>
        </button>
      </div>
    </div>
  )
}
