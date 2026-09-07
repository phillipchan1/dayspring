import { useMemo } from 'react'
import type { Entry } from '@/lib/types'
import { bandFor, cellLabel, monthsAcross, spanLabel, type Band } from './band'
import { matchSubject, type Subject, type SubjectIndex } from './subjects'

/**
 * The chapter — what a subject looks like, above its pages.
 *
 * Everything on it is either the writer's own words or a number counted in
 * code: how many pages, across what span, when it first appeared, and one band
 * of months. There is no summary, no characterisation, and no portrait.
 *
 * ── Person pages stay small, deliberately ───────────────────────────────────
 *
 * No vocabulary portrait, no co-occurrence network, no "people who appear with
 * her". GUARDRAILS is unambiguous: quote what they wrote, never characterise or
 * profile. A network diagram of someone's relationships is a profile whatever
 * the axis says, and the fact that it would be easy to build is not a reason.
 */
export function Chapter({
  subjects,
  entries,
  index,
  kept,
}: {
  subjects: Subject[]
  /** The whole archive — the band spans it, not just the subject. */
  entries: Entry[]
  index: SubjectIndex
  /** Which of these the writer has kept, by key. */
  kept: ReadonlySet<string>
}) {
  const months = useMemo(() => monthsAcross(entries), [entries])

  const bands: Band[] = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.id, e]))
    return subjects.map((s) => {
      const hit = matchSubject(index, s)
      const lit = [...hit].map((id) => byId.get(id)).filter((e): e is Entry => Boolean(e))
      return bandFor(s.key, s.label, lit, months)
    })
  }, [subjects, entries, index, months])

  if (bands.length === 0 || months.length === 0) return null

  return (
    <section className="pg-chapter" aria-label="What you have written about this">
      {bands.map((band) => (
        <div className="pg-chapter__one" key={band.key}>
          <header className="pg-chapter__head">
            <h2 className="pg-chapter__name">{band.label}</h2>
            <p className="pg-chapter__facts">
              {/*
                Provenance first, because a name appearing without explanation
                is the app claiming to know her. "Noticed" says the journal
                found it; "kept" says she answered.
              */}
              <span>{kept.has(band.key) ? 'kept' : 'noticed'}</span>
              <span aria-hidden>·</span>
              <span>
                {band.pages} {band.pages === 1 ? 'page' : 'pages'}
              </span>
              {band.first ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{spanLabel(band.first, band.last)}</span>
                </>
              ) : null}
            </p>
          </header>

          {/*
            THE BAND HAS NO VERTICAL AXIS. Every cell is the same size and only
            its warmth changes — a bar chart of mentions-per-month has a Y axis,
            and a falling one under a subject called "Mom" reads as *you care
            less about your mother now*, which is a verdict on a relationship
            rendered by a machine.
          */}
          <ol className="pg-band" aria-label={`${band.label}, month by month`}>
            {band.cells.map((cell) => (
              <li
                key={`${cell.year}-${cell.month}`}
                className="pg-band__cell"
                data-empty={cell.pages === 0 ? 'true' : undefined}
                style={{ ['--warmth']: cell.warmth } as React.CSSProperties}
                title={cellLabel(cell, band.label)}
                aria-label={cellLabel(cell, band.label)}
              />
            ))}
          </ol>

          {/* Only the ends are labelled. A tick per year turns a band into a chart. */}
          <p className="pg-band__ends" aria-hidden>
            <span>{months[0] ? months[0].year : ''}</span>
            <span>{months.at(-1)?.year ?? ''}</span>
          </p>
        </div>
      ))}
    </section>
  )
}
