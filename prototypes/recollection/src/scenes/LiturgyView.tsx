import { useEffect, useMemo, useState } from 'react'
import { formatDate, formatDateShort, type MarkingKind, type PlacedMarking } from '../corpus'
import { Glyph } from '../Glyph'
import { HORIZONS, markingsIn, questionsIn, windowFor, type HorizonId } from '../lib'

/**
 * The liturgy.
 *
 * This IS the time-based one — a liturgy has an occasion, and Judy's occasion
 * is twice a year on retreat. It is the answer to "not a dashboard, not a
 * novel": a dashboard is simultaneous and complete, a novel is prose someone
 * else wrote, and a liturgy is a fixed order you move THROUGH. It narrates
 * nothing and it ends in prayer.
 *
 * The order is the Examen's, which is also how a spiritual director actually
 * runs a conversation: what were you given, what did you bring, what did you
 * notice, where did He seem far — then silence, then a page.
 *
 * One movement on screen at a time. No skipping, no scroll, no total, and no
 * completion state — a liturgy you can finish is a chore.
 */

type Step = { id: string; title: string; kinds?: MarkingKind[]; questions?: true; silence?: true; page?: true }

const ORDER: Step[] = [
  { id: 'open', title: '', silence: true },
  { id: 'given', title: 'What you were given', kinds: ['gift', 'scripture'] },
  { id: 'brought', title: 'What you brought', kinds: ['prayer', 'desire'] },
  { id: 'noticed', title: 'What you noticed', kinds: ['sense', 'learned', 'story'] },
  { id: 'far', title: 'Where He seemed far', kinds: ['absence'] },
  { id: 'asked', title: 'What you asked', questions: true },
  { id: 'hold', title: '', silence: true },
  { id: 'page', title: '', page: true },
]

export function LiturgyView() {
  const [id, setId] = useState<HorizonId>('season')
  const [i, setI] = useState(0)
  const horizon = HORIZONS.find((h) => h.id === id)!
  const win = windowFor(horizon)

  const steps = useMemo(() => {
    return ORDER.filter((s) => {
      if (s.silence || s.page) return true
      if (s.questions) return questionsIn(horizon).length > 0
      return markingsIn(horizon, s.kinds).length > 0
    })
  }, [horizon])

  useEffect(() => setI(0), [id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        setI((v) => Math.min(steps.length - 1, v + 1))
      }
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steps.length])

  const step = steps[Math.min(i, steps.length - 1)]!
  const items: PlacedMarking[] = step.kinds ? markingsIn(horizon, step.kinds) : []
  const asks = step.questions ? questionsIn(horizon) : []

  return (
    <div className="lit" onClick={() => setI((v) => Math.min(steps.length - 1, v + 1))} role="presentation">
      <div className="lit__bar" onClick={(e) => e.stopPropagation()}>
        <div className="seg" role="group">
          {HORIZONS.map((h) => (
            <button key={h.id} type="button" data-on={h.id === id ? 'true' : undefined} onClick={() => setId(h.id)}>
              {h.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lit__stage" key={step.id + i}>
        {step.silence ? (
          <p className="lit__dates">
            {formatDate(win.from)} — {formatDate(win.to)}
          </p>
        ) : step.page ? (
          <span className="lit__caret" aria-hidden />
        ) : (
          <>
            <h2 className="lit__title">{step.title}</h2>
            <ul className="lit__items">
              {items.map((m, j) => (
                <li key={j}>
                  <Glyph kind={m.kind} hue={m.hue} size={24} />
                  <p className="said">
                    {m.ref ? <span className="ref">{m.ref} </span> : null}
                    {m.quote}
                  </p>
                  <span className="stamp">{formatDateShort(m.date)}</span>
                </li>
              ))}
              {asks.map((q, j) => (
                <li key={`q${j}`} className="lit__ask">
                  <span />
                  <p className="said">{q.text}</p>
                  <span className="stamp">{formatDateShort(q.date)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="lit__dots" aria-hidden>
        {steps.map((_, j) => (
          <i key={j} data-on={j <= i ? 'true' : undefined} />
        ))}
      </div>
    </div>
  )
}
