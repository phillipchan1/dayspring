import type { GrowthData, ScriptureData, WordsData } from './data/types'
import { GrowthDimension } from './dimensions/GrowthDimension'
import { ScriptureDimension } from './dimensions/ScriptureDimension'
import { WordsDimension } from './dimensions/WordsDimension'

interface Props {
  words: WordsData | null
  scripture: ScriptureData | null
  /** null at the Valley — the growth block begins at the Hillside. */
  growth: GrowthData | null
  onScriptureDrill: (osisRef: string) => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/**
 * The non-summit altitudes (Valley/Hillside/Ridge). Reads the REAL reflection
 * rollups — the arcs you kept returning to + the verbatim lines you kept — over
 * the scripture you reached for. (The earlier warmth-band/rope visualization read
 * an engine that was never wired to real data; the Ascent now reads its rollups.)
 */
export function AltitudeBands({ words, scripture, growth, onScriptureDrill, onOpenEntry }: Props) {
  return (
    <div className="ascent-stack">
      <WordsDimension data={words} onOpenEntry={onOpenEntry} />
      <ScriptureDimension data={scripture} onDrill={onScriptureDrill} />
      {/* Growth sits LAST: what you wrote and what you reached for come first, and
          the one derived block reads as a footnote to them, not a headline. */}
      <GrowthDimension data={growth} onOpenEntry={onOpenEntry} />
    </div>
  )
}
