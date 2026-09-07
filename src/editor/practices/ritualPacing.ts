/**
 * Pacing — the difference between a ritual and a form.
 *
 * Every practice in the library is *sequential by design*. Ignatius does not
 * hand you four questions; he hands you four movements, entered in order, each
 * one after the last has been let go of. Laying all four on the page at once
 * flattens the single most important formal property of the practice: the
 * writer scans ahead, budgets their answers, and fills in boxes.
 *
 * So a ritual opens one movement at a time. This module is the pure arithmetic
 * of that — which movements a block holds, which of them the writer has
 * answered, and how many are open — kept free of CodeMirror so it can be
 * reasoned about (and tested) on plain strings.
 *
 * Pacing itself lives in `RitualComposer.tsx` now — a ritual is written there,
 * one movement to a screen, and read back whole in the entry. What is left here
 * is the reading of a block out of plain markdown, which both surfaces need:
 * where each movement starts, which of them have words in them, and which one
 * the writer is still standing in.
 */
import { PRACTICE_NAME_RE, PRACTICE_SECTION_RE } from '@/lib/practiceTokens'

export interface RitualMovement {
  /** Position within the block, 0-based. */
  index: number
  /** The section label — matched against the practice's prompts. */
  label: string
  /** 1-based line of the `ritual:section` token. */
  tokenLine: number
  /** 1-based line the writer answers on. Equals `tokenLine` when the block ends there. */
  answerLine: number
  /** Last line carrying this movement's writing — `answerLine` when it is empty. */
  contentEnd: number
  /** True once the writer has put anything on the movement's lines. */
  filled: boolean
}

export interface RitualBlock {
  name: string
  /** 1-based line of the `ritual:name` token. */
  nameLine: number
  /** Last line belonging to the block — its final movement's writing. */
  endLine: number
  movements: RitualMovement[]
}

/**
 * Read every ritual block out of a document's lines.
 *
 * A movement's writing runs from the line below its token to the line before
 * the next token, so a movement answered in several paragraphs stays whole.
 *
 * The *last* movement of a block is the one case that has no token below it to
 * stop at, and there the rule tightens: its writing is the unbroken run of
 * lines from its answer line, and the first blank line ends the block. That
 * matches exactly the shape `buildPracticeBlock` writes — one blank line
 * between the ritual and whatever the writer goes on to say — and it is what
 * lets someone finish the last movement, press Enter twice, and be plainly back
 * in their entry rather than still inside a practice.
 *
 * The trade: a final movement written as two paragraphs ends at the first of
 * them, and the closing rule lands between the two. That is cosmetic and rare.
 * The alternative failure is neither: the page would stay held and dimmed while
 * the writer typed ordinary prose, and a ritual nobody finished would read as
 * complete.
 */
export function parseRitualBlocks(lines: string[]): RitualBlock[] {
  const blocks: RitualBlock[] = []
  let current: RitualBlock | null = null

  const isToken = (text: string) =>
    PRACTICE_NAME_RE.test(text) || PRACTICE_SECTION_RE.test(text)

  // Token lines first: a movement needs to know where the next one begins, and
  // whether it is the last of its block, before it can bound its own writing.
  const tokenLines: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (isToken(lines[i] ?? '')) tokenLines.push(i + 1)
  }

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? ''
    const lineNo = i + 1

    const name = PRACTICE_NAME_RE.exec(text)
    if (name) {
      current = {
        name: (name[1] ?? '').trim(),
        nameLine: lineNo,
        endLine: lineNo,
        movements: [],
      }
      blocks.push(current)
      continue
    }

    const section = PRACTICE_SECTION_RE.exec(text)
    if (!section || !current) continue

    const nextToken = tokenLines.find((n) => n > lineNo) ?? lines.length + 1
    // The next token is another movement of this block only when it is a
    // section; a name token starts a new ritual and closes this one.
    const lastOfBlock =
      nextToken > lines.length || !PRACTICE_SECTION_RE.test(lines[nextToken - 1] ?? '')

    const answerLine = lineNo + 1 <= lines.length ? lineNo + 1 : lineNo
    let contentEnd = answerLine
    let filled = false
    for (let n = answerLine; n < nextToken; n++) {
      const body = lines[n - 1] ?? ''
      if (body.trim() === '') {
        // A blank line only ends the scan for the movement that has no token
        // below it to stop at — see the note above.
        if (lastOfBlock && filled) break
        continue
      }
      if (lastOfBlock && !filled && n > answerLine) break
      filled = true
      contentEnd = n
    }
    if (!filled) contentEnd = answerLine

    current.movements.push({
      index: current.movements.length,
      label: (section[1] ?? '').trim(),
      tokenLine: lineNo,
      answerLine,
      contentEnd,
      filled,
    })
    current.endLine = contentEnd
  }

  return blocks
}

/** The block whose lines contain `line`, or null when the caret is outside every ritual. */
export function ritualBlockAtLine(
  blocks: readonly RitualBlock[],
  line: number,
): RitualBlock | null {
  for (const block of blocks) {
    if (line >= block.nameLine && line <= block.endLine) return block
  }
  return null
}

/** Every movement answered — the practice has been prayed all the way through. */
export function isRitualComplete(block: RitualBlock): boolean {
  return block.movements.length > 0 && block.movements.every((m) => m.filled)
}

/**
 * The movement the writer is standing in: the first one still unanswered, or
 * the last one once the whole practice has been written through.
 */
export function currentMovementIndex(block: RitualBlock): number {
  const n = block.movements.length
  for (let i = 0; i < n; i++) if (!block.movements[i]!.filled) return i
  return Math.max(0, n - 1)
}

