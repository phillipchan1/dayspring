import type { MonthCell } from './match'

function mix(count: number, max: number): string {
  if (count <= 0) return 'rgba(74, 64, 53, 0.08)'
  const t = Math.min(1, count / Math.max(1, max))
  const e = [197, 106, 110]
  const g = [243, 189, 118]
  const r = Math.round(e[0] + (g[0] - e[0]) * t)
  const green = Math.round(e[1] + (g[1] - e[1]) * t)
  const b = Math.round(e[2] + (g[2] - e[2]) * t)
  return `rgb(${r}, ${green}, ${b})`
}

const MONTH = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

export function HeatBand({ cells }: { cells: MonthCell[] }) {
  const max = Math.max(0, ...cells.map((c) => c.count))
  const firstYear = cells[0]?.year
  const lastYear = cells[cells.length - 1]?.year
  return (
    <div>
      <div className="band" role="img" aria-label="When it appears, month by month">
        {cells.map((c) => (
          <div
            key={c.key}
            className="band__cell"
            title={c.count ? `${MONTH[c.month - 1]} ${c.year}` : `${MONTH[c.month - 1]} ${c.year}`}
            style={{ background: mix(c.count, max) }}
          />
        ))}
      </div>
      <div className="band__months">
        <span>{firstYear}</span>
        <span>{lastYear}</span>
      </div>
    </div>
  )
}
