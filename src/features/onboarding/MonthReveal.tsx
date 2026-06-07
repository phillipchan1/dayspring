import type { Rollup } from '@/lib/insights'
import { periodLabel } from '@/features/ascent/data/words'

/**
 * The payoff: the freshly generated most-recent month-in-review, rendered in the
 * app's reflection voice. The monthly rollup's `letter` is a short second-person
 * letter to the writer (a real Hillside reflection — "the letter") — we show it
 * exactly as generated, with a couple of the writer's own verbatim lines beneath.
 */
export function MonthReveal({ rollup }: { rollup: Rollup }) {
  const reflection = rollup.payload.reflection
  const letter = reflection?.letter ?? []
  // The verbatim lines the writer kept — citations first, falling back to quotes.
  const lines = (reflection?.citations?.length ? reflection.citations : rollup.payload.quotes ?? [])
    .slice(0, 3)

  return (
    <div className="ob-reveal">
      <p className="ob-reveal__period">{periodLabel(rollup)}</p>

      {letter.length > 0 ? (
        <div className="ob-reveal__letter">
          {letter.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : (
        <p className="ob-reveal__letter">
          Your month is gathered. Open your journal to read it in full.
        </p>
      )}

      {lines.length > 0 && (
        <ul className="ob-reveal__lines">
          {lines.map((q, i) => (
            <li key={i} className="ob-reveal__line">
              <span className="ob-reveal__quote">“{q.text}”</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
