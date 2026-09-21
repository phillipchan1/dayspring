import type { CSSProperties } from 'react'
import type { Strip } from './strips'

/** The week, month or season laid out: behind you filled, now marked, the rest dashed. */
export function NowStrip({ strip }: { strip: Strip }) {
  const { cells, nowIx, nowFill, note } = strip
  const dense = cells.length > 12
  const style = { '--cells': cells.length, '--fill': `${Math.round(nowFill * 100)}%` } as CSSProperties
  return (
    <div className={`now-strip${dense ? ' is-dense' : ''}`} style={style}>
      <div className="now-strip__cells">
        {cells.map((c, i) => (
          <span key={c.key} className={i < nowIx ? 'is-past' : i === nowIx ? 'is-now' : 'is-future'} />
        ))}
      </div>
      <div className="now-strip__labels">
        {cells.map((c, i) => (
          <span key={c.key} className={i === nowIx ? 'is-now' : ''}>
            {i === nowIx ? 'now' : c.label}
          </span>
        ))}
      </div>
      <p className="now-strip__note">{note}</p>
    </div>
  )
}

// ── the year's ridge ────────────────────────────────────────────────────────

const VW = 1000
const VH = 100

/** Height of the ridge at `t` (0 = Jan 1, 1 = Dec 31), as a y in the viewBox.
 *  A long climb with a few shoulders, cresting at the year's end. */
function ridgeY(t: number): number {
  const rise = 0.14 + 0.78 * Math.pow(t, 1.25) + 0.05 * Math.sin(t * Math.PI * 4.5) * (1 - t)
  return VH - Math.min(0.96, rise) * VH
}

function sample(to: number, dy = 0): string {
  const n = Math.max(2, Math.round(80 * to))
  const pts: string[] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * to
    pts.push(`${(t * VW).toFixed(1)},${(ridgeY(t) + dy).toFixed(1)}`)
  }
  return pts.join(' ')
}

export interface RidgeStone {
  id: string
  /** 0–1 through the year. */
  position: number
  label: string
}

/**
 * THE YEAR'S RIDGE — the Summit's mountain, laid on its side so it can sit on
 * the months. The trail climbs January to December along the ridge line; the
 * stretch behind you is lit, the peak is the year's end, and the stones (a
 * prayer met by a later moment) sit on the day they were met. It is the
 * timeline the month strip below already is, drawn as the climb.
 */
export function YearRidge({
  progress,
  stones,
  selectedId,
  onSelect,
}: {
  progress: number
  stones: RidgeStone[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const lit = Math.min(1, Math.max(0, progress))
  const sealed = lit >= 1
  return (
    <div className={`year-ridge${sealed ? ' is-sealed' : ''}`}>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="year-ridge-rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ascent-rock-top)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--ascent-rock-bottom)" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <polygon points={`0,${VH} ${sample(1)} ${VW},${VH}`} fill="url(#year-ridge-rock)" />
        <polyline points={sample(1, 4)} fill="none" stroke="var(--ascent-trail)" strokeWidth="1.2" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
        {lit > 0 ? (
          <polyline
            points={sample(lit, 4)}
            fill="none"
            stroke="var(--ascent-gold)"
            strokeOpacity="0.8"
            strokeWidth="1.8"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <span className="year-ridge__peak" style={{ left: '100%', top: `${ridgeY(1)}%` }} aria-hidden />
      {!sealed ? <span className="year-ridge__you" style={{ left: `${lit * 100}%`, top: `${ridgeY(lit) + 4}%` }} aria-hidden /> : null}
      {stones.map((s) => {
        const on = s.id === selectedId
        return (
          <button
            key={s.id}
            type="button"
            className={`year-ridge__stone${on ? ' is-open' : ''}`}
            style={{ left: `${s.position * 100}%`, top: `${ridgeY(s.position) + 4}%` }}
            aria-label={s.label}
            aria-pressed={on}
            title={s.label}
            onClick={() => onSelect(on ? null : s.id)}
          />
        )
      })}
    </div>
  )
}
