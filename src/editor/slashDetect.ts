import type { EditorView } from '@codemirror/view'

export type SlashCommandId = 'scripture' | 'pray' | 'sense' | 'remind'

export interface SlashState {
  query: string
  from: number
  to: number
  x: number
  y: number
}

/** Scan back from the cursor; return non-null when we're in a /command sequence. */
export function detectSlash(view: EditorView): SlashState | null {
  const state = view.state
  const { from, to } = state.selection.main
  if (from !== to) return null

  const line = state.doc.lineAt(from)
  const before = line.text.slice(0, from - line.from)
  // Only a slash at line start or after whitespace opens the palette — so URLs
  // (`http://`), dates (`6/3`), fractions (`1/2`) and words like `and/or` type
  // through untouched.
  const match = /(?:^|\s)\/([a-z]*)$/.exec(before)
  if (!match) return null

  const query: string = match[1] !== undefined ? match[1] : ''
  // Position of the `/` itself (match may include a leading whitespace char).
  const slashPos = from - query.length - 1
  const coords = view.coordsAtPos(from)
  if (!coords) return null
  return {
    query,
    from: slashPos,
    to: from,
    x: coords.left,
    y: coords.bottom,
  }
}
