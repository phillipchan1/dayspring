import { linesIn, formatMonthYear, questionsIn } from '../lib'
import { Lines } from '../render'

/**
 * Standing in one domain.
 *
 * Every line he wrote under `## frontier`, in time, all of it. No summary sits
 * on top of it, because a summary is the app telling him what four years of his
 * own attention amounted to.
 *
 * The count in the stamp is arithmetic and is allowed — "appears in 12 entries"
 * is a fact. What it must never do is decide an order.
 */
export function DomainView({ domain, onAsked }: { domain: string; onAsked: () => void }) {
  const lines = linesIn(domain)
  const questions = questionsIn(domain)
  const entries = new Set(lines.map((l) => l.entryId)).size

  return (
    <div className="paper">
      <div className="wrap wrap--narrow">
        <p className="eyebrow">in your own words</p>
        <h1 className="title">{domain}</h1>
        <p className="lede">
          <span className="count">
            {lines.length} lines · {entries} entries · since {formatMonthYear(lines[0]!.date)}
          </span>
        </p>

        {questions.length > 0 && (
          <div className="toggles">
            <button className="toggle" onClick={onAsked}>
              {questions.length === 1
                ? 'one of these is a question'
                : `${questions.length} of these are questions`}
            </button>
          </div>
        )}

        <Lines lines={lines} />
      </div>
    </div>
  )
}
