import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EditorView } from '@codemirror/view'
import {
  applyFormat,
  applyHighlight,
  getFormatState,
  isFormatActive,
  selectionAnchorRect,
  type FormatAction,
  type FormatState,
} from './formatSelection'
import { FORMAT_BAR_ACTIONS, FormatBarIcon } from './formatBarIcons'
import { HIGHLIGHT_LABELS, HIGHLIGHT_ORDER } from '@/lib/highlightColors'

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
export function SelectionFormatBar({ anchor, onRequestLink }: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  /**
   * The colour row replaces the bar's own contents rather than opening a second
   * floating layer. This bar is already a portaled fixed element with bespoke
   * viewport clamping (including visualViewport, for the iOS keyboard); a nested
   * popover would need all of that again and would fall off-screen on touch.
   */
  const [swatches, setSwatches] = useState(false)

  // A fresh selection always returns to the formatting row.
  useEffect(() => setSwatches(false), [anchor])

  useLayoutEffect(() => {
    const el = barRef.current
    if (!anchor || !el) return
    const barRect = el.getBoundingClientRect()
    setPos(clampPosition(anchor.rect, barRect))
    // Width changes with the colour row, so re-measure whenever it appears.
  }, [anchor, swatches])

  if (!anchor) return null

  const run = (action: FormatAction) => {
    if (action === 'link') {
      onRequestLink(anchor.view)
      return
    }
    applyFormat(anchor.view, action)
  }

  const shell = (children: React.ReactNode) =>
    createPortal(
      <div
        ref={barRef}
        className={`format-bar${swatches ? ' format-bar--swatches' : ''}`}
        role="toolbar"
        aria-label={swatches ? 'Highlight colour' : 'Formatting'}
        style={{ left: pos.left, top: pos.top }}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && swatches) {
            e.stopPropagation()
            setSwatches(false)
          }
        }}
      >
        {children}
      </div>,
      document.body,
    )

  if (swatches) {
    const current = anchor.state.inline.highlight
    return shell(
      <>
        <button
          type="button"
          className="format-bar__btn format-bar__btn--back"
          title="Back to formatting"
          aria-label="Back to formatting"
          onClick={() => setSwatches(false)}
        >
          ‹
        </button>
        <span className="format-bar__sep" aria-hidden />
        {HIGHLIGHT_ORDER.map((color, i) => (
          <button
            key={color}
            type="button"
            className="format-bar__swatch"
            data-color={color}
            data-active={current === color ? 'true' : undefined}
            style={{ animationDelay: `${0.02 + i * 0.018}s` }}
            title={HIGHLIGHT_LABELS[color]}
            aria-label={HIGHLIGHT_LABELS[color]}
            aria-pressed={current === color}
            onClick={() => {
              applyHighlight(anchor.view, color)
              setSwatches(false)
            }}
          />
        ))}
      </>,
    )
  }

  return shell(
    FORMAT_BAR_ACTIONS.map(({ action, label, title }, i) => {
      const active = isFormatActive(anchor.state, action)
      const color = action === 'highlight' ? anchor.state.inline.highlight : null
      return (
        <span key={action} className="format-bar__group">
          {i === 6 ? <span className="format-bar__sep" aria-hidden /> : null}
          <button
            type="button"
            className="format-bar__btn"
            data-action={action}
            data-active={active ? 'true' : undefined}
            // An active highlight shows WHICH colour, so the button doubles as
            // the readout the swatch row would otherwise have to provide.
            style={
              {
                animationDelay: `${0.02 + i * 0.018}s`,
                ...(color ? { '--hl-hue': `var(--hl-${color})` } : null),
              } as React.CSSProperties
            }
            title={title}
            aria-label={label}
            aria-pressed={active}
            onClick={() => run(action)}
          >
            <FormatBarIcon action={action} />
          </button>
          {action === 'highlight' ? (
            <button
              type="button"
              className="format-bar__chevron"
              title="Highlight colour"
              aria-label="Choose highlight colour"
              aria-expanded={false}
              onClick={() => setSwatches(true)}
            >
              <span aria-hidden>⌄</span>
            </button>
          ) : null}
        </span>
      )
    }),
  )
}

export function anchorFromView(view: EditorView): FormatBarAnchor | null {
  const rect = selectionAnchorRect(view)
  const state = getFormatState(view)
  if (!rect || !state) return null
  return { view, rect, state }
}
