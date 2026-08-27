import { parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import type { SpiritualItemType } from '@/lib/types'

/** One note in the open margin: a hand, the writer's sentence, and where it is. */
export interface MarginNote {
  id: string
  kind: SpiritualItemType
  /** The writer's own words. The margin contains nothing else. */
  text: string
  /** Present only for scripture — the citation, on its own line in the fence. */
  reference: string | null
  /** Character offset of the fence in the entry, for revealing the line. */
  from: number
}

/**
 * The margin's contents, read straight off the entry's markdown.
 *
 * Derived rather than stored: the fence is the source of truth for what is
 * marked, which is what lets the margin be honest about an entry someone edited
 * on another device, and what keeps this from needing a table of its own.
 *
 * Document order, never grouped by kind. Grouping is a filing decision — it
 * would put a verse, a prayer and a sense from the same morning into three
 * separate sections of a page you wrote in one sitting.
 */
export function marginNotes(markdown: string): MarginNote[] {
  return parseSpiritualBlocks(markdown).map((b) => ({
    id: b.id,
    kind: b.type,
    text: b.content,
    reference: b.reference ?? null,
    from: b.from,
  }))
}
