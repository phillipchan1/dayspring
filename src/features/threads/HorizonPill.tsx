import type { Horizon } from './data/types'

const OPTIONS: { label: string; hint: string }[] = [
  {
    label: 'Week',
    hint: 'This week — mostly single threads. Nothing has had time to twist yet.',
  },
  {
    label: 'Month',
    hint: 'This month — the first threads begin collecting into ropes.',
  },
  {
    label: 'Season',
    hint: 'This season — ropes thicken; a third strand twists in.',
  },
  {
    label: 'Year',
    hint: 'This year — the load-bearing ropes are clearly ropes now.',
  },
  {
    label: 'All time',
    hint: 'All time — the richest ropes, every thread they ever collected.',
  },
]

interface Props {
  horizon: Horizon
  onChange: (h: Horizon) => void
}

export function HorizonPill({ horizon, onChange }: Props) {
  return (
    <div className="threads__ctl">
      <span className="threads__ctl-label">
        Time horizon — wider shows richer ropes
      </span>
      <div className="horizon-pill" role="group" aria-label="Time horizon">
        {OPTIONS.map((opt, i) => (
          <button
            key={i}
            type="button"
            className="horizon-pill__btn"
            data-active={horizon === i ? 'true' : undefined}
            aria-pressed={horizon === i}
            onClick={() => onChange(i as Horizon)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="threads__hint">{OPTIONS[horizon]?.hint ?? ''}</p>
    </div>
  )
}
