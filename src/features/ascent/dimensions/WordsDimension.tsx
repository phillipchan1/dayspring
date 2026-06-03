import { DIMENSION_COPY } from '../ascent.config'
import type { Theme, WordMoment, WordsData } from '../data/types'

interface Props {
  data: WordsData | null
  onOpenEntry?: ((entryId: string) => void) | undefined
  onThemeDrill: (theme: Theme) => void
}

/**
 * "Your words" — the user's own writing. When the synthesis has surfaced THEMES
 * (grounded in verbatim quotes), they lead as the highlight layer: tap a theme to
 * see the actual lines and reach the entry. The raw chronological week recedes
 * into a quiet, collapsible "the week, in order" beneath. Without themes (no
 * synthesis yet) it falls back to the plain list. At the Summit a single line
 * stands alone, quietest of all. The app only arranges — never paraphrases.
 */
export function WordsDimension({ data, onOpenEntry, onThemeDrill }: Props) {
  const resolution = data?.resolution ?? 'week'

  if (!data || (data.moments.length === 0 && data.themes.length === 0)) {
    return (
      <section className="ascent-dim ascent-dim--words">
        <span className="ascent-dim__eyebrow">{DIMENSION_COPY.words[resolution]}</span>
        <p className="ascent-dim__empty">{DIMENSION_COPY.words.empty}</p>
      </section>
    )
  }

  // The Summit's single line of the year — set apart, large, hushed.
  if (resolution === 'year') {
    const m = data.moments[0]
    if (!m) return null
    return (
      <section className="ascent-dim ascent-dim--words is-year">
        <span className="ascent-dim__eyebrow">{DIMENSION_COPY.words.year}</span>
        <button type="button" className="ascent-oneline" onClick={() => onOpenEntry?.(m.entryId)}>
          “{m.text}”
        </button>
        <span className="ascent-oneline__date">{m.dateLabel}</span>
      </section>
    )
  }

  const hasThemes = data.themes.length > 0

  return (
    <section className="ascent-dim ascent-dim--words">
      <span className="ascent-dim__eyebrow">
        {hasThemes ? DIMENSION_COPY.words.themes[resolution] : DIMENSION_COPY.words[resolution]}
      </span>

      {hasThemes ? (
        <div className="ascent-themes">
          {data.themes.map((t) => (
            <button
              key={t.id}
              type="button"
              className="ascent-theme"
              onClick={() => onThemeDrill(t)}
            >
              <span className="ascent-theme__head">
                <span className="ascent-theme__label">{t.label}</span>
                <span className="ascent-theme__count">{DIMENSION_COPY.words.lines(t.quotes.length)}</span>
              </span>
              {t.quotes[0] ? <span className="ascent-theme__peek">“{t.quotes[0].text}”</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* Week keeps the lived days reachable; with themes it folds away quietly,
          without themes it shows directly. Month/quarter let the themes stand. */}
      {resolution === 'week' ? (
        hasThemes ? (
          <details className="ascent-inorder">
            <summary className="ascent-inorder__summary">{DIMENSION_COPY.words.inOrder}</summary>
            <MomentList moments={data.moments} onOpenEntry={onOpenEntry} />
          </details>
        ) : (
          <MomentList moments={data.moments} onOpenEntry={onOpenEntry} />
        )
      ) : hasThemes ? null : (
        <MomentList moments={data.moments} onOpenEntry={onOpenEntry} />
      )}
    </section>
  )
}

function MomentList({
  moments,
  onOpenEntry,
}: {
  moments: WordMoment[]
  onOpenEntry?: ((entryId: string) => void) | undefined
}) {
  return (
    <div className="ascent-words__list">
      {moments.map((m, i) => (
        <button
          key={`${m.entryId}-${i}`}
          type="button"
          className="ascent-word"
          style={{ animationDelay: `${i * 50}ms` }}
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
  )
}
