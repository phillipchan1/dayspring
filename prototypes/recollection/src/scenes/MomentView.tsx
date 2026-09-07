import { useMemo } from 'react'
import { formatDate } from '../corpus'
import { Glyph } from '../Glyph'
import { moments, plural } from '../lib'

/**
 * Moments — marks of different kinds that landed close together.
 *
 * NOT time-based. There is no week/month/year control here on purpose: a moment
 * exists whenever it exists, and it does not expire. You can always walk back
 * in. That is the half of the answer that keeps this from becoming a report you
 * can be behind on.
 *
 * The line down the left is real time — the gap between two marks is drawn to
 * the number of days between them, so a moment where four things happened in
 * nine days looks tight, and one that took two months looks slack. That is
 * arithmetic, and it is horizontal-in-spirit: down the page is chronology, not
 * magnitude, and nothing rises.
 *
 * Every heading on this screen is a count. The app never titles a moment,
 * because a title is a claim about what it was.
 */
export function MomentView({ onOpen }: { onOpen?: (id: string) => void }) {
  const list = useMemo(() => moments(), [])

  return (
    <div className="desk">
      <div className="mom">
        {list.map((m, i) => (
          <article className="mom__card" key={i}>
            <header className="mom__facts">
              {plural(m.marks.length, 'mark', 'marks')} · {plural(m.days, 'day', 'days')} ·{' '}
              {plural(m.kinds.length, 'kind', 'kinds')}
            </header>

            <ol className="mom__line">
              {m.marks.map((mk, j) => {
                const prev = m.marks[j - 1]
                const gap = prev ? (Date.parse(mk.date) - Date.parse(prev.date)) / 86400000 : 0
                return (
                  <li key={j}>
                    {/* The distance is the days. Nothing else is encoded in it. */}
                    {j > 0 ? (
                      <span
                        className="mom__gap"
                        aria-hidden
                        style={{ blockSize: `${Math.min(84, Math.max(14, gap * 5))}px` }}
                      />
                    ) : null}
                    <button type="button" className="mom__mark" onClick={() => onOpen?.(mk.entryId)}>
                      <Glyph kind={mk.kind} hue={mk.hue} size={22} />
                      <p className="said">
                        {mk.ref ? <span className="ref">{mk.ref} </span> : null}
                        {mk.quote}
                      </p>
                      <span className="stamp">{formatDate(mk.date)}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </article>
        ))}
      </div>
    </div>
  )
}
