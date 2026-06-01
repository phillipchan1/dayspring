import {
  dismissResurface,
  resurfaceBodyText,
  resurfaceDateLabel,
  resurfaceLeadCopy,
  type ResurfaceCard as ResurfaceCardData,
} from '@/lib/echoes'

interface Props {
  card: ResurfaceCardData
  onDismiss: () => void
}

export function ResurfaceCard({ card, onDismiss }: Props) {
  const lead = resurfaceLeadCopy(card)
  const body = resurfaceBodyText(card)
  const dateLabel = resurfaceDateLabel(card)

  async function handleNotNow() {
    try {
      await dismissResurface(card)
    } catch {
      // Still hide locally
    }
    onDismiss()
  }

  return (
    <div className="echo-card resurface-card" role="region" aria-label={lead}>
      <p className="echo-card__lead">{lead}</p>
      <p className="echo-card__text">{body}</p>
      {dateLabel && (
        <time className="echo-card__date" dateTime={dateLabel}>
          {dateLabel}
        </time>
      )}
      <button
        type="button"
        className="resurface-card__not-now"
        onClick={() => void handleNotNow()}
      >
        Not now
      </button>
    </div>
  )
}
