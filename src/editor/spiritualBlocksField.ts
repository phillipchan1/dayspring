import { StateField } from '@codemirror/state'
import { parseSpiritualBlocks, type ParsedSpiritualBlock } from '@/lib/spiritualBlocks'

/**
 * Parsed Dayspring spiritual blocks for the current document, recomputed once
 * per doc change and shared by every decoration that needs them: the block
 * widgets, the task-list checkboxes, and the scripture-reference underline.
 *
 * Previously each of those three independently called
 * `parseSpiritualBlocks(doc.toString())` on every keystroke — three full-document
 * string allocations + scans per character on long entries. Now it happens once.
 *
 * Must be added to the editor state *before* any field that reads it (see
 * Editor.tsx, where it's placed ahead of the decoration extensions).
 */
export const spiritualBlocksField = StateField.define<ParsedSpiritualBlock[]>({
  create(state) {
    return parseSpiritualBlocks(state.doc.toString())
  },
  update(blocks, tr) {
    return tr.docChanged ? parseSpiritualBlocks(tr.state.doc.toString()) : blocks
  },
})

/** True when `pos` falls inside any rendered spiritual block (atomic widget). */
export function posInsideBlock(blocks: readonly ParsedSpiritualBlock[], pos: number): boolean {
  for (const b of blocks) {
    if (pos >= b.from && pos < b.to) return true
  }
  return false
}
