import type { EditorView } from '@codemirror/view'

export type SlashCommandId = 'scripture' | 'pray' | 'sense' | 'practice'

export interface SlashState {
  query: string
  from: number
  to: number
  /** Caret left (viewport px). */
  x: number
  /** Caret bottom (viewport px) — where the palette sits when placed below. */
  y: number
  /** Caret top (viewport px) — the flip pivot when the palette is placed above. */
  yTop: number
}

export interface SlashMatch {
  query: string
  /** Doc position of the `/` itself. */
  from: number
}

/**
 * Pure rule for opening the palette: a slash at line start or after whitespace,
 * optionally followed by lowercase letters. Keeping this separate from the view
 * lets us unit-test the trigger without a DOM. `cursor` is the doc position the
 * `before` text ends at.
 */
export function matchSlashBefore(before: string, cursor: number): SlashMatch | null {
  // Only a slash at line start or after whitespace opens the palette — so URLs
  // (`http://`), dates (`6/3`), fractions (`1/2`) and words like `and/or` type
  // through untouched.
  const match = /(?:^|\s)\/([a-z]*)$/.exec(before)
  if (!match) return null
  const query = match[1] ?? ''
  // The match may include a leading whitespace char; the `/` is query.length + 1
  // characters back from the cursor.
  return { query, from: cursor - query.length - 1 }
}

/** Scan back from the cursor; return non-null when we're in a /command sequence. */
export function detectSlash(view: EditorView, blockOnTitleLine = false): SlashState | null {
  const state = view.state
  const { from, to } = state.selection.main
  if (from !== to) return null

  const line = state.doc.lineAt(from)
  if (blockOnTitleLine && line.number === 1) return null
  const before = line.text.slice(0, from - line.from)
  const matched = matchSlashBefore(before, from)
  if (!matched) return null

  const coords = view.coordsAtPos(from)
  if (!coords) return null
  return {
    query: matched.query,
    from: matched.from,
    to: from,
    x: coords.left,
    y: coords.bottom,
    yTop: coords.top,
  }
}
