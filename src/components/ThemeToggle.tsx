import './ThemeToggle.css'

/**
 * Sun/moon segmented control for switching the app's light (Dawn) / dark theme.
 * Matches the welcome carousel + onboarding toggle. Pure presentational — the
 * caller owns `isLight` and flips it via `onToggle`.
 */
export function ThemeToggle({
  isLight,
  onToggle,
  className,
}: {
  isLight: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <div
      className={`theme-toggle${isLight ? ' is-light' : ''}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="Appearance"
    >
      <span className="theme-toggle__pill" data-light={isLight} aria-hidden />
      <button
        type="button"
        className="theme-toggle__opt"
        data-active={!isLight}
        aria-pressed={!isLight}
        aria-label="Dark"
        onClick={() => { if (isLight) onToggle() }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20 14.3A8 8 0 1 1 9.7 4a6.3 6.3 0 0 0 10.3 10.3Z" />
        </svg>
      </button>
      <button
        type="button"
        className="theme-toggle__opt"
        data-active={isLight}
        aria-pressed={isLight}
        aria-label="Light"
        onClick={() => { if (!isLight) onToggle() }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      </button>
    </div>
  )
}
