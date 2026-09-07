import { useMemo, useState } from 'react'
import { formatDate, formatDateShort, markingsOf, type Entry } from '../corpus'
import { Glyph } from '../Glyph'
import { around, TODAY, type AroundVariant } from '../lib'

/**
 * An occasion, and what she wrote the last time it came around.
 *
 * The tradition's answer to when you look back is not a review you owe. It is a
 * calendar that returns: Advent arrives whether or not you were faithful last
 * year, and then it leaves. You cannot be behind on Lent.
 *
 * That is the whole reason this scene is allowed to be time-based when
 * `#moment` and `#returning` deliberately are not. Every variant here is
 * OCCASIONAL — it exists because of a date, it is gone when the date passes, it
 * never accumulates, it is never counted, and there is no state in which she
 * has missed one. A weekly page still sitting there in March is an inbox. A
 * page that is simply gone on Monday is a liturgy.
 *
 * Three variants, because the live question is what the occasion BELONGS to:
 *
 *   date      — a week either side of today, in the years before this one. It
 *               names no season at all, so the writer supplies whatever the day
 *               means. Safest, and the only one that needs no permission.
 *   season    — Advent, Lent, Eastertide. Broadly held, but GUARDRAILS forbids
 *               assuming a practice, so it is opt-in and the switch is visible
 *               on the settings screen. Note that it is blank most of the year:
 *               three occasions, not fifty-two.
 *   derived   — no calendar anywhere. She has written near this day in more
 *               than one previous year, which is arithmetic. Expect it to be
 *               sparse, and let it be sparse.
 *
 * Falsified if the date proximity reads as coincidence rather than as return.
 * Watch the seasons variant separately: does a reader from another tradition
 * feel like a guest?
 */
const ANCHORS: { id: string; label: string; date: string }[] = [
  { id: 'today', label: 'today', date: TODAY },
  { id: 'lent', label: '1 March', date: '2026-03-01' },
  { id: 'easter', label: '18 April', date: '2026-04-18' },
  { id: 'advent', label: '24 December', date: '2025-12-24' },
]

const VARIANTS: { id: AroundVariant; label: string }[] = [
  { id: 'date', label: 'this day' },
  { id: 'season', label: 'this season' },
  { id: 'derived', label: 'where she has been before' },
]

export function AroundView({ onOpen }: { onOpen?: (id: string) => void }) {
  const [variant, setVariant] = useState<AroundVariant>('date')
  const [anchor, setAnchor] = useState(TODAY)
  const found = useMemo(() => around(anchor, variant), [anchor, variant])

  return (
    <div className="desk">
      <div className="arnd">
        <header className="arnd__head">
          <time className="arnd__anchor">{formatDate(anchor)}</time>
          {found.occasion ? <p className="arnd__occasion">{found.occasion}</p> : null}
        </header>

        {found.years.length ? (
          found.years
            .slice()
            .reverse()
            .map((row) => (
              <section className="arnd__year" key={row.year}>
                <span className="arnd__stamp">{row.year}</span>
                <div className="arnd__entries">
                  {row.entries.map((e) => (
                    <Card key={e.id} entry={e} onOpen={onOpen} />
                  ))}
                </div>
              </section>
            ))
        ) : (
          /*
           * Not an empty state and not an apology. Most days are not an
           * occasion, and a surface that has to fire every time it is opened
           * would have to manufacture the occasion — which is how a calendar
           * becomes a schedule you can fall behind on.
           */
          <p className="arnd__none">Not today.</p>
        )}

        <div className="arnd__bar">
          <div className="seg" role="group">
            {VARIANTS.map((v) => (
              <button
                key={v.id}
                type="button"
                data-on={variant === v.id ? 'true' : undefined}
                onClick={() => setVariant(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="seg" role="group">
            {ANCHORS.map((a) => (
              <button
                key={a.id}
                type="button"
                data-on={anchor === a.date ? 'true' : undefined}
                onClick={() => setAnchor(a.date)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Her words, her date, her marks. Nothing else goes on a page. */
function Card({ entry, onOpen }: { entry: Entry; onOpen?: (id: string) => void }) {
  const marks = markingsOf(entry.id)
  const lead = marks.length ? marks[0]!.quote : entry.paragraphs[0]!

  return (
    <button type="button" className="arnd__card" onClick={() => onOpen?.(entry.id)}>
      <span className="stamp">{formatDateShort(entry.date)}</span>
      <p className="said">{lead}</p>
      {marks.length ? (
        <span className="arnd__marks">
          {marks.map((m, i) => (
            <Glyph key={i} kind={m.kind} hue={m.hue} size={16} />
          ))}
        </span>
      ) : null}
    </button>
  )
}
