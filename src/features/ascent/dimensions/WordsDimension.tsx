import { DIMENSION_COPY } from '../ascent.config'
import type { WordsData } from '../data/types'

interface Props {
  data: WordsData | null
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/**
 * Your words — the REAL Looking-Back content for an altitude, read straight from
 * the reflection rollups (no mock ropes). Two layers, both grounded in what you
 * actually wrote: the ARCS (the movements you kept returning to) over the verbatim
 * LINES you kept. Distills as you climb (the loaders feed fewer, tighter moments).
 */
export function WordsDimension({ data, onOpenEntry }: Props) {
  const resolution = data?.resolution ?? 'week'
  const arcs = data?.arcs ?? []
  const themes = data?.themes ?? []
  const moments = data?.moments ?? []
  const threadsEyebrow = DIMENSION_COPY.words.themes[resolution]
  const linesEyebrow = DIMENSION_COPY.words[resolution]

  if (arcs.length === 0 && themes.length === 0 && moments.length === 0) {
    return (
      <section className="ascent-dim ascent-dim--words">
        <span className="ascent-dim__eyebrow">{threadsEyebrow}</span>
        <p className="ascent-dim__empty">Nothing has gathered at this altitude yet.</p>
      </section>
    )
  }

  return (
    <section className="ascent-dim ascent-dim--words">
      {/* The movements — arcs preferred; fall back to theme labels. */}
      {arcs.length > 0 ? (
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
      ) : themes.length > 0 ? (
        <>
          <span className="ascent-dim__eyebrow">{threadsEyebrow}</span>
          <div className="ascent-arcs">
            {themes.map((t) => (
              <div key={t.id} className="ascent-arc">
                <span className="ascent-arc__name">{t.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* The lines you kept — verbatim, each linking back to its entry. */}
      {moments.length > 0 ? (
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
      ) : null}
    </section>
  )
}
