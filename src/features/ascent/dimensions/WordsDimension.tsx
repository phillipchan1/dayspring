import { DIMENSION_COPY } from '../ascent.config'
import type { WordsData } from '../data/types'

interface Props {
  data: WordsData | null
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/**
 * "Your words" — the user's own writing, at whatever resolution the altitude
 * asks for. The app only ARRANGES and links back; it never paraphrases. At the
 * Summit a single line stands alone, quietest of all.
 */
export function WordsDimension({ data, onOpenEntry }: Props) {
  const resolution = data?.resolution ?? 'week'
  const eyebrow = DIMENSION_COPY.words[resolution]

  if (!data || data.moments.length === 0) {
    return (
      <section className="ascent-dim ascent-dim--words">
        <span className="ascent-dim__eyebrow">{eyebrow}</span>
        <p className="ascent-dim__empty">{DIMENSION_COPY.words.empty}</p>
      </section>
    )
  }

  // The Summit's single line of the year — set apart, large, hushed.
  if (resolution === 'year') {
    const m = data.moments[0]!
    return (
      <section className="ascent-dim ascent-dim--words is-year">
        <span className="ascent-dim__eyebrow">{eyebrow}</span>
        <button
          type="button"
          className="ascent-oneline"
          onClick={() => onOpenEntry?.(m.entryId)}
        >
          “{m.text}”
        </button>
        <span className="ascent-oneline__date">{m.dateLabel}</span>
      </section>
    )
  }

  return (
    <section className="ascent-dim ascent-dim--words">
      <span className="ascent-dim__eyebrow">{eyebrow}</span>
      <div className="ascent-words__list">
        {data.moments.map((m, i) => (
          <button
            key={`${m.entryId}-${i}`}
            type="button"
            className="ascent-word"
            style={{ animationDelay: `${i * 60}ms` }}
            onClick={() => onOpenEntry?.(m.entryId)}
          >
            <span className="ascent-word__bar" aria-hidden />
            <span className="ascent-word__body">
              <span className={`ascent-word__text${m.isQuote ? ' is-quote' : ''}`}>
                {m.isQuote ? `“${m.text}”` : m.text}
              </span>
              <span className="ascent-word__date">{m.dateLabel}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
