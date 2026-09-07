import { parseRitualBlocks, type RitualBlock } from './ritualPacing'

/**
 * Reading a ritual out of the entry, and writing it back.
 *
 * The composer is a surface, not a second store. The entry's markdown stays the
 * single source of truth, so everything downstream — sync, autosave, Pages, the
 * rollups, the Ascent — keeps reading exactly what it already reads. All the
 * composer does is take one block out, hand it to the writer a movement at a
 * time, and put the whole block back.
 *
 * Whole-block replacement rather than per-movement edits, on purpose: line
 * ranges shift the moment anything is typed, and the composer owns the block for
 * as long as it is open, so rebuilding it entire is both simpler and impossible
 * to get subtly wrong.
 */

/** Byte offsets of the start of every line in `doc`. */
function lineStarts(doc: string): number[] {
  const starts = [0]
  for (let i = 0; i < doc.length; i++) if (doc[i] === '\n') starts.push(i + 1)
  return starts
}

/** What the composer needs to open a block: its name, its movements, its words. */
export interface RitualContents {
  name: string
  labels: string[]
  texts: string[]
}

/** The document range a ritual block occupies, or null when `index` has no block. */
export function ritualBlockRange(
  doc: string,
  index: number,
): { from: number; to: number } | null {
  const lines = doc.split('\n')
  const block = parseRitualBlocks(lines)[index]
  if (!block) return null
  const starts = lineStarts(doc)
  const from = starts[block.nameLine - 1] ?? 0
  const endStart = starts[block.endLine - 1] ?? 0
  return { from, to: endStart + (lines[block.endLine - 1] ?? '').length }
}

/** Everything the writer has already put into block `index`. */
export function readRitual(doc: string, index: number): RitualContents | null {
  const lines = doc.split('\n')
  const block: RitualBlock | undefined = parseRitualBlocks(lines)[index]
  if (!block) return null
  return {
    name: block.name,
    labels: block.movements.map((m) => m.label),
    texts: block.movements.map((m) =>
      // A movement's writing runs from its answer line to the last line that
      // carries anything. An untouched movement reads as the empty string.
      m.filled ? lines.slice(m.answerLine - 1, m.contentEnd).join('\n') : '',
    ),
  }
}

/**
 * Rebuild a block's markdown from the composer's state.
 *
 * Byte-identical in shape to what `buildPracticeBlock` writes, so a ritual
 * composed here and one begun before the composer existed are the same
 * document — which is what keeps the reading view, sync and the rollups from
 * ever needing to know which one made it.
 */
export function composeRitualMarkdown(
  name: string,
  labels: readonly string[],
  texts: readonly string[],
): string {
  let out = `<!-- ritual:name:${name} -->\n`
  labels.forEach((label, i) => {
    out += `<!-- ritual:section:${label} -->\n`
    // Trailing blank lines would read as the writer having left the ritual, so
    // they are trimmed; leading and internal ones are the writer's own spacing.
    out += (texts[i] ?? '').replace(/\s+$/, '')
    if (i < labels.length - 1) out += '\n'
  })
  return out
}

/** Index of the ritual block whose name token starts at `pos`, or -1. */
export function ritualIndexAt(doc: string, pos: number): number {
  const lines = doc.split('\n')
  const starts = lineStarts(doc)
  const blocks = parseRitualBlocks(lines)
  for (let i = 0; i < blocks.length; i++) {
    if (starts[blocks[i]!.nameLine - 1] === pos) return i
  }
  return -1
}

/** Index of the ritual block whose lines contain `pos`, or -1. */
export function ritualIndexContaining(doc: string, pos: number): number {
  const lines = doc.split('\n')
  const starts = lineStarts(doc)
  let line = 1
  for (let n = 0; n < starts.length; n++) {
    if (pos >= starts[n]!) line = n + 1
    else break
  }
  const blocks = parseRitualBlocks(lines)
  for (let i = 0; i < blocks.length; i++) {
    if (line >= blocks[i]!.nameLine && line <= blocks[i]!.endLine) return i
  }
  return -1
}
