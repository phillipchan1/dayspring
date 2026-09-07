import { useMemo, useState } from 'react'
import { SUBJECTS, allMarkings, formatDate, type MarkingKind, type Subject } from '../corpus'
import { Glyph } from '../Glyph'
import { KINDS } from '../kinds'
import { allMonths, entriesFor, linesFor, markingsFor, monthsWith, spanOf } from '../lib'

/**
 * The front of the book.
 *
 * Judy kept an index sticker in her bullet journal: assign a number to a life
 * area, mark every page that touches it, list the page numbers at the front.
 * She stopped, because twenty numbers is a system and she does not have time
 * for a system. This is the same index, kept by the machine.
 *
 * Two rules that decide the whole screen:
 *
 *   · ORDER IS WHEN IT FIRST APPEARED, never by count. A list sorted by
 *     frequency is a list ranking what matters in someone's life.
 *   · It may only SHOW. No rename, no merge, no archive. The moment it grows
 *     management affordances it becomes a to-do list about someone's prayer
 *     life.
 *
 * The band beside each name is every month it was written, and it has no
 * height. A bar chart of a person's name that falls off reads as "you care
 * less about your mother now" — a verdict on a relationship, drawn by a
 * machine. A band carries rhythm and gaps and nothing else.
 */
export function RegisterView({ onOpen }: { onOpen?: (id: string) => void }) {
  const [picked, setPicked] = useState<Subject | null>(null)
  const [kind, setKind] = useState<MarkingKind | null>(null)
  const months = useMemo(allMonths, [])

  const kindCounts = useMemo(() => {
    const c = new Map<MarkingKind, number>()
    for (const m of allMarkings()) c.set(m.kind, (c.get(m.kind) ?? 0) + 1)
    return c
  }, [])

  const lines = picked ? linesFor(picked) : []
  const kindItems = kind ? allMarkings().filter((m) => m.kind === kind) : []

  return (
    <div className="desk">
      <div className="reg">
        <div className="leaf leaf--flat">
        <div className="reg__cols">
          <section className="reg__col">
            <p className="reg__label">names, as they first came up</p>
            <ul className="reg__list">
              {SUBJECTS.map((s) => {
                const es = entriesFor(s)
                const span = spanOf(es.map((e) => e.date))
                const has = monthsWith(es.map((e) => e.date))
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      className="reg__row"
                      data-on={picked?.key === s.key ? 'true' : undefined}
                      onClick={() => {
                        setKind(null)
                        setPicked(picked?.key === s.key ? null : s)
                      }}
                    >
                      <span className="reg__name">{s.label}</span>
                      <span className="band" aria-hidden>
                        {months.map((m) => (
                          <i key={m} data-on={has.has(m) ? 'true' : undefined} />
                        ))}
                      </span>
                      <span className="reg__span">
                        {span ? `${span.first.slice(0, 4)}–${span.last.slice(0, 4)}` : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="reg__col">
            <p className="reg__label">what you set apart</p>
            <ul className="reg__list">
              {KINDS.filter((k) => kindCounts.get(k.kind)).map((k) => (
                <li key={k.kind}>
                  <button
                    type="button"
                    className="reg__row reg__row--kind"
                    data-on={kind === k.kind ? 'true' : undefined}
                    onClick={() => {
                      setPicked(null)
                      setKind(kind === k.kind ? null : k.kind)
                    }}
                  >
                    <Glyph kind={k.kind} size={20} />
                    <span className="reg__name">{k.label}</span>
                    <span className="reg__span">{kindCounts.get(k.kind)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/*
          Every matching line, oldest first. Not the best eight of forty —
          the moment something selects them, selection is significance, and
          significance is a verdict. So the count on the header equals the
          lines below it.
        */}
        {picked ? (
          <div className="reg__open">
            <p className="reg__opencount">
              {picked.label} · {lines.length} lines · {markingsFor(picked).length} marked
            </p>
            <ol className="lines">
              {lines.map((l, i) => (
                <li key={i}>
                  <button type="button" className="line" onClick={() => onOpen?.(l.entryId)}>
                    <span className="stamp">{formatDate(l.date)}</span>
                    <p className="line__text said">{l.text}</p>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {kind ? (
          <div className="reg__open">
            <p className="reg__opencount">{kindItems.length}</p>
            <ol className="lines">
              {kindItems.map((m, i) => (
                <li key={i}>
                  <button type="button" className="line" onClick={() => onOpen?.(m.entryId)}>
                    <span className="stamp">{formatDate(m.date)}</span>
                    <p className="line__text said">
                      {m.ref ? <span className="ref">{m.ref} </span> : null}
                      {m.quote}
                    </p>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  )
}
