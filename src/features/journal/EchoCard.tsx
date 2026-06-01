import type { EchoCandidate } from '@/lib/echoes'

interface Props {
  echo: EchoCandidate
  onDismiss: () => void
}

function formatEchoDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD from the rollup
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function EchoCard({ echo, onDismiss }: Props) {
  return (
    <div className="echo-card" role="region" aria-label="A resonance from your journal">
      <p className="echo-card__text">{echo.text}</p>
      <time className="echo-card__date" dateTime={echo.entry_date}>
        {formatEchoDate(echo.entry_date)}
      </time>
      <button
        className="echo-card__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
