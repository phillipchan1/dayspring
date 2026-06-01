import type { EditorView } from '@codemirror/view'

const GAP_PX = 6
const PANEL_MAX_WIDTH_PX = 440
const FLIP_VIEWPORT_FRACTION = 2 / 3
const PANEL_ESTIMATE_PX = 260

export interface InlinePanelAnchor {
  left: number
  top: number
  width: number
  placeAbove: boolean
}

function editorColumnRect(view: EditorView): DOMRect | null {
  const content = view.scrollDOM.querySelector('.cm-content')
  return content?.getBoundingClientRect() ?? null
}

/**
 * Anchor a flat inline panel to the line at `pos` (caret after slash removal).
 * Panel width matches the centered editor column (capped at 440px); sits 6px below
 * the line unless
 * that would clip in the bottom third of the viewport.
 */
export function computeInlinePanelAnchor(view: EditorView, pos: number): InlinePanelAnchor {
  const line = view.state.doc.lineAt(pos)
  const caret = view.coordsAtPos(pos)
  const lineEnd = view.coordsAtPos(line.to)
  const lineStart = view.coordsAtPos(line.from)
  const column = editorColumnRect(view)

  const fallbackLeft = caret?.left ?? 24
  const fallbackWidth = 672
  const left = column?.left ?? fallbackLeft
  const width = Math.min(column?.width ?? fallbackWidth, PANEL_MAX_WIDTH_PX)

  if (!lineEnd || !lineStart) {
    return { left, top: 120, width, placeAbove: false }
  }

  const belowTop = lineEnd.bottom + GAP_PX
  const wouldClip = belowTop + PANEL_ESTIMATE_PX > window.innerHeight * FLIP_VIEWPORT_FRACTION

  if (wouldClip && lineStart.top > PANEL_ESTIMATE_PX + GAP_PX) {
    return {
      left,
      width,
      top: lineStart.top - GAP_PX,
      placeAbove: true,
    }
  }

  return {
    left,
    width,
    top: belowTop,
    placeAbove: false,
  }
}
