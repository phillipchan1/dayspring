import { useMemo } from 'react'
import { formatDate } from '../corpus'
import { Glyph } from '../Glyph'
import { returning } from '../lib'

/**
 * What keeps coming back.
 *
 * Also NOT time-based. A thing you have carried for two years does not belong
 * inside a week.
 *
 * This is P1's actual question — "am I the same person? have I been praying
 * about the same thing this whole time?" — and Kristi's complaint in the same
 * breath: "I'm doing the same thing this year that I was last year." Shown as
 * recurrence rather than as failure, the same wrestle returning is
 * faithfulness. The app must never write that sentence. It shows four dates and
 * stops.
 *
 * Two rules hold it:
 *   · Every line is the same size. Nothing recedes and nothing is emphasised,
 *     because a size difference here would rank moments of someone's life.
 *   · The shared words are LIT. D-020 warned that people cannot tell why a page
 *     came back when nothing shows its work; literal matching can show its work,
 *     so it does.
 */
export function ReturningView({ onOpen }: { onOpen?: (id: string) => void }) {
  const groups = useMemo(() => returning(), [])

  return (
    <div className="desk">
      <div className="ret">
        {groups.map((g, i) => (
          <section className="ret__group" key={i}>
            <ol className="ret__list">
              {g.marks.map((m, j) => (
                <li key={j}>
                  <button type="button" className="ret__row" onClick={() => onOpen?.(m.entryId)}>
                    <span className="stamp ret__when">{formatDate(m.date)}</span>
                    <Glyph kind={m.kind} hue={m.hue} size={20} />
                    <p className="said">{lit(m.quote, g.shared)}</p>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}

/** Paint the words they actually repeated. Code found them; code can show them. */
function lit(text: string, shared: string[]) {
  if (!shared.length) return text
  const re = new RegExp(`\\b(${shared.map(esc).join('|')})\\b`, 'gi')
  const parts = text.split(re)
  return parts.map((part, i) =>
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
