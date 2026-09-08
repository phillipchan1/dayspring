// The kind glyph — one geometric mark per Life Map list, and its COLOUR carries
// provenance.
//
// Its own file because two surfaces draw it now: the Life Map, and Pages' `look
// for` sheet, which groups its suggestions by these same four kinds. A second
// hand-drawn copy in Pages would be two sets of marks claiming to mean the same
// thing, and they would drift.
//
// Deliberately not a second icon beside the name. Every chip already has this
// glyph, so a wand or a sparkle would compete with the mark that says what a
// thing IS — and would say the word BRANDSCRIPT rules out ("AI-powered … it
// frightens this audience"). Amber on the glyph the chip already has costs
// nothing and reads at a glance across forty of them.

import type { SectionId } from './lifeMap'

export function Glyph({
  kind,
  found,
  className = 'lifemap__glyph',
}: {
  kind: SectionId
  found: boolean
  className?: string
}) {
  const c = found ? 'var(--dayspring-amber)' : 'var(--text-faint)'
  const common = { className, viewBox: '0 0 12 12', 'aria-hidden': true } as const
  switch (kind) {
    case 'person':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="3.4" fill={c} />
        </svg>
      )
    case 'place':
      return (
        <svg {...common}>
          <path d="M6 1.6 10 6 6 10.4 2 6Z" fill={c} />
        </svg>
      )
    case 'domain':
      return (
        <svg {...common}>
          <rect x="2.3" y="2.3" width="7.4" height="7.4" rx="1.2" fill={c} />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="3.6" fill="none" stroke={c} strokeWidth="1.4" strokeDasharray="2 1.6" />
        </svg>
      )
  }
}
