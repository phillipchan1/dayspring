/**
 * The setup arc's way back: a chevron and "Back" in the top-leading corner,
 * where a navigation bar keeps it, instead of a "← Back" text link at the foot
 * of each screen that had to be scrolled to. The theme toggle moves to the
 * trailing corner to make room (Onboarding.css, `.ob-theme`).
 */
export function BackControl({ onBack, disabled = false }: { onBack: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="ob-back" onClick={onBack} disabled={disabled} aria-label="Back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 5l-7 7 7 7" />
      </svg>
      <span>Back</span>
    </button>
  )
}
