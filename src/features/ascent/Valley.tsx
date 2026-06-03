import { EMPTY_COPY } from './ascent.config'
import type { AltitudeData, Theme } from './data/types'
import { ScriptureDimension } from './dimensions/ScriptureDimension'
import { WordsDimension } from './dimensions/WordsDimension'

interface Props {
  data: AltitudeData | null
  onOpenEntry?: ((entryId: string) => void) | undefined
  onScriptureDrill: (osisRef: string) => void
  onThemeDrill: (theme: Theme) => void
}

/**
 * VALLEY (week) — closest to the ground. Only two dimensions surface here: your
 * own words in lived order, and what you reached for in scripture. The app does
 * nothing but arrange. Prayer-pattern and learning begin higher up.
 */
export function Valley({ data, onOpenEntry, onScriptureDrill, onThemeDrill }: Props) {
  if (!data || (!data.words && !data.scripture)) {
    return <p className="ascent-empty">{EMPTY_COPY.week.empty}</p>
  }
  return (
    <div className="ascent-stack">
      <WordsDimension data={data.words} onOpenEntry={onOpenEntry} onThemeDrill={onThemeDrill} />
      <ScriptureDimension data={data.scripture} onDrill={onScriptureDrill} />
    </div>
  )
}
