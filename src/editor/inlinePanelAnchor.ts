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
 * The line below which a panel would feel cramped. Normally the bottom third of
 * the window, but when an on-screen keyboard is up (phone, or iPad without a
 * hardware keyboard) the visual viewport shrinks — so we also flip above the
 * top of the keyboard, never behind it.
 */
function flipLine(): number {
  const vv = window.visualViewport
  const keyboardTop = vv ? vv.offsetTop + vv.height - GAP_PX : window.innerHeight
  return Math.min(window.innerHeight * FLIP_VIEWPORT_FRACTION, keyboardTop)
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
  const wouldClip = belowTop + PANEL_ESTIMATE_PX > flipLine()

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

/**
 * Anchor a panel to a rendered block element instead of a text position. Block
 * widgets replace their text range, so `coordsAtPos` can't measure inside them —
 * we use the element's bounding rect for vertical placement and the editor
 * column for width/horizontal alignment.
 */
export function computeBlockPanelAnchor(view: EditorView, blockEl: HTMLElement): InlinePanelAnchor {
  const rect = blockEl.getBoundingClientRect()
  const column = editorColumnRect(view)
  const left = column?.left ?? rect.left
  const width = Math.min(column?.width ?? 672, PANEL_MAX_WIDTH_PX)

  const belowTop = rect.bottom + GAP_PX
  const wouldClip = belowTop + PANEL_ESTIMATE_PX > flipLine()

  if (wouldClip && rect.top > PANEL_ESTIMATE_PX + GAP_PX) {
    return { left, width, top: rect.top - GAP_PX, placeAbove: true }
  }
  return { left, width, top: belowTop, placeAbove: false }
}

/**
 * Anchor a panel to a run of ordinary text lines — the shape prayer and sense
 * take now that they render as marked lines rather than block widgets
 * (spiritualBlockDecoration.ts). Unlike `computeBlockPanelAnchor` there is no
 * single element to measure, so the run's vertical extent comes from the
 * document positions at either end.
 */
export function computeRangePanelAnchor(
  view: EditorView,
  from: number,
  to: number,
): InlinePanelAnchor {
  const column = editorColumnRect(view)
  const width = Math.min(column?.width ?? 672, PANEL_MAX_WIDTH_PX)
  const start = view.coordsAtPos(from)
  const end = view.coordsAtPos(to)
  const left = column?.left ?? start?.left ?? 24

  if (!start || !end) return { left, top: 120, width, placeAbove: false }

  const belowTop = end.bottom + GAP_PX
  const wouldClip = belowTop + PANEL_ESTIMATE_PX > flipLine()

  if (wouldClip && start.top > PANEL_ESTIMATE_PX + GAP_PX) {
    return { left, width, top: start.top - GAP_PX, placeAbove: true }
  }
  return { left, width, top: belowTop, placeAbove: false }
}
