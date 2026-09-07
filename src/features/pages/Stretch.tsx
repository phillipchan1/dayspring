import { useMemo, useRef, useState } from 'react'
import type { Entry } from '@/lib/types'
import { bandFor, cellLabel, spanFrom, spanText, type Span } from './band'

/**
 * THE STRETCH — the archive's own months, and a way to bracket them.
 *
 * ── Why a time filter belongs on this surface at all ────────────────────────
 *
 * Because the answer to "what do I write about" is different in 2019 than it is
 * now, and a subject list counted over eleven years flattens that into one
 * average nobody ever lived. Bracket a stretch and the counts beside every
 * subject become counts for THAT stretch — a name that filled one winter and
 * nothing else stops reading as a footnote.
 *
 * ── The line it must not cross ──────────────────────────────────────────────
 *
 * "The subjects that dominated 2019" is a ranked list of what mattered to
 * someone in a year of their life, which is a verdict rendered as a sort
 * (`readings.ts`, D-016). So bracketing changes nothing about ORDER. Subjects
 * stay in the order they always were — first appearance, never count — and all
 * that moves is the number beside each one, and whether it is zero. That is
 * arithmetic about a span of text. The reading of it is the writer's.
 *
 * ── And no vertical axis, the same as every other band ──────────────────────
 *
 * Every cell is the same size; only its warmth changes (Principle 1). A bar
 * chart of pages-per-month would be a productivity graph of somebody's prayer
 * life, and a thin month in it would read as a failure rather than as a busy
 * fortnight at work.
 */
/**
 * The spans worth one press.
 *
 * Months, because the band's cells are months — a "last 30 days" that did not
 * line up with a cell would bracket something the timeline cannot show.
 */
const RECENT: { label: string; months: number }[] = [
  { label: '1m', months: 1 },
  { label: '6m', months: 6 },
  { label: '1y', months: 12 },
]

export function Stretch({
  entries,
  months,
  span,
  onSpan,
  caption,
}: {
  /** The whole archive — the band always spans it, bracket or no bracket. */
  entries: Entry[]
  /** The shared month list, so this band and the subject bands line up. */
  months: { year: number; month: number }[]
  span: Span | null
  onSpan: (next: Span | null) => void
  /**
   * How many pages are on the wall — said here rather than on a line of its own.
   *
   * "1,983 pages" left-aligned above a grid is a result count, and a result
   * count above a grid is a dashboard. Between the two years of a timeline it
   * is a caption on the thing it describes, and the header loses a whole band
   * of chrome for it.
   */
  caption: string
}) {
  const band = useMemo(() => bandFor('all', 'your pages', entries, months), [entries, months])
  /*
   * The anchor a drag started on, in a ref rather than state.
   *
   * The pointerdown and the first pointermove can land in the same tick, so a
   * state anchor is still null when the move reads it and the first part of
   * every brush is lost. Same reason the year rail keeps its own flag in a ref.
   */
  const anchor = useRef<number | null>(null)
  const [brushing, setBrushing] = useState(false)
  const rail = useRef<HTMLOListElement>(null)

  /** Which month is under this x, from the cells' own boxes. */
  const cellAt = (clientX: number): number | null => {
    const el = rail.current
    if (!el) return null
    const box = el.getBoundingClientRect()
    if (box.width <= 0) return null
    const t = (clientX - box.left) / box.width
    const at = Math.floor(t * months.length)
    return Math.max(0, Math.min(months.length - 1, at))
  }

  const extend = (clientX: number) => {
    const at = cellAt(clientX)
    if (at === null || anchor.current === null) return
    onSpan(spanFrom(anchor.current, at, months.length))
  }

  if (months.length < 2) return null

  return (
    <div className="pg-stretch">
      <ol
        className="pg-stretch__band"
        ref={rail}
        aria-label="Bracket a stretch of months"
        data-brushing={brushing ? 'true' : undefined}
        onPointerDown={(e) => {
          e.preventDefault()
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* not capturable — the brush still works, it just cannot leave the band */
          }
          const at = cellAt(e.clientX)
          if (at === null) return
          anchor.current = at
          setBrushing(true)
          // A press with no travel is one month, which is a real thing to want.
          onSpan(spanFrom(at, at, months.length))
        }}
        onPointerMove={(e) => {
          if (anchor.current === null) return
          extend(e.clientX)
        }}
        onPointerUp={() => {
          anchor.current = null
          setBrushing(false)
        }}
        onPointerCancel={() => {
          anchor.current = null
          setBrushing(false)
        }}
      >
        {band.cells.map((cell, i) => (
          <li
            key={`${cell.year}-${cell.month}`}
            className="pg-stretch__cell"
            data-empty={cell.pages === 0 ? 'true' : undefined}
            data-in={span && i >= span.from && i <= span.to ? 'true' : undefined}
            style={{ ['--warmth']: cell.warmth } as React.CSSProperties}
            title={cellLabel(cell, 'anything')}
          />
        ))}
      </ol>

      <p className="pg-stretch__ends">
        <span className="pg-stretch__year">{months[0] ? months[0].year : ''}</span>

        <span className="pg-stretch__mid">
          {/*
            RELATIVE TIME, beside the bracket it sets.

            Dragging the band has always bracketed a span, and nothing said so —
            a control you have to discover by trying to drag a decoration is a
            control most people never find. These set the same span a drag sets,
            so there is one time filter with two ways in, and putting them here
            teaches the drag by sitting next to it.

            Relative and not named periods: "the last six months" is the
            question people actually ask of a journal, and it keeps meaning the
            same thing next month. Nothing here ranks or scores a span — it only
            changes which months are counted (see the note at the top).
          */}
          <span className="pg-stretch__presets">
            {RECENT.map((p) => {
              const next = spanFrom(months.length - p.months, months.length - 1, months.length)
              const on =
                next !== null && span !== null && span.from === next.from && span.to === next.to
              return (
                <button
                  type="button"
                  key={p.label}
                  className="pg-stretch__preset"
                  data-on={on ? 'true' : undefined}
                  aria-pressed={on}
                  disabled={months.length <= p.months}
                  onClick={() => onSpan(on ? null : next)}
                >
                  {p.label}
                </button>
              )
            })}
          </span>

          {/*
            What is bracketed, and the way out of it — beside the count, so the
            middle of the timeline reads as one caption on what you are looking
            at rather than as two separate readouts.
          */}
          {span ? (
            <button
              type="button"
              className="pg-stretch__on"
              onClick={() => onSpan(null)}
              aria-label={`Stop looking at ${spanText(span, months)}`}
            >
              {spanText(span, months)}
              <svg viewBox="0 0 8 8" width="7" height="7" fill="none" aria-hidden>
                <path
                  d="M1.5 1.5 6.5 6.5M6.5 1.5 1.5 6.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
          <span className="pg-stretch__count">{caption}</span>
        </span>

        <span className="pg-stretch__year">{months.at(-1)?.year ?? ''}</span>
      </p>
    </div>
  )
}
