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
