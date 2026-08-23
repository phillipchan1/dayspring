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
import {
  FORMAT_BAR_ACTIONS,
  FormatBarIcon,
  IOS_EDIT_ACTIONS,
  IOS_MORE_ACTIONS,
  MARK_BAR_ACTION,
  type BarAction,
  type SystemAction,
} from './formatBarIcons'
import { HIGHLIGHT_LABELS, HIGHLIGHT_ORDER } from '@/lib/highlightColors'
import { isIOSTauri } from '@/lib/platform'
import { iosSelectionAction } from '@/lib/iosSelection'
import {
  copySelection,
  cutSelection,
  pasteSelection,
  replaceSelection,
  selectAll,
  selectedText,
  speakText,
} from './selectionEdit'

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

type Page = 'format' | 'swatches' | 'system' | 'replace'

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

function isSystemAction(action: BarAction): action is SystemAction {
  return (
    action === 'cut' ||
    action === 'copy' ||
    action === 'paste' ||
    action === 'lookup' ||
    action === 'translate' ||
    action === 'search' ||
    action === 'share' ||
    action === 'speak' ||
    action === 'replace' ||
    action === 'selectAll'
  )
}

/** Single-line markdown formatter that floats above the current selection. */
export function SelectionFormatBar({ anchor, onRequestLink, onMark, marked }: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const ios = isIOSTauri()
  /**
   * The colour row (and on iOS the system-menu overflow / Replace guesses)
   * replace the bar's own contents rather than opening a second floating
   * layer. This bar is already a portaled fixed element with bespoke
   * viewport clamping (including visualViewport, for the iOS keyboard).
   */
  const [page, setPage] = useState<Page>('format')
  const [guesses, setGuesses] = useState<string[]>([])

  // A fresh selection always returns to the formatting row.
  useEffect(() => {
    setPage('format')
    setGuesses([])
  }, [anchor])

  useLayoutEffect(() => {
    const el = barRef.current
    if (!anchor || !el) return
    const barRect = el.getBoundingClientRect()
    setPos(clampPosition(anchor.rect, barRect))
    // Width changes with the mark button, the colour row, and the iOS pages.
  }, [anchor, onMark, page, guesses, ios])

  if (!anchor) return null

  const formatActions = onMark
    ? [{ ...MARK_BAR_ACTION, sep: true as const }, ...FORMAT_BAR_ACTIONS]
    : ios
      ? FORMAT_BAR_ACTIONS.map((a, i) => (i === 0 ? { ...a, sep: true as const } : a))
      : FORMAT_BAR_ACTIONS

  const runSystem = async (action: SystemAction) => {
    const view = anchor.view
    const text = selectedText(view)
    if (action === 'cut') {
      cutSelection(view)
      return
    }
    if (action === 'copy') {
      copySelection(view)
      return
    }
    if (action === 'paste') {
      await pasteSelection(view)
      return
    }
    if (action === 'selectAll') {
      selectAll(view)
      setPage('format')
      return
    }
    if (action === 'speak') {
      speakText(text)
      return
    }
    if (action === 'replace') {
      const next = await iosSelectionAction('guesses', text)
      setGuesses(next ?? [])
      setPage('replace')
      return
    }
    await iosSelectionAction(action, text)
  }

  const run = (action: BarAction) => {
    if (isSystemAction(action)) {
      void runSystem(action)
      return
    }
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

  const pageLabel =
    page === 'swatches' ? 'Highlight colour' : page === 'system' ? 'Edit' : page === 'replace' ? 'Replace' : 'Formatting'

  const shell = (children: React.ReactNode) =>
    createPortal(
      <div
        ref={barRef}
        className={`format-bar${page === 'swatches' ? ' format-bar--swatches' : ''}${
          page === 'system' || page === 'replace' ? ' format-bar--system' : ''
        }${ios ? ' format-bar--ios' : ''}`}
        role="toolbar"
        aria-label={pageLabel}
        style={{ left: pos.left, top: pos.top }}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && page !== 'format') {
            e.stopPropagation()
            setPage('format')
          }
        }}
      >
        {children}
      </div>,
      document.body,
    )

  const backButton = (next: Page, label: string) => (
    <button
      type="button"
      className="format-bar__btn format-bar__btn--back"
      title={label}
      aria-label={label}
      onClick={() => setPage(next)}
    >
      ‹
    </button>
  )

  if (page === 'swatches') {
    const current = anchor.state.inline.highlight
    return shell(
      <>
        {backButton('format', 'Back to formatting')}
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
              setPage('format')
            }}
          />
        ))}
      </>,
    )
  }

  if (page === 'replace') {
    return shell(
      <>
        {backButton('system', 'Back to edit')}
        <span className="format-bar__sep" aria-hidden />
        {guesses.length === 0 ? (
          <span className="format-bar__empty">No Replacements</span>
        ) : (
          guesses.map((guess, i) => (
            <button
              key={`${guess}-${i}`}
              type="button"
              className="format-bar__guess"
              style={{ animationDelay: `${0.02 + i * 0.018}s` }}
              onClick={() => {
                replaceSelection(anchor.view, guess)
                setPage('format')
              }}
            >
              {guess}
            </button>
          ))
        )}
      </>,
    )
  }

  if (page === 'system') {
    return shell(
      <>
        {backButton('format', 'Back to formatting')}
        <span className="format-bar__sep" aria-hidden />
        {IOS_MORE_ACTIONS.map(({ action, label, title }, i) => (
          <button
            key={action}
            type="button"
            className="format-bar__btn"
            data-action={action}
            style={{ animationDelay: `${0.02 + i * 0.018}s` }}
            title={title}
            aria-label={label}
            onClick={() => run(action)}
          >
            <FormatBarIcon action={action} />
          </button>
        ))}
      </>,
    )
  }

  const leading = ios ? IOS_EDIT_ACTIONS : []
  const actions = [...leading, ...formatActions]

  return shell(
    <>
      {actions.map(({ action, label, title, sep }, i) => {
        const isMark = action === 'mark'
        const active = isSystemAction(action)
          ? false
          : isMark
            ? !!marked
            : isFormatActive(anchor.state, action as FormatAction)
        const color = action === 'highlight' ? anchor.state.inline.highlight : null
        return (
          <span key={action} className="format-bar__group">
            {sep && i > 0 ? <span className="format-bar__sep" aria-hidden /> : null}
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
              title={isMark && marked ? 'Unmark this passage' : title}
              aria-label={isMark && marked ? 'Unmark' : label}
              aria-pressed={isSystemAction(action) ? undefined : active}
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
                onClick={() => setPage('swatches')}
              >
                <span aria-hidden>⌄</span>
              </button>
            ) : null}
            {sep && i === 0 ? <span className="format-bar__sep" aria-hidden /> : null}
          </span>
        )
      })}
      {ios ? (
        <span className="format-bar__group">
          <span className="format-bar__sep" aria-hidden />
          <button
            type="button"
            className="format-bar__btn"
            data-action="more"
            title="More"
            aria-label="More"
            aria-expanded={false}
            onClick={() => setPage('system')}
          >
            <span className="format-bar__more" aria-hidden>
              ⋯
            </span>
          </button>
        </span>
      ) : null}
    </>,
  )
}

export function anchorFromView(view: EditorView): FormatBarAnchor | null {
  const rect = selectionAnchorRect(view)
  const state = getFormatState(view)
  if (!rect || !state) return null
  return { view, rect, state }
}
