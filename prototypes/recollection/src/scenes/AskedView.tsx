import { useMemo } from 'react'
import { formatDate } from '../corpus'
import { askedGroups, type Asked } from '../lib'

/**
 * Her own questions, and the ones she asked more than once.
 *
 * SHIP THIS AS AN ARGUMENT, NOT A RECOMMENDATION.
 *
 * The arithmetic is unimpeachable: a line ending in a question mark is a fact
 * about the text, and every one of them is here, in the order she wrote them.
 * The grouping is the same anchoring `returning()` uses, and the repeated words
 * are lit so it shows its work.
 *
 * The risk is the shape it makes. A question asked four times across two years
 * and never again has a last date, and that last date is visible, and a reader
 * will supply the word "answered". That is exactly right when the reader
 * supplies it and exactly forbidden when the app does — H2 says absence is not
 * ours to interpret. So the app never writes `answered`, `resolved`, `stopped`
 * or `no longer` anywhere on this page, and the groups are never sorted or
 * separated by whether they are still being asked. Dates, and nothing else.
 *
 * Whether even the arrangement crosses the line is a real argument, and it
 * should be had on the call rather than discovered afterwards.
 *
 * Ordered by when each question was FIRST asked, never by how often. And every
 * question is shown — a page holding the eight most persistent would mean
 * something had selected them, and selection is significance.
 */
export function AskedView({ onOpen }: { onOpen?: (id: string) => void }) {
  const groups = useMemo(() => askedGroups(), [])

  return (
    <div className="desk">
      <div className="askd">
        {groups.map((g, i) => (
          <Group key={i} group={g} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

function Group({ group, onOpen }: { group: Asked; onOpen?: (id: string) => void }) {
  const { questions, shared } = group
  return (
    <section className="askd__group" data-many={questions.length > 1 ? 'true' : undefined}>
      <ol className="askd__list">
        {questions.map((q, i) => (
          <li key={i}>
            <button type="button" className="askd__row" onClick={() => onOpen?.(q.entryId)}>
              <span className="stamp askd__when">{formatDate(q.date)}</span>
              <p className="said">{lit(q.text, shared)}</p>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** The words she actually repeated. Code found them; code can show them. */
function lit(text: string, shared: string[]) {
  if (!shared.length) return text
  const re = new RegExp(`\\b(${shared.map(esc).join('|')})\\b`, 'gi')
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark className="ret__lit" key={i}>
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
