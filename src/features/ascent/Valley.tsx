import { EMPTY_COPY, VALLEY_COPY, type AltitudeMeta } from './ascent.config'
import type { ValleyData } from './ascentData'

interface Props {
  data: ValleyData | null
  meta: AltitudeMeta
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/**
 * VALLEY (week) — your entries, in the order you lived them. The app's only move
 * is to ARRANGE; where a verbatim weekly citation exists it's shown as a quote.
 */
export function Valley({ data, meta, onOpenEntry }: Props) {
  if (!data) {
    return <p className="ascent-empty">{EMPTY_COPY.week.empty}</p>
  }

  return (
    <div className="ascent-entries">
      {data.entries.map((e, i) => (
        <button
          key={e.id}
          type="button"
          className="ascent-entry"
          style={{ animationDelay: `${i * 70}ms` }}
          onClick={() => onOpenEntry?.(e.id)}
        >
          <span className="ascent-entry__bar" aria-hidden />
          <span className="ascent-entry__body">
            <span className={`ascent-entry__text${e.isQuote ? ' is-quote' : ''}`}>
              {e.isQuote ? `“${e.text}”` : e.text}
            </span>
            <span className="ascent-entry__date">
              {e.dateLabel} <em>{VALLEY_COPY.open}</em>
            </span>
          </span>
        </button>
      ))}
      <p className="ascent-voice quiet">
        ↑ {data.entries.length} {data.entries.length === 1 ? 'entry' : 'entries'} {meta.voice}
      </p>
    </div>
  )
}
