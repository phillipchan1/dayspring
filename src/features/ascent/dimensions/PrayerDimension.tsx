import { DIMENSION_COPY } from '../ascent.config'
import type { PrayerData } from '../data/types'

interface Props {
  data: PrayerData | null
  onDrill: () => void
}

/**
 * Prayer — PATTERN ONLY. The shape of what the user kept asking, never a list of
 * answers (those rest on the Wall). At the year it shows the Ebenezer: the ask
 * and the stone the user set. Tapping opens the prayer path. Quiet, not triumphal.
 */
export function PrayerDimension({ data, onDrill }: Props) {
  if (!data) return null
  const resolution = data.resolution
  const eyebrow =
    resolution === 'year'
      ? DIMENSION_COPY.prayer.year
      : resolution === 'quarter'
        ? DIMENSION_COPY.prayer.quarter
        : DIMENSION_COPY.prayer.month

  return (
    <section className="ascent-dim ascent-dim--prayer">
      <span className="ascent-dim__eyebrow">{eyebrow}</span>
      <button type="button" className="ascent-prayer__pattern" onClick={onDrill}>
        {data.pattern}
      </button>

      {data.ebenezer ? (
        <div className="ascent-ebenezer">
          <span className="ascent-ebenezer__ask">{data.ebenezer.ask}</span>
          <span className="ascent-ebenezer__arrow" aria-hidden>
            {DIMENSION_COPY.prayer.ebenezerArrow}
          </span>
          <span className="ascent-ebenezer__stone">{data.ebenezer.stone}</span>
        </div>
      ) : null}

      <button type="button" className="ascent-dim__open" onClick={onDrill}>
        {DIMENSION_COPY.prayer.open}
      </button>
    </section>
  )
}
