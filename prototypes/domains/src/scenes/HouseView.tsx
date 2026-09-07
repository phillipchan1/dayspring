import { useMemo, useState } from 'react'
import { ENTRIES, OTHER_ENTRIES, TODAY } from '../corpus'
import { domainsByFirstOpened, formatMonthYear, positionOf, span } from '../lib'

/**
 * All of them at once — and the reason this is not a dashboard.
 *
 * One band per domain. Time runs left to right. A mark where he wrote. That is
 * the whole encoding, and everything it does NOT encode is the design:
 *
 *   · No height. A domain with twenty-seven lines is not taller than one with
 *     four, because it is not more of a life.
 *   · No totals, no goals, no percentages, no days-since — D-017's prohibition
 *     list, held at the call site.
 *   · Ordered by when he first opened each one. Never by volume: ranking
 *     domains by frequency is the app ranking what matters in someone's life.
 *
 * Two toggles exist so the argument can be felt instead of asserted. `someone
 * else` runs a completely different writer through the same derivation — proof
 * that we ship no list. `scoreboard` renders the same data the obvious way, so
 * the difference between weather and a verdict is visible in one keystroke.
 */
/** Inset by the mark's own width so the last one is never half off the track. */
const at = (p: number) => `calc(${p} * (100% - 3px) + 1.5px)`

export function HouseView({ onOpen }: { onOpen: (domain: string) => void }) {
  const [other, setOther] = useState(false)
  const [scoreboard, setScoreboard] = useState(false)

  const entries = other ? OTHER_ENTRIES : ENTRIES
  const domains = useMemo(() => domainsByFirstOpened(entries), [entries])
  const range = useMemo(() => {
    const s = span(entries)
    return { from: s.from, to: other ? s.to : TODAY }
  }, [entries, other])

  const years = useMemo(() => {
    const first = Number(range.from.slice(0, 4))
    const last = Number(range.to.slice(0, 4))
    const out: { year: number; at: number }[] = []
    for (let y = first; y <= last; y++) {
      out.push({ year: y, at: positionOf(`${y}-01-01`, range.from, range.to) })
    }
    return out.filter((t) => t.at >= -0.02 && t.at <= 1.02)
  }, [range])

  const total = domains.reduce((n, d) => n + d.dates.length, 0)

  return (
    <div className="paper">
      <div className="wrap">
        <p className="eyebrow">
          {scoreboard ? 'what every competitor ships' : other ? 'a different journal' : 'your own headings'}
        </p>
        <h1 className="title">{scoreboard ? 'The version we are not building' : 'Where the writing went'}</h1>
        <p className="lede">
          {scoreboard
            ? 'Same data. Counted, ranked, and scored — which turns four years of someone’s attention into a report card.'
            : 'A mark for every time you wrote under a heading. Nothing here is taller, brighter, or further up than anything else.'}
        </p>

        <div className="toggles">
          <button className="toggle" data-on={other ? 'true' : undefined} onClick={() => setOther((v) => !v)}>
            someone else
          </button>
          <button
            className="toggle"
            data-on={scoreboard ? 'true' : undefined}
            onClick={() => setScoreboard((v) => !v)}
          >
            scoreboard
          </button>
        </div>

        {scoreboard ? (
          <div className="scoreboard">
            {[...domains]
              .sort((a, b) => b.dates.length - a.dates.length)
              .map((d) => {
                const pct = Math.round((d.dates.length / total) * 100)
                return (
                  <div className="tile" key={d.label}>
                    <div className="tile__label">{d.label}</div>
                    <div className="tile__n">{d.dates.length}</div>
                    <div className="tile__sub">{pct}% of your reflection</div>
                    <div className="tile__bar">
                      <i style={{ width: `${pct}%` }} />
                    </div>
                    {pct < 12 && <div className="verdict">Needs attention</div>}
                  </div>
                )
              })}
          </div>
        ) : (
          <>
            <div className="bands">
              {domains.map((d) => (
                <button className="band" key={d.label} onClick={() => onOpen(d.label)}>
                  <span className="band__label">{d.label}</span>
                  <span className="band__track">
                    <i
                      className="band__open"
                      style={{ left: at(positionOf(d.firstOpened, range.from, range.to)) }}
                    />
                    {d.dates.map((date) => (
                      <i
                        className="band__mark"
                        key={date}
                        style={{ left: at(positionOf(date, range.from, range.to)) }}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>

            <div className="axis" aria-hidden>
              <span />
              <span className="axis__track">
                {years.map((t) => (
                  <span className="axis__tick" key={t.year} style={{ left: `${t.at * 100}%` }}>
                    {t.year}
                  </span>
                ))}
              </span>
            </div>

            <p className="lede" style={{ marginTop: '3rem' }}>
              <span className="count">
                opened in the order you opened them · {formatMonthYear(range.from)} to{' '}
                {formatMonthYear(range.to)}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
