/**
 * A ritual in the entry is a RECORD — read here, written in the composer.
 *
 * It used to be both: the composer paced the movements, and the same words
 * were also free text in the entry, editable in place. Two surfaces owning one
 * piece of writing, with different rules, is what made rituals confusing — and
 * a finished ritual had no door back to the composer at all, so the in-place
 * one was the only one you could find again. Now the entry only shows it, and
 * a click anywhere on it opens the composer.
 *
 * This is the pure half: given the ritual blocks' ranges and one change the
 * writer is trying to make, is it allowed, refused, or reshaped? Only
 * WRITER-originated changes (those carrying a user-event annotation — typing,
 * deleting, pasting, dropping) are judged. The composer writing back, the
 * header's remove, sync and undo all dispatch programmatically and
 * pass untouched.
 */

export interface BlockRange {
  /** Start of the block's `ritual:` name line. */
  from: number
  /** End of the block's last line's text (before its newline). */
  to: number
}

export type Verdict =
  | { kind: 'allow' }
  | { kind: 'refuse' }
  /** The same change with its inserted text adjusted, so it lands on its own line. */
  | { kind: 'reshape'; insert: string }

const ALLOW: Verdict = { kind: 'allow' }
const REFUSE: Verdict = { kind: 'refuse' }

/**
 * Judge one change against every ritual block.
 *
 * - Taking a whole block with it is allowed ONLY when the writer selected it
 *   (`selected`: select-all and delete, cutting a stretch that spans a
 *   ritual) — that is removing the record on purpose. With nothing selected
 *   it is refused: CodeMirror widens a Backspace or Delete beside an atomic
 *   range to the whole range, so one keystroke next to a ritual would
 *   otherwise delete all of it.
 * - Anything that reaches inside a block is refused.
 * - Typing at a block's very edge is reshaped onto its own line. The caret can
 *   rest on either edge (the block is atomic), and a character typed there
 *   would otherwise join the name token or the last answer — breaking the
 *   token, or quietly writing into the record. Below the block it takes a
 *   BLANK line, not just a newline: the parser reads any line directly under
 *   the last answer as more of that answer, and only a blank line ends the
 *   ritual. Enter there is reshaped the same way, so the line it opens is
 *   already outside.
 * - Deleting the newline that separates a block from its neighbour is refused
 *   for the same reason: it glues a line onto the record.
 */
export function judgeRitualEdit(
  blocks: readonly BlockRange[],
  fromA: number,
  toA: number,
  inserted: string,
  selected: boolean,
): Verdict {
  for (const b of blocks) {
    if (fromA <= b.from && toA >= b.to && fromA !== toA) {
      if (selected) continue // takes the whole block, deliberately
      return REFUSE
    }
    // Reaches inside.
    if (fromA < b.to && toA > b.from) return REFUSE
    // Pure insertion on an edge.
    if (fromA === toA && fromA === b.to) {
      if (inserted.startsWith('\n\n')) return ALLOW
      return { kind: 'reshape', insert: `\n\n${inserted.replace(/^\n+/, '')}` }
    }
    if (fromA === toA && fromA === b.from) {
      return inserted.endsWith('\n') ? ALLOW : { kind: 'reshape', insert: `${inserted}\n` }
    }
    // Deleting the newline just above the block (Backspace on the name line's
    // edge) or just below it (Delete at its end) glues a neighbour on.
    if (toA === b.from && fromA < b.from && !inserted.endsWith('\n')) return REFUSE
    if (fromA === b.to && toA > b.to && !inserted.startsWith('\n')) return REFUSE
  }
  return ALLOW
}
