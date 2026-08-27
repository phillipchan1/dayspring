import { useMemo, useState } from 'react'
import { ENTRIES, YEARS, formatDate, heftOf, type Entry, type MarkingKind } from '../corpus'
import { Glyph } from '../Glyph'
import { KINDS } from '../kinds'

/**
 * The book, closed, seen from the fore-edge.
 *
 * Left to right is time, laid out by actual date — so a season nobody wrote in
 * is a gap you can see, and a burst is a thickening. Each leaf's width is how
 * much was written that day. Markings bleed through to the edge at the height
 * they sit on the page, which is what a marked-up Bible looks like from the
 * side.
 *
 * The one thing paper cannot do is right here: touch a kind below and the rest
 * of the edge goes quiet, so you can run your thumb to the gold. Nothing is
 * removed — unchosen leaves dim rather than disappear, because the pages that
 * do not carry it are what give the ones that do their shape.
 *
 * There is no vertical axis anywhere in this drawing. Height is position on a
 * page, never amount and never better.
 */

const W = 1200
const H = 230
const PAD = 16
/** The boards, seen edge-on. */
const COVER = 9

export function EdgeView({ onOpen }: { onOpen?: (id: string) => void }) {
  const [only, setOnly] = useState<MarkingKind | null>(null)
  const [hover, setHover] = useState<Entry | null>(null)

  const geometry = useMemo(() => {
    const days = ENTRIES.map((e) => Date.parse(e.date))
    const first = Math.min(...days)
    const last = Math.max(...days)
    const span = last - first || 1
    const hefts = ENTRIES.map(heftOf)
    const maxHeft = Math.max(...hefts)

    const leaves = ENTRIES.map((e, i) => {
      const t = (days[i]! - first) / span
      const w = 5 + (hefts[i]! / maxHeft) * 12
      return { entry: e, x: PAD + t * (W - PAD * 2 - w), w }
    })

    const yearMarks = YEARS.map((y) => {
      const t = (Date.parse(`${y}-01-01`) - first) / span
      return { year: y, x: PAD + Math.max(0, t) * (W - PAD * 2) }
    })

    return { leaves, yearMarks }
  }, [])

  const counts = useMemo(() => {
    const c = new Map<MarkingKind, number>()
    for (const e of ENTRIES) for (const m of e.markings ?? []) c.set(m.kind, (c.get(m.kind) ?? 0) + 1)
    return c
  }, [])

  return (
    <div className="desk">
      <div className="edge">
        <div className="edge__book">
          <svg viewBox={`0 0 ${W} ${H}`} className="edge__svg" role="img" aria-label="The closed book, seen from its edge">
            <defs>
              <linearGradient id="e-block" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#efe3d0" />
                <stop offset="12%" stopColor="#f9f3e8" />
                <stop offset="88%" stopColor="#f7f0e3" />
                <stop offset="100%" stopColor="#ecdfc9" />
              </linearGradient>
              <pattern id="e-pages" width="3" height="1" patternUnits="userSpaceOnUse">
                <rect x="0" y="0" width="1" height="1" fill="rgba(122, 92, 67, 0.075)" />
              </pattern>
              <linearGradient id="e-board" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7d5f45" />
                <stop offset="55%" stopColor="#6a4f39" />
                <stop offset="100%" stopColor="#59422f" />
              </linearGradient>
            </defs>

            {/* the page block, then the boards seen edge-on */}
            <rect x="0" y={COVER} width={W} height={H - COVER * 2} fill="url(#e-block)" />
            <rect x="0" y={COVER} width={W} height={H - COVER * 2} fill="url(#e-pages)" />
            <rect x="0" y="0" width={W} height={COVER} rx="1.5" fill="url(#e-board)" />
            <rect x="0" y={H - COVER} width={W} height={COVER} rx="1.5" fill="url(#e-board)" />
            <rect x="0" y={COVER} width={W} height="1.5" fill="rgba(122, 92, 67, 0.3)" />
            <rect x="0" y={H - COVER - 1.5} width={W} height="1.5" fill="rgba(122, 92, 67, 0.22)" />

            {geometry.yearMarks.map((y) => (
              <line
                key={y.year}
                x1={y.x}
                x2={y.x}
                y1={COVER}
                y2={H - COVER}
                stroke="rgba(122, 92, 67, 0.16)"
                strokeWidth="1"
              />
            ))}

            {geometry.leaves.map(({ entry, x, w }) => {
              const marks = entry.markings ?? []
              const shown = only ? marks.filter((m) => m.kind === only) : marks
              const dim = only !== null && shown.length === 0
              const n = entry.paragraphs.length
              return (
                <g
                  key={entry.id}
                  className="edge__leaf"
                  data-dim={dim ? 'true' : undefined}
                  onMouseEnter={() => setHover(entry)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onOpen?.(entry.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => ev.key === 'Enter' && onOpen?.(entry.id)}
                  aria-label={formatDate(entry.date)}
                >
                  <rect
                    x={x}
                    y={COVER}
                    width={w}
                    height={H - COVER * 2}
                    fill="#fffdf8"
                    opacity="0.72"
                  />
                  <rect x={x + w - 0.8} y={COVER} width="0.8" height={H - COVER * 2} fill="rgba(122, 92, 67, 0.3)" />
                  <rect x={x} y={COVER} width="0.6" height={H - COVER * 2} fill="rgba(255, 255, 255, 0.85)" />
                  {shown.map((m, j) => {
                    const inner = H - COVER * 2 - PAD * 2
                    const y = COVER + PAD + ((m.para + 0.5) / n) * inner - 5
                    return (
                      <g key={j} className="edge__tick" data-kind={m.kind} data-hue={m.hue}>
                        {/* the soak — ink that went through the page */}
                        <rect x={x - 2.5} y={y - 1.5} width={w + 5} height="13" rx="3" opacity="0.28" />
                        <rect x={x - 1} y={y} width={w + 2} height="10" rx="2" />
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>

          <div className="edge__years">
            {geometry.yearMarks.map((y) => (
              <span key={y.year} className="edge__year" style={{ left: `${(y.x / W) * 100}%` }}>
                {y.year}
              </span>
            ))}
          </div>
        </div>

        <div className="edge__peek" aria-live="polite">
          {hover ? (
            <>
              <span className="stamp">{formatDate(hover.date)}</span>
              <p className="edge__line said">{hover.markings?.[0]?.quote ?? hover.paragraphs[0]}</p>
            </>
          ) : (
            <span className="edge__hint">Anything marked comes through to the edge.</span>
          )}
        </div>

        <div className="edge__legend">
          {KINDS.filter((k) => counts.get(k.kind)).map((k) => (
            <button
              key={k.kind}
              type="button"
              className="chip"
              data-on={only === k.kind ? 'true' : undefined}
              onClick={() => setOnly(only === k.kind ? null : k.kind)}
            >
              <Glyph kind={k.kind} size={18} />
              <span>{k.label}</span>
              <span className="chip__n">{counts.get(k.kind)}</span>
            </button>
          ))}
          {only ? (
            <button type="button" className="chip chip--clear" onClick={() => setOnly(null)}>
              all of it
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
