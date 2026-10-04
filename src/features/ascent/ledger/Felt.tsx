import { useEffect, useState } from 'react'
import { LEDGER_COPY, MONTH_SHORT } from './copy'
import type { Felt as FeltData, Span } from './felt'
import { loadFelt } from './load'
import { fmtDay } from './Passage'

/**
 * What a span's pages carried — each emotion the stored read found, with the
 * writer's own line as its evidence, the months it was on, and whether it was
 * there in the span before. Hidden entirely until the writer has stored reads.
 */
export function Felt({
  span,
  before,
  beforeLabel,
  onOpenEntry,
}: {
  span: Span
  before: Span
  /** The span before, said by the calendar: "September", "Summer 2026". */
  beforeLabel: string
  onOpenEntry: ((entryId: string) => void) | undefined
}) {
  const [felt, setFelt] = useState<FeltData | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    setFelt(undefined)
    loadFelt(span, before).then(
      (f) => alive && setFelt(f),
      () => alive && setFelt(null),
    )
    return () => {
      alive = false
    }
  }, [span.from, span.to, before.from, before.to]) // eslint-disable-line react-hooks/exhaustive-deps

  // Still loading, or no stored reads at all: say nothing.
  if (!felt) return null
  const showMonths = felt.months.length > 1
  return (
    <section className="climb__mod felt">
      <span className="ascent-dim__eyebrow">{LEDGER_COPY.felt}</span>
      <p className="felt__note">{LEDGER_COPY.feltNote}</p>
      {felt.emotions.length === 0 ? (
        <p className="ledger-quiet">{LEDGER_COPY.feltNone}</p>
      ) : (
        <div className="alive">
          {felt.emotions.map((e) => (
            <div key={e.emotion} className="alive__row">
              <div>
                <div className="alive__name felt__name">{LEDGER_COPY.emotion(e.emotion)}</div>
                {e.before !== null ? (
                  <div className="alive__kind">
                    {e.before ? LEDGER_COPY.feltAlso(beforeLabel) : LEDGER_COPY.feltNotBefore(beforeLabel)}
                  </div>
                ) : null}
                {showMonths ? (
                  <div className="felt__months" aria-label={LEDGER_COPY.feltMonths}>
                    {felt.months.map((m, i) => (
                      <span key={m} className="felt__month" data-on={e.perMonth[i]! > 0 || undefined}>
                        {MONTH_SHORT[+m.slice(5, 7) - 1]}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="alive__lines">
                {e.lines.map((l) => (
                  <button key={l.entryId} type="button" onClick={() => onOpenEntry?.(l.entryId)}>
                    <span className="alive__when">{fmtDay(l.date)}</span>
                    <span className="alive__text">“{l.text}”</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
