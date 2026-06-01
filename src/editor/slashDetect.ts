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
  const match = /\/([a-z]*)$/.exec(before)
  if (!match) return null

  const slashPos = from - match[0].length
  const coords = view.coordsAtPos(from)
  if (!coords) return null

  return {
    query: match[1] ?? '',
    from: slashPos,
    to: from,
    x: coords.left,
    y: coords.bottom,
  }
}
