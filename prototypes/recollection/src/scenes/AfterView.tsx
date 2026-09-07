import { useMemo, useState } from 'react'
import { SUBJECTS, formatDate, type PlacedMarking } from '../corpus'
import { Glyph } from '../Glyph'
import { markingsFor } from '../lib'

/**
 * Then, and after.
 *
 * Judy: "streams of consciousness is very vulnerable. It's very ugly. It's
 * very messy — especially if there's no resolution at the end. I'm just reading
 * through like a painful moment."
 *
 * So a marking is never shown on its own. It is set beside the NEXT thing she
 * marked about the same person — two sentences she wrote, two dates, and a
 * hairline. The app says nothing, because there is nothing it could say here
 * that would not be a verdict on someone's life.
 *
 * The sharp edge, named rather than buried: choosing WHICH later line is
 * shown edges toward selection, and selection is significance. What keeps it
 * legal is that it is the next one and not the best one. Chronology is a fact.
 * If there is no later marking, nothing is shown — silence is always available.
 */
export function AfterView() {
  const [key, setKey] = useState(SUBJECTS[0]!.key)
  const subject = SUBJECTS.find((s) => s.key === key)!

  const pairs = useMemo(() => {
    const ms = markingsFor(subject).sort((a, b) => a.date.localeCompare(b.date))
    const out: [PlacedMarking, PlacedMarking][] = []
    for (let i = 0; i < ms.length - 1; i += 1) out.push([ms[i]!, ms[i + 1]!])
    return out
  }, [subject])

  return (
    <div className="desk">
      <div className="after">
        <div className="after__pick">
          {SUBJECTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className="chip"
              data-on={s.key === key ? 'true' : undefined}
              onClick={() => setKey(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {pairs.length === 0 ? (
          <p className="after__silence">Nothing came after this one yet.</p>
        ) : (
          <div className="after__list">
            {pairs.map(([a, b], i) => (
              <article className="pair" key={i}>
                <div className="pair__half">
                  <span className="stamp">{formatDate(a.date)}</span>
                  <div className="pair__line">
                    <Glyph kind={a.kind} hue={a.hue} size={22} />
                    <p className="said">{a.quote}</p>
                  </div>
                </div>
                <span className="pair__tie" aria-hidden />
                <div className="pair__half">
                  <span className="stamp">{formatDate(b.date)}</span>
                  <div className="pair__line">
                    <Glyph kind={b.kind} hue={b.hue} size={22} />
                    <p className="said">{b.quote}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
