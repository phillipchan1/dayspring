import type { Answer } from '../data/model'
import { byNewest, longDate, year } from '../data/model'

/**
 * A thread, rendered.
 *
 * There is no summary row, no count, no sparkline and no "you last answered
 * this 6 days ago". The column is the writer's own sentences in date order and
 * the reader does the noticing — which is the difference between this surface
 * and a dashboard, and the reason it needs no model call to be grounded.
 */
export function AnswerColumn({ answers }: { answers: Answer[] }) {
  const sorted = [...answers].sort(byNewest)
  // A year heading over a column that is all one year is a label nobody needs,
  // and it makes a thread look like a report. Only mark a year the thread crosses.
  const spansYears = new Set(sorted.map((a) => year(a.at))).size > 1
  let lastYear: number | null = null

  return (
    <div className="answers">
      {sorted.map((a, i) => {
        const y = year(a.at)
        const showYear = spansYears && y !== lastYear
        lastYear = y
        return (
          <div key={`${a.entryId}-${a.at}`}>
            {showYear ? <div className="year">{y}</div> : null}
            <article className={`answer${i === 0 ? ' answer--latest' : ''}`}>
              <div className="answer__date">{longDate(a.at)}</div>
              <p className="answer__text">{a.text}</p>
            </article>
          </div>
        )
      })}
    </div>
  )
}
