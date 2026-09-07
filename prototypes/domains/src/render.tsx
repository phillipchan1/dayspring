import { formatDate, type Line } from './lib'

/**
 * The writer's lines, in time, with a year in the gutter when it changes.
 *
 * There is no `limit` prop and there will not be one. Showing the best eight of
 * forty is a selection, and a selection is a judgment about which of someone's
 * sentences mattered — which is the one thing this surface must never make.
 */
export function Lines({ lines }: { lines: Line[] }) {
  let year = ''
  return (
    <div className="strand">
      {lines.map((line) => {
        const y = line.date.slice(0, 4)
        const mark = y !== year ? ((year = y), y) : null
        return (
          <div key={`${line.entryId}-${line.para}`}>
            {mark && <div className="year">{mark}</div>}
            <div className="line">
              <div className="line__date">{formatDate(line.date)}</div>
              <p className="line__text said">{line.text}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
