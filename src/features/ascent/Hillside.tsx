import { EMPTY_COPY } from './ascent.config'
import type { AltitudeData } from './data/types'
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
}

/**
 * HILLSIDE (month) — step back and the four dimensions resolve at month scale:
 * the lines you kept, the month's recurring verse, what you kept asking, and the
 * thread you started to see. The app names tentatively and only as a question.
 */
export function Hillside({ data, onOpenEntry, onScriptureDrill, onPrayerDrill, onLearningDrill }: Props) {
  if (!data || (!data.words && !data.scripture && !data.prayer && !data.learning)) {
    return <p className="ascent-empty">{EMPTY_COPY.month.empty}</p>
  }
  return (
    <div className="ascent-stack">
      <WordsDimension data={data.words} onOpenEntry={onOpenEntry} />
      <ScriptureDimension data={data.scripture} onDrill={onScriptureDrill} />
      <PrayerDimension data={data.prayer} onDrill={onPrayerDrill} />
      <LearningDimension data={data.learning} onDrill={onLearningDrill} />
    </div>
  )
}
