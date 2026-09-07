import type { SpiritualItemType } from './types'
import { MARK_KIND, MARK_KINDS } from './markKinds'
import { isPracticeTokenLine } from './practiceTokens'

// Derived from the one kind table (markKinds.ts) rather than restated here, so
// adding a kind can't leave the parser recognising a fence the writer can't make
// or the other way round.
const FENCE_TO_TYPE: Record<string, SpiritualItemType> = Object.fromEntries(
  MARK_KINDS.map((k) => [k.fence, k.kind]),
)

export interface ParsedSpiritualBlock {
  type: SpiritualItemType
  id: string
  content: string
  /** Scripture reference line stored in the fence body. */
  reference?: string | null
  /** Character offset of opening fence line start in markdown. */
  from: number
  /** Character offset after closing fence. */
  to: number
}

// Built from the table for the same reason. The alternation is sorted longest-
// first so no fence name can be shadowed by a shorter one that prefixes it.
const FENCE_ALTERNATION = MARK_KINDS.map((k) => k.fence.replace(/^dayspring-/, ''))
  .sort((a, b) => b.length - a.length)
  .join('|')
const OPEN_FENCE_RE = new RegExp(
  `^\`\`\`(dayspring-(?:${FENCE_ALTERNATION}))\\s+([0-9a-f-]{36})\\s*$`,
  'i',
)

/** True when a trimmed line opens a Dayspring spiritual fence. */
export function isSpiritualFenceLine(line: string): boolean {
  return OPEN_FENCE_RE.test(line.trim())
}

/** Serialize a spiritual block for insertion into body_markdown. */
export function formatSpiritualBlock(
  type: SpiritualItemType,
  id: string,
  content: string,
  reference?: string,
): string {
  const fence = MARK_KIND[type].fence
  const body = content.trimEnd()
  if (type === 'scripture' && reference?.trim()) {
    return `\`\`\`${fence} ${id}\n${body}\n${reference.trim()}\n\`\`\``
  }
  return `\`\`\`${fence} ${id}\n${body}\n\`\`\``
}

/**
 * Tight scripture insert at the slash position — one newline before the block
 * when needed, no blank line after.
 */
export function formatScriptureInsert(
  id: string,
  verse: string,
  reference: string,
  doc: string,
  insertAt: number,
): string {
  const block = formatSpiritualBlock('scripture', id, verse, reference)
  const needLead = insertAt > 0 && doc[insertAt - 1] !== '\n'
  return `${needLead ? '\n' : ''}${block}`
}

function parseScriptureBody(lines: string[]): { content: string; reference: string | null } {
  if (lines.length === 0) return { content: '', reference: null }
  if (lines.length === 1) return { content: lines[0]!, reference: null }
  return {
    content: lines.slice(0, -1).join('\n'),
    reference: lines[lines.length - 1]!.trim() || null,
  }
}

/** Remove all Dayspring spiritual fenced blocks from markdown. */
export function stripSpiritualBlocks(markdown: string): string {
  const blocks = parseSpiritualBlocks(markdown)
  if (blocks.length === 0) return markdown

  let out = markdown
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]!
    out = out.slice(0, b.from) + out.slice(b.to)
  }
  return out.replace(/\n{3,}/g, '\n\n').trim()
}

/** Parse all Dayspring spiritual fenced blocks in markdown. */
export function parseSpiritualBlocks(markdown: string): ParsedSpiritualBlock[] {
  const lines = markdown.split('\n')
  const blocks: ParsedSpiritualBlock[] = []
  let offset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineStart = offset
    offset += line.length + 1

    const open = line.trim().match(OPEN_FENCE_RE)
    if (!open) continue

    const fenceName = open[1]!.toLowerCase()
    const type = FENCE_TO_TYPE[fenceName]
    if (!type) continue

    const id = open[2]!.toLowerCase()
    const contentLines: string[] = []
    let j = i + 1
    let blockEnd = offset

    while (j < lines.length) {
      const inner = lines[j]!
      if (inner.trim() === '```') {
        blockEnd = blockEnd + inner.length + 1
        const parsed =
          type === 'scripture'
            ? parseScriptureBody(contentLines)
            : { content: contentLines.join('\n'), reference: null as string | null }
        blocks.push({
          type,
          id,
          content: parsed.content,
          reference: parsed.reference,
          from: lineStart,
          // The closing-fence step adds +1 for a trailing newline; a block at
          // end-of-document has none, so clamp or `to` overshoots the doc length
          // — which makes the atomic block-replace range end past the document
          // and crashes selection on click ("Selection points outside of document").
          to: Math.min(blockEnd, markdown.length),
        })
        i = j
        offset = blockEnd
        break
      }
      contentLines.push(inner)
      blockEnd += inner.length + 1
      j++
    }
  }

  return blocks
}

/**
 * Guarantee an editable blank line between a spiritual block and a following
 * practice section token. A block is atomic and the token line is hidden +
 * atomic, so without a normal line between them there's nowhere to place the
 * caret to keep writing beneath the block. Idempotent — a block already followed
 * by a blank line is left untouched — so it's safe to run on every entry load.
 */
export function ensureBlockSeparation(markdown: string): string {
  if (!markdown.includes('<!-- ritual:') && !markdown.includes('<!-- practice:')) return markdown
  const inserts: number[] = []
  for (const block of parseSpiritualBlocks(markdown)) {
    if (block.to >= markdown.length) continue
    let lineEnd = markdown.indexOf('\n', block.to)
    if (lineEnd === -1) lineEnd = markdown.length
    if (isPracticeTokenLine(markdown.slice(block.to, lineEnd).trim())) inserts.push(block.to)
  }
  if (inserts.length === 0) return markdown
  let out = markdown
  for (const pos of [...new Set(inserts)].sort((a, b) => b - a)) {
    out = out.slice(0, pos) + '\n' + out.slice(pos)
  }
  return out
}
