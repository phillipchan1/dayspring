import type { Hue, MarkingKind } from './corpus'

/**
 * A marking's hand.
 *
 * Drawn rather than iconified: these are meant to read as something a person
 * put on a page, not as UI. Each one is a stroke someone actually makes in a
 * margin — a rule, a brace, a bracket left open, a notch, a tick.
 *
 * No glyph rises. See kinds.ts.
 */
export function Glyph({
  kind,
  hue,
  size = 22,
  pencil,
}: {
  kind: MarkingKind
  hue?: Hue
  size?: number
  /** Drawn in graphite. The app put it there; it is not a marking yet. */
  pencil?: boolean
}) {
  const h = size
  const w = Math.round(size * 0.55)
  const common = {
    width: w,
    height: h,
    viewBox: '0 0 12 22',
    fill: 'none',
    className: 'glyph',
    'data-kind': kind,
    'data-pencil': pencil ? 'true' : undefined,
    'aria-hidden': true,
  } as const

  switch (kind) {
    // A gradient rule — the Lamp's ember→gold, so a verse speaks the same
    // language here that it does on the canon map.
    case 'scripture':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="g-scr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--scripture-gold))" />
              <stop offset="100%" stopColor="rgb(var(--scripture-ember))" />
            </linearGradient>
          </defs>
          <rect x="4.5" y="1" width="3" height="20" rx="1.5" fill="url(#g-scr)" />
        </svg>
      )

    // Warmth, not a flame and not a count. Borrowed from the Altar's language:
    // heft reads as thickness, and the glow is soft enough to have no edge.
    case 'prayer':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id="g-pray" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--k-prayer)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="var(--k-prayer)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="6" cy="11" r="6" fill="url(#g-pray)" />
          <circle cx="6" cy="11" r="2.4" fill="var(--k-prayer)" />
        </svg>
      )

    // A bracket that opens and does not close.
    case 'sense':
      return (
        <svg {...common}>
          <path
            d="M9 2 H4.2 A1.2 1.2 0 0 0 3 3.2 V18.8 A1.2 1.2 0 0 0 4.2 20 H6.6"
            stroke="var(--k-sense)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      )

    // The brace people actually draw beside a paragraph they want to keep.
    case 'story':
      return (
        <svg {...common}>
          <path
            d="M8.5 1.5 C5.5 1.5 6.6 9.4 3.4 11 C6.6 12.6 5.5 20.5 8.5 20.5"
            stroke="var(--k-story)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )

    /*
     * A ring left open. Desire is a reaching, so the stroke travels toward
     * something and does not close on it — and it travels sideways, because a
     * glyph that rose would be saying wanting more is better.
     */
    case 'desire':
      return (
        <svg {...common}>
          <path
            d="M8.6 7.4 A4.4 4.4 0 1 0 8.6 14.6"
            stroke="var(--k-desire)"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="10.4" cy="11" r="1.15" fill="var(--k-desire)" />
        </svg>
      )

    // A notch. Flat on purpose — nothing here rises.
    case 'learned':
      return (
        <svg {...common}>
          <path d="M2.5 11 H9.5" stroke="var(--k-learned)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M6 7.6 V14.4" stroke="var(--k-learned)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )

    // The plain mark: one gesture, no decision attached.
    case 'mark':
      return (
        <svg {...common}>
          <path d="M3.5 2 H8.5 V20 L6 16.6 L3.5 20 Z" fill="var(--k-mark)" />
        </svg>
      )

    case 'highlight':
      return (
        <svg {...common}>
          <rect
            x="2"
            y="6"
            width="8"
            height="10"
            rx="1.5"
            fill={`rgba(var(--hl-${hue ?? 'amber'}), 0.55)`}
          />
        </svg>
      )

    case 'underline':
      return (
        <svg {...common}>
          <path d="M2.5 9 H9.5" stroke="var(--k-ink)" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          <path d="M2 13.5 H10" stroke="var(--k-ink)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )

    case 'quote':
      return (
        <svg {...common}>
          <rect x="2" y="3" width="2" height="16" rx="1" fill="var(--k-ink)" opacity="0.55" />
          <path d="M7 7 H10 M7 11 H10 M7 15 H9" stroke="var(--k-ink)" strokeWidth="1.1" strokeLinecap="round" opacity="0.35" />
        </svg>
      )
  }
}
