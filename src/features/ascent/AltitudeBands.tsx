import type { ScriptureData, WordsData } from './data/types'
import { ScriptureDimension } from './dimensions/ScriptureDimension'
import { WordsDimension } from './dimensions/WordsDimension'

interface Props {
  words: WordsData | null
  scripture: ScriptureData | null
  onScriptureDrill: (osisRef: string) => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/**
 * The non-summit altitudes (Valley/Hillside/Ridge). Reads the REAL reflection
 * rollups — the arcs you kept returning to + the verbatim lines you kept — over
 * the scripture you reached for. (The earlier warmth-band/rope visualization read
 * an engine that was never wired to real data; the Ascent now reads its rollups.)
 */
export function AltitudeBands({ words, scripture, onScriptureDrill, onOpenEntry }: Props) {
  return (
    <div className="ascent-stack">
      <WordsDimension data={words} onOpenEntry={onOpenEntry} />
      <ScriptureDimension data={scripture} onDrill={onScriptureDrill} />
    </div>
  )
}
