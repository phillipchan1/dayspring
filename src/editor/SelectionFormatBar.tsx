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
import { FORMAT_BAR_ACTIONS, FormatBarIcon } from './formatBarIcons'

export interface FormatBarAnchor {
  view: EditorView
  rect: DOMRect
  state: FormatState
}

interface Props {
  anchor: FormatBarAnchor | null
  /** Open the link popover for the current selection (⌘K equivalent). */
  onRequestLink: (view: EditorView) => void
}

function clampPosition(rect: DOMRect, bar: DOMRect) {
  const pad = 10
  const gap = 10
  let top = rect.top - bar.height - gap
  if (top < pad) top = rect.bottom + gap
  let left = rect.left + rect.width / 2 - bar.width / 2
  left = Math.max(pad, Math.min(left, window.innerWidth - bar.width - pad))
  top = Math.max(pad, Math.min(top, window.innerHeight - bar.height - pad))
  return { left, top }
}

/** Single-line markdown formatter that floats above the current selection. */
export function SelectionFormatBar({ anchor, onRequestLink }: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  useLayoutEffect(() => {
    const el = barRef.current
    if (!anchor || !el) return
    const barRect = el.getBoundingClientRect()
    setPos(clampPosition(anchor.rect, barRect))
  }, [anchor])

  if (!anchor) return null

  const run = (action: FormatAction) => {
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
      {FORMAT_BAR_ACTIONS.map(({ action, label, title }, i) => {
        const active = isFormatActive(anchor.state, action)
        return (
          <span key={action} className="format-bar__group">
            {i === 4 ? <span className="format-bar__sep" aria-hidden /> : null}
            <button
              type="button"
              className="format-bar__btn"
              data-active={active ? 'true' : undefined}
              style={{ animationDelay: `${0.02 + i * 0.018}s` }}
              title={title}
              aria-label={label}
              aria-pressed={active}
              onClick={() => run(action)}
            >
              <FormatBarIcon action={action} />
            </button>
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
