import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EditorView } from '@codemirror/view'
import {
  applyFormat,
  getFormatState,
  isFormatActive,
  selectionAnchorRect,
  type FormatAction,
  type FormatState,
} from './formatSelection'
import { FORMAT_BAR_ACTIONS, FormatBarIcon, MARK_BAR_ACTION, type BarAction } from './formatBarIcons'

export interface FormatBarAnchor {
  view: EditorView
  rect: DOMRect
  state: FormatState
}

interface Props {
  anchor: FormatBarAnchor | null
  /** Open the link popover for the current selection (⌘K equivalent). */
  onRequestLink: (view: EditorView) => void
  /**
   * Set the selected passage aside. Absent while composing — marking is a
   * READING act, so the button only exists on an entry from a previous day.
   * Today's entry gets the formatting bar it has always had.
   */
  onMark?: ((view: EditorView) => void) | undefined
  /** The selection is already marked — the button unmarks. */
  marked?: boolean | undefined
}

function clampPosition(rect: DOMRect, bar: DOMRect) {
  const pad = 10
  const gap = 10
  // Clamp to the visual viewport: on iOS the on-screen keyboard shrinks
  // visualViewport while window.innerHeight stays put, so clamping to the
  // window could park the bar behind the keyboard.
  const vv = window.visualViewport
  const vpLeft = vv?.offsetLeft ?? 0
  const vpTop = vv?.offsetTop ?? 0
  const vpRight = vpLeft + (vv?.width ?? window.innerWidth)
  const vpBottom = vpTop + (vv?.height ?? window.innerHeight)
  let top = rect.top - bar.height - gap
  if (top < vpTop + pad) top = rect.bottom + gap
  let left = rect.left + rect.width / 2 - bar.width / 2
  left = Math.max(vpLeft + pad, Math.min(left, vpRight - bar.width - pad))
  top = Math.max(vpTop + pad, Math.min(top, vpBottom - bar.height - pad))
  return { left, top }
}

/** Single-line markdown formatter that floats above the current selection. */
export function SelectionFormatBar({ anchor, onRequestLink, onMark, marked }: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  useLayoutEffect(() => {
    const el = barRef.current
    if (!anchor || !el) return
    const barRect = el.getBoundingClientRect()
    setPos(clampPosition(anchor.rect, barRect))
    // Width changes with the mark button, so re-measure when it appears.
  }, [anchor, onMark])

  if (!anchor) return null

  const actions = onMark
    ? [{ ...MARK_BAR_ACTION, sep: true as const }, ...FORMAT_BAR_ACTIONS]
    : FORMAT_BAR_ACTIONS

  const run = (action: BarAction) => {
    if (action === 'mark') {
      onMark?.(anchor.view)
      return
    }
    if (action === 'link') {
      onRequestLink(anchor.view)
      return
    }
    applyFormat(anchor.view, action)
  }

  return createPortal(
    <div
      ref={barRef}
      className="format-bar"
      role="toolbar"
      aria-label="Formatting"
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {actions.map(({ action, label, title, sep }, i) => {
        const isMark = action === 'mark'
        const active = isMark ? !!marked : isFormatActive(anchor.state, action as FormatAction)
        return (
          <span key={action} className="format-bar__group">
            {sep && i > 0 ? <span className="format-bar__sep" aria-hidden /> : null}
            <button
              type="button"
              className="format-bar__btn"
              data-action={action}
              data-active={active ? 'true' : undefined}
              style={{ animationDelay: `${0.02 + i * 0.018}s` }}
              title={isMark && marked ? 'Unmark this passage' : title}
              aria-label={isMark && marked ? 'Unmark' : label}
              aria-pressed={active}
              onClick={() => run(action)}
            >
              <FormatBarIcon action={action} />
            </button>
            {sep && i === 0 ? <span className="format-bar__sep" aria-hidden /> : null}
          </span>
        )
      })}
    </div>,
    document.body,
  )
}

export function anchorFromView(view: EditorView): FormatBarAnchor | null {
  const rect = selectionAnchorRect(view)
  const state = getFormatState(view)
  if (!rect || !state) return null
  return { view, rect, state }
}
