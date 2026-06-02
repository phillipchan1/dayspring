import { DIMENSION_COPY } from '../ascent.config'
import type { ScriptureData } from '../data/types'

interface Props {
  data: ScriptureData | null
  onDrill: (osisRef: string) => void
}

/**
 * Scripture — what the user reached for, at increasing distillation. Heat is
 * distinct-entry count (a mirror of affection), shown faintly — never a "% of
 * Bible covered". Tapping a verse opens its thread along the season. Faint
 * (suggested) allusions are surfaced quietly as a confirm funnel in the drill-in.
 */
export function ScriptureDimension({ data, onDrill }: Props) {
  const resolution = data?.resolution ?? 'week'
  const eyebrow = DIMENSION_COPY.scripture[resolution]

  if (!data || data.refs.length === 0) {
    // Even with no confirmed verse, an allusion may be waiting — offer the funnel.
    const waiting = data?.suggestedCount ?? 0
    return (
      <section className="ascent-dim ascent-dim--scripture">
        <span className="ascent-dim__eyebrow">{eyebrow}</span>
        {waiting > 0 ? (
          <button type="button" className="ascent-scrip__suggested" onClick={() => onDrill(data!.refs[0]?.osisRef ?? '')}>
            {DIMENSION_COPY.scripture.suggested(waiting)}
          </button>
        ) : (
          <p className="ascent-dim__empty">{DIMENSION_COPY.scripture.empty}</p>
        )}
      </section>
    )
  }

  return (
    <section className="ascent-dim ascent-dim--scripture">
      <span className="ascent-dim__eyebrow">{eyebrow}</span>
      <div className="ascent-scrip__list">
        {data.refs.map((r, i) => (
          <button
            key={r.osisRef}
            type="button"
            className="ascent-scrip"
            style={{ animationDelay: `${i * 60}ms` }}
            onClick={() => onDrill(r.osisRef)}
          >
            <span className="ascent-scrip__ref">{r.label}</span>
            <span className="ascent-scrip__count">{DIMENSION_COPY.scripture.inEntries(r.count)}</span>
          </button>
        ))}
      </div>
      {data.suggestedCount > 0 ? (
        <button
          type="button"
          className="ascent-scrip__suggested"
          onClick={() => onDrill(data.refs[0]!.osisRef)}
        >
          {DIMENSION_COPY.scripture.suggested(data.suggestedCount)}
        </button>
      ) : null}
    </section>
  )
}
