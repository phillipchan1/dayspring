import { useEffect, useRef } from 'react'
import { periodName, type Grain, type Span } from '@/lib/period'
import { PillSet } from './PillSet'

/**
 * THE WHEN — one control, one place, in every room.
 *
 * Before this, the time a room was lit for was chosen in eight places across
 * four rooms: the Altar's pills at the top right, the Lamp's chips at the top
 * left, presets centred under Pages' band, and on the Ascent a rail down the
 * left, buttons at its foot, month pills, year tabs and a pair of buttons at
 * the bottom of the page. Same question, eight answers.
 *
 * Now it is this, always at the right end of the room's bar (and on a phone,
 * the first row under the room's title):
 *
 *   ‹  Fall 2026  ›  |  Week  Month  Season  Year  All
 *
 * The grains run smallest to largest, All last, in every room. A grain a room
 * cannot show is left out rather than greyed out (Pages has no Week — its band
 * is months; the Ascent has no All — a climb needs a height). The stepper walks
 * whole calendar periods back and forth, and names each one the way a calendar
 * would (`periodName`).
 */

const ORDER: Span[] = ['week', 'month', 'season', 'year', 'all']
const WORD: Record<Span, string> = { week: 'Week', month: 'Month', season: 'Season', year: 'Year', all: 'All' }

/** How far back the ‹ walks by default: a long archive, never an endless one. */
const DEFAULT_MAX: Record<Grain, number> = { week: 104, month: 60, season: 40, year: 30 }

/** True when focus is in a text field — so the When's keys never take typing. */
function inTextField(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
}

export interface WhenControlProps {
  /** The spans this room can show. Drawn in the one order whatever order they come in. */
  spans: Span[]
  /** The lit span, or null when what is showing is a bracket no grain names. */
  span: Span | null
  /** Periods back from the current one (0 = this week / month / season / year). */
  offset: number
  onSpan: (span: Span) => void
  onOffset: (offset: number) => void
  /** How far back the ‹ may go for a grain, inclusive. */
  maxOffset?: (grain: Grain) => number
  /** What the period reads when no grain names it: "All time", a dragged bracket. */
  label?: string
  /** `bar`: inline at the bar's right end. `row`: full width, a finger's size. */
  layout?: 'bar' | 'row'
  /** ⌥← ⌥→ step the period, ⌥↑ ⌥↓ change the grain. On for the bar instance. */
  keys?: boolean
  /** The day periods are counted from. Defaults to now; the Ascent anchors on the writer's own day. */
  now?: Date
}

export function WhenControl({
  spans,
  span,
  offset,
  onSpan,
  onOffset,
  maxOffset,
  label,
  layout = 'bar',
  keys = false,
  now,
}: WhenControlProps) {
  const shown = ORDER.filter((s) => spans.includes(s))
  const grain: Grain | null = span && span !== 'all' ? span : null
  const max = grain ? (maxOffset ? maxOffset(grain) : DEFAULT_MAX[grain]) : 0
  const earlierOff = !grain || offset >= max
  const laterOff = !grain || offset <= 0
  const period = grain ? periodName(grain, offset, now) : (label ?? 'All time')
  const root = useRef<HTMLDivElement>(null)

  // Latest values for the key handler, so it can be bound once.
  const latest = useRef({ shown, span, offset, earlierOff, laterOff, onSpan, onOffset })
  latest.current = { shown, span, offset, earlierOff, laterOff, onSpan, onOffset }

  useEffect(() => {
    if (!keys) return
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return
      // Something under focus already took the key (a page card on the wall
      // moves between pages on ←/→, with or without ⌥).
      if (e.defaultPrevented || inTextField()) return
      // A room kept alive behind a cross-fade must not answer for the one in front.
      if (!root.current || root.current.offsetParent === null) return
      const l = latest.current
      if (e.key === 'ArrowLeft' && !l.earlierOff) {
        e.preventDefault()
        l.onOffset(l.offset + 1)
      } else if (e.key === 'ArrowRight' && !l.laterOff) {
        e.preventDefault()
        l.onOffset(l.offset - 1)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const at = l.span ? l.shown.indexOf(l.span) : -1
        const next = l.shown[e.key === 'ArrowUp' ? at + 1 : at - 1]
        if (next) {
          e.preventDefault()
          l.onSpan(next)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keys])

  const word = grain ? WORD[grain].toLowerCase() : 'period'
  const stepper = (
    <div className="when__step">
      <button
        type="button"
        className="when__arrow"
        aria-label={`Earlier ${word}`}
        title={keys ? `Earlier ${word} (⌥←)` : undefined}
        disabled={earlierOff}
        onClick={() => onOffset(offset + 1)}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
          <path d="m10 3-5 5 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="when__period" aria-live="polite">
        {period}
      </span>
      <button
        type="button"
        className="when__arrow"
        aria-label={`Later ${word}`}
        title={keys ? `Later ${word} (⌥→)` : undefined}
        disabled={laterOff}
        onClick={() => onOffset(offset - 1)}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
          <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
  const grains = (
    <PillSet
      label="When"
      className="when__grains"
      options={shown.map((s) => ({ key: s, label: WORD[s] }))}
      value={span}
      onChange={onSpan}
    />
  )

  return (
    <div className={`when when--${layout}`} ref={root}>
      {layout === 'row' ? (
        <>
          {grains}
          {stepper}
        </>
      ) : (
        <>
          {stepper}
          <span className="when__rule" aria-hidden />
          {grains}
        </>
      )}
    </div>
  )
}
