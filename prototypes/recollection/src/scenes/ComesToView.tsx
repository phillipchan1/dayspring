import { formatDate } from '../corpus'
import { Glyph } from '../Glyph'
import { entryById, markingsOf } from '../corpus'
import { earlierEcho } from '../lib'

/**
 * The null hypothesis: there is no review, and it comes to you.
 *
 * This one earns its place by possibly killing the other three. Judy reflects
 * TWICE A YEAR — which is a real argument that a destination sits unvisited no
 * matter how good it is. RECALL Act four's bet is that return has to be
 * initiated by the app or it will not happen.
 *
 * Two constraints the design has to visibly respect:
 *   · Principle 3 — nothing appears inside the composing surface. This lands
 *     AFTER the writing, beneath the entry, never as live editor chrome.
 *   · Principle 2 — it may only appear BECAUSE you just wrote about the thing.
 *     Never "you haven't written about her in three months." That sentence is
 *     guilt, and guilt is the mechanic this product committed never to build.
 *
 * The app says nothing here on purpose. No heading, no "you might want to see
 * this." A hairline, a date, and their own sentence. If the connection is not
 * seen unprompted, that call was wrong — and this is also the one that can fail
 * as creepy rather than as useless, which is a separate signal worth catching.
 */
export function ComesToView({ onOpen }: { onOpen?: (id: string) => void }) {
  const entry = entryById('e-2026-07-14')!
  const mine = markingsOf(entry.id)
  const seed = { ...mine[0]!, entryId: entry.id, date: entry.date }
  const back = earlierEcho(seed)

  return (
    <div className="desk">
      <div className="leaf cto">
        <div className="leaf__head">
          <time className="leaf__date">{formatDate(entry.date)}</time>
          <span className="leaf__year">{entry.date.slice(0, 4)}</span>
          <span />
        </div>

        {entry.paragraphs.map((p, i) => (
          <p className="leaf__para said cto__para" key={i}>
            {p}
          </p>
        ))}

        {/* Below the fold. A hairline, and nothing said. */}
        {back ? (
          <div className="cto__after">
            <span className="cto__rule" aria-hidden />
            <button type="button" className="cto__back" onClick={() => onOpen?.(back.entryId)}>
              <Glyph kind={back.kind} hue={back.hue} size={22} />
              <p className="said">{back.quote}</p>
              <span className="stamp">{formatDate(back.date)}</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
