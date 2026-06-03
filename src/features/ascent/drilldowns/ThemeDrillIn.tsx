import { DRILL_COPY } from '../ascent.config'
import type { Theme } from '../data/types'
import { DrillSheet } from './DrillSheet'

interface Props {
  data: Theme
  onClose: () => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/**
 * Theme drill-in — REAL. The funnel the user asked for: the surface shows a theme
 * (a pattern), and here are the ACTUAL verbatim lines that formed it, laid along
 * the season, each tappable straight to its source entry. The app gathered the
 * lines; it never wrote them and never names what they mean.
 */
export function ThemeDrillIn({ data, onClose, onOpenEntry }: Props) {
  return (
    <DrillSheet title={data.label} onClose={onClose}>
      <ol className="ascent-path">
        {data.quotes.map((q, i) => (
          <li key={`${q.entryId}-${i}`} className="ascent-path__moment">
            <span className="ascent-path__dot" aria-hidden />
            <div className="ascent-path__body">
              <button
                type="button"
                className="ascent-path__excerpt"
                onClick={() => onOpenEntry?.(q.entryId)}
              >
                “{q.text}”
              </button>
              <span className="ascent-path__date">{q.dateLabel}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="ascent-drill__foot">{DRILL_COPY.themeFooter}</p>
    </DrillSheet>
  )
}
