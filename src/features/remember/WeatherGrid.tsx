import { MONTH_INITIALS, MONTHS, foldCopy, foldMonth, type Weather } from './weather'

interface Props {
  weather: Weather
  /** Folded month, or null. Controlled so the caller can filter the list to match. */
  month: number | null
  onMonth: (month: number | null) => void
  /** Word used in the fold sentence — "passage" at rest, "entry" in an answer. */
  noun?: string
}

/**
 * Years down, months across. Clicking a month folds every year together.
 *
 * The one thing a notebook physically cannot do: eleven Novembers, side by side.
 * A linear strip tells you when; this tells you whether it keeps coming back.
 *
 * Intensity is the only encoding, and it is deliberately shallow — five steps,
 * no legend, no numbers on the cells. You read your own weather; the app does
 * not tell you what the weather means.
 */
export function WeatherGrid({ weather, month, onMonth, noun = 'passage' }: Props) {
  if (weather.years.length === 0) return null

  const fold = month == null ? null : foldMonth(weather, month)

  return (
    <div className="wx">
      <div className="wx__row wx__row--head">
        <span className="wx__year" aria-hidden />
        {MONTH_INITIALS.map((initial, i) => (
          <button
            key={i}
            type="button"
            className="wx__mon"
            data-on={month === i ? 'true' : undefined}
            aria-pressed={month === i}
            aria-label={`Fold every ${MONTHS[i]} together`}
            onClick={() => onMonth(month === i ? null : i)}
          >
            {initial}
          </button>
        ))}
      </div>

      {weather.years.map((year, row) => (
        <div className="wx__row" key={year}>
          <span className="wx__year">{year}</span>
          {weather.cells[row]!.map((n, col) => (
            <span
              key={col}
              className="wx__cell"
              data-dim={month != null && month !== col ? 'true' : undefined}
              // Five steps, capped: one busy month must not flatten a decade.
              data-level={n === 0 ? 0 : Math.min(4, Math.ceil((n / weather.peak) * 4))}
              title={`${MONTHS[col]} ${year} — ${n} ${n === 1 ? noun : `${noun}s`}`}
            />
          ))}
        </div>
      ))}

      <p className="wx__read" aria-live="polite">
        {fold ? foldCopy(fold, noun) : ''}
      </p>
    </div>
  )
}
