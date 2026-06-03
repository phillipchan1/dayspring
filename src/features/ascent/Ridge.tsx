import { EMPTY_COPY } from './ascent.config'
import type { AltitudeData, Theme } from './data/types'
import { LearningDimension } from './dimensions/LearningDimension'
import { PrayerDimension } from './dimensions/PrayerDimension'
import { ScriptureDimension } from './dimensions/ScriptureDimension'
import { WordsDimension } from './dimensions/WordsDimension'

interface Props {
  data: AltitudeData | null
  onOpenEntry?: ((entryId: string) => void) | undefined
  onScriptureDrill: (osisRef: string) => void
  onPrayerDrill: () => void
  onLearningDrill: () => void
  onThemeDrill: (theme: Theme) => void
}

/**
 * RIDGE (quarter) — the long view. The same four dimensions at season scale: the
 * phrases you circled, the season's anchor passage, the prayer and its first
 * signs, what you now hold. There is no quarterly rollup — the Words are composed
 * client-side from the quarter's months. Carrying a thread into prayer lives in
 * the learning drill-in; the app still only asks.
 */
export function Ridge({
  data,
  onOpenEntry,
  onScriptureDrill,
  onPrayerDrill,
  onLearningDrill,
  onThemeDrill,
}: Props) {
  if (!data || (!data.words && !data.scripture && !data.prayer && !data.learning)) {
    return <p className="ascent-empty">{EMPTY_COPY.quarter.empty}</p>
  }
  return (
    <div className="ascent-stack">
      <WordsDimension data={data.words} onOpenEntry={onOpenEntry} onThemeDrill={onThemeDrill} />
      <ScriptureDimension data={data.scripture} onDrill={onScriptureDrill} />
      <PrayerDimension data={data.prayer} onDrill={onPrayerDrill} />
      <LearningDimension data={data.learning} onDrill={onLearningDrill} />
    </div>
  )
}
