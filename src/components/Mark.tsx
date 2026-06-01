import type { CSSProperties } from 'react'

interface MarkProps {
  /** Square edge length in px. */
  size?: number
  className?: string
  style?: CSSProperties
}

/**
 * The Dayspring sunrise mark: a sun cresting the horizon with a few rays.
 * Drawn in the active accent (`--accent`) so it warms with the theme.
 */
export function Mark({ size = 22, className, style }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {/* sun cresting the horizon */}
      <path d="M5 17a7 7 0 0 1 14 0" fill="var(--accent)" />
      {/* rays */}
      <g stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 3v3" />
        <path d="M4.4 7.4l2.1 2.1" />
        <path d="M19.6 7.4l-2.1 2.1" />
        {/* horizon */}
        <path d="M2.5 17h19" />
      </g>
    </svg>
  )
}

interface BrandProps {
  /** Mark edge length in px; the wordmark scales alongside it. */
  size?: number
  /** Wordmark font size in rem. */
  wordmarkRem?: number
  /** Hide the sunrise mark, leaving the wordmark only (e.g. when the nav rail
   *  already shows the mark and a second one would be redundant). */
  showMark?: boolean
  className?: string
  style?: CSSProperties
}

/** Mark + the "Dayspring" wordmark in Fraunces — the shared brand lockup. */
export function Brand({ size = 22, wordmarkRem = 1.15, showMark = true, className, style }: BrandProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', ...style }}
    >
      {showMark && <Mark size={size} />}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: `${wordmarkRem}rem`,
          letterSpacing: '-0.01em',
          color: 'var(--text-bright)',
          lineHeight: 1,
        }}
      >
        Dayspring
      </span>
    </span>
  )
}
