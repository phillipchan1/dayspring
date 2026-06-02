// Display formatting for OSIS refs. Pure; shared by the map, the returning
// strip, and (later) the drill panel.

import { bookByOsis } from '../bible/canon'

/** 'Rom.8.28' → 'Romans 8:28'; 'Ps.23' → 'Psalm 23'; 'Rom.8.28-Rom.8.30' → 'Romans 8:28–30'. */
export function formatOsisRef(osisRef: string): string {
  const [startRaw, endRaw] = osisRef.split('-')
  const start = formatSingle(startRaw!)
  if (!endRaw) return start
  const end = parseParts(endRaw)
  // Same book + chapter → collapse the tail to just the end verse.
  const s = parseParts(startRaw!)
  if (end && s && end.osis === s.osis && end.chapter === s.chapter && end.verse != null) {
    return `${start}–${end.verse}`
  }
  return `${start}–${formatSingle(endRaw)}`
}

/** Book OSIS code from an osis_ref ('Rom.8.28' → 'Rom'). */
export function osisBookOf(osisRef: string): string {
  return osisRef.split('-')[0]!.split('.')[0] ?? osisRef
}

/** Chapter number from an osis_ref ('Rom.8.28' → 8, 'Ps.23' → 23). */
export function osisChapterOf(osisRef: string): number {
  const bits = osisRef.split('-')[0]!.split('.')
  return Number(bits[1] ?? 0)
}

interface Parts {
  osis: string
  chapter: number
  verse: number | null
}

function parseParts(ref: string): Parts | null {
  const bits = ref.split('.')
  if (bits.length < 2) return null
  return {
    osis: bits[0]!,
    chapter: Number(bits[1]),
    verse: bits[2] != null ? Number(bits[2]) : null,
  }
}

function formatSingle(ref: string): string {
  const p = parseParts(ref)
  if (!p) return ref
  const book = bookByOsis(p.osis)
  // Psalms reads "Psalm 23" in the singular when one chapter is in view.
  const name = book ? (book.osis === 'Ps' ? 'Psalm' : book.name) : p.osis
  return p.verse != null ? `${name} ${p.chapter}:${p.verse}` : `${name} ${p.chapter}`
}
