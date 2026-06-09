import { useState } from 'react'
import { DIMENSION_COPY } from '../ascent.config'
import type { Theme, WordsData } from '../data/types'

interface Props {
  data: WordsData | null
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/**
 * Your words — the REAL Looking-Back content for an altitude, read straight from
 * the reflection rollups. The screen is not a transcript: it leads with the few
 * HIGHLIGHTS that earned their place (a name + the one anchor line + why it
 * surfaced), each expandable to the verbatim lines beneath and every line linking
 * back to its entry. The full chronological footage is demoted to a quiet "show
 * all" at the Valley — available, never the thing shouting for attention.
 */
export function WordsDimension({ data, onOpenEntry }: Props) {
  const resolution = data?.resolution ?? 'week'
  const arcs = data?.arcs ?? []
  const themes = data?.themes ?? []
  const moments = data?.moments ?? []
  const threadsEyebrow = DIMENSION_COPY.words.themes[resolution]
  const linesEyebrow = DIMENSION_COPY.words[resolution]

  const [showAll, setShowAll] = useState(false)

  if (arcs.length === 0 && themes.length === 0 && moments.length === 0) {
    return (
      <section className="ascent-dim ascent-dim--words">
        <span className="ascent-dim__eyebrow">{threadsEyebrow}</span>
        <p className="ascent-dim__empty">Nothing has gathered at this altitude yet.</p>
      </section>
    )
  }

  // Once a curated spine exists, the raw week-in-order list is footage, not signal.
  // Collapse it at the Valley; higher altitudes already distill the kept lines.
  const hasSpine = themes.length > 0 || arcs.length > 0
  const collapseMoments = resolution === 'week' && hasSpine && moments.length > 3

  return (
    <section className="ascent-dim ascent-dim--words">
      {/* What surfaced — the grounded highlights lead; arcs (name + note) only
          when there are no quote-grounded themes to stand on. */}
      {themes.length > 0 ? (
        <>
          <span className="ascent-dim__eyebrow">{threadsEyebrow}</span>
          <div className="ascent-highlights">
            {themes.map((t, i) => (
              <HighlightCard key={t.id} theme={t} index={i} onOpenEntry={onOpenEntry} />
            ))}
          </div>
        </>
      ) : arcs.length > 0 ? (
        <>
          <span className="ascent-dim__eyebrow">{threadsEyebrow}</span>
          <div className="ascent-arcs">
            {arcs.map((a, i) => (
              <div key={a.name + i} className="ascent-arc" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="ascent-arc__name">{a.name}</span>
                <p className="ascent-arc__note">{a.note}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* The lines you kept — verbatim, each linking back to its entry. Demoted to
          a quiet disclosure at the Valley where the list is long raw footage. */}
      {moments.length > 0 ? (
        collapseMoments && !showAll ? (
          <button
            type="button"
            className="ascent-dim__showall"
            onClick={() => setShowAll(true)}
          >
            {`show all ${moments.length} lines from this week →`}
          </button>
        ) : (
          <>
            <span className="ascent-dim__eyebrow ascent-dim__eyebrow--sub">{linesEyebrow}</span>
            <div className="ascent-lines">
              {moments.map((m, i) => (
                <button
                  key={m.entryId + i}
                  type="button"
                  className="ascent-line"
                  style={{ animationDelay: `${i * 50}ms` }}
                  onClick={() => onOpenEntry?.(m.entryId)}
                >
                  <span className="ascent-line__text">{m.isQuote ? `“${m.text}”` : m.text}</span>
                  <span className="ascent-line__date">{m.dateLabel}</span>
                </button>
              ))}
            </div>
          </>
        )
      ) : null}
    </section>
  )
}

// ── one highlight: a name + why it surfaced + its anchor line, expandable ───────

interface CardProps {
  theme: Theme
  index: number
  onOpenEntry?: ((entryId: string) => void) | undefined
}

function HighlightCard({ theme, index, onOpenEntry }: CardProps) {
  const [open, setOpen] = useState(false)
  const [anchor, ...rest] = theme.quotes
  const tag = reasonTag(theme)

  return (
    <div className="ascent-hl" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="ascent-hl__head">
        <span className="ascent-hl__name">{theme.label}</span>
        {tag ? <span className="ascent-hl__tag">{tag}</span> : null}
      </div>

      {anchor ? (
        <button
          type="button"
          className="ascent-hl__anchor"
          onClick={() => onOpenEntry?.(anchor.entryId)}
        >
          <span className="ascent-hl__quote">“{anchor.text}”</span>
          <span className="ascent-hl__date">{anchor.dateLabel}</span>
        </button>
      ) : null}

      {rest.length > 0 ? (
        <>
          {open ? (
            <div className="ascent-hl__more">
              {rest.map((q, j) => (
                <button
                  key={q.entryId + j}
                  type="button"
                  className="ascent-hl__line"
                  onClick={() => onOpenEntry?.(q.entryId)}
                >
                  <span className="ascent-hl__quote">“{q.text}”</span>
                  <span className="ascent-hl__date">{q.dateLabel}</span>
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="ascent-hl__toggle"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'less' : `${rest.length} more ${rest.length === 1 ? 'time' : 'times'} →`}
          </button>
        </>
      ) : null}
    </div>
  )
}

/** The three-word "why it surfaced" tag. Honors an explicit reason from the
 *  synthesis pass; falls back to recurrence weight (distinct entries) so legacy
 *  rollups still read as "you kept coming back to this". */
function reasonTag(theme: Theme): string | null {
  const entries = new Set(theme.quotes.map((q) => q.entryId)).size
  switch (theme.reason) {
    case 'answered':
      return 'answered'
    case 'turning':
      return 'a turn'
    case 'new':
      return entries > 1 ? `new · ${entries} entries` : 'new this week'
    case 'recurred':
    default:
      return entries > 1 ? `recurred · ${entries} entries` : null
  }
}
