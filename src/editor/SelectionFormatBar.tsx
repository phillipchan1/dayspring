import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery'
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

/** B/I/U/S are letters people already read as marks. Everything else is a word. */
function TouchFace({ action, label }: { action: BarAction; label: string }) {
  if (action === 'bold') return <span className="format-bar__glyph format-bar__glyph--bold">B</span>
  if (action === 'italic') return <span className="format-bar__glyph format-bar__glyph--italic">I</span>
  if (action === 'underline') return <span className="format-bar__glyph format-bar__glyph--underline">U</span>
  if (action === 'strike') return <span className="format-bar__glyph format-bar__glyph--strike">S</span>
  return <span className="format-bar__word">{label}</span>
}

/** Single-line markdown formatter that floats above the current selection. */
export function SelectionFormatBar({ anchor, onRequestLink, onMark, marked }: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const ios = isIOSTauri()
  const coarse = useMediaQuery('(pointer: coarse)')
  const phone = useIsMobile()
  // Phone-width counts even when Chrome's device mode lies about `pointer:
  // coarse` (it almost always does). iPad + finger still arrives via coarse;
  // iOS Tauri always does.
  const touch = ios || coarse || phone
  /**
   * The colour row (and on iOS the system-menu overflow / Replace guesses)
   * replace the bar's own contents rather than opening a second floating
   * layer. This bar is already a portaled fixed element with bespoke
   * viewport clamping (including visualViewport, for the iOS keyboard).
   */
  const [page, setPage] = useState<Page>('format')
  const [guesses, setGuesses] = useState<string[]>([])
  const [fade, setFade] = useState({ left: false, right: false })

  // A fresh selection always returns to the formatting row.
  useEffect(() => {
    setPage('format')
    setGuesses([])
  }, [anchor])

  const measureFade = useCallback(() => {
    const el = scrollRef.current
    if (!el) {
      setFade({ left: false, right: false })
      return
    }
    const { scrollLeft, clientWidth, scrollWidth } = el
    setFade({
      left: scrollLeft > 4,
      right: scrollLeft + clientWidth < scrollWidth - 4,
    })
  }, [])

  useLayoutEffect(() => {
    const el = barRef.current
    if (!anchor || !el) return
    const barRect = el.getBoundingClientRect()
    setPos(clampPosition(anchor.rect, barRect))
  }, [anchor, onMark, page, guesses, ios, touch])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = 0
    measureFade()
  }, [anchor, page, guesses, measureFade])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => measureFade()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureFade)
    ro?.observe(el)
    const vv = window.visualViewport
    vv?.addEventListener('resize', measureFade)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro?.disconnect()
      vv?.removeEventListener('resize', measureFade)
    }
  }, [anchor, page, measureFade])

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

  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  const maxWidth = Math.max(0, (vv?.width ?? window.innerWidth) - 16)

  const face = (action: BarAction, label: string) =>
    touch ? <TouchFace action={action} label={label} /> : <FormatBarIcon action={action} />

  const shell = (opts: { leading?: ReactNode; trailing?: ReactNode; children: ReactNode }) =>
    createPortal(
      <div
        ref={barRef}
        className={[
          'format-bar',
          page === 'swatches' ? 'format-bar--swatches' : '',
          page === 'system' || page === 'replace' ? 'format-bar--system' : '',
          ios ? 'format-bar--ios' : '',
          touch ? 'format-bar--touch' : '',
          fade.left ? 'format-bar--fade-left' : '',
          fade.right ? 'format-bar--fade-right' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="toolbar"
        aria-label={pageLabel}
        style={{ left: pos.left, top: pos.top, ...(touch ? { maxWidth } : null) }}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && page !== 'format') {
            e.stopPropagation()
            setPage('format')
          }
        }}
      >
        {opts.leading}
        <div ref={scrollRef} className="format-bar__scroller">
          {opts.children}
        </div>
        {opts.trailing}
      </div>,
      document.body,
    )

  const backButton = (next: Page, label: string) => (
    <button
      type="button"
      className="format-bar__btn format-bar__btn--nav format-bar__btn--back"
      title={label}
      aria-label={label}
      onClick={() => setPage(next)}
    >
      ‹
    </button>
  )

  if (page === 'swatches') {
    const current = anchor.state.inline.highlight
    return shell({
      leading: (
        <>
          {backButton('format', 'Back to formatting')}
          <span className="format-bar__sep" aria-hidden />
        </>
      ),
      children: HIGHLIGHT_ORDER.map((color, i) => (
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
      )),
    })
  }

  if (page === 'replace') {
    return shell({
      leading: (
        <>
          {backButton('system', 'Back to edit')}
          <span className="format-bar__sep" aria-hidden />
        </>
      ),
      children:
        guesses.length === 0 ? (
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
        ),
    })
  }

  if (page === 'system') {
    return shell({
      leading: (
        <>
          {backButton('format', 'Back to formatting')}
          <span className="format-bar__sep" aria-hidden />
        </>
      ),
      children: IOS_MORE_ACTIONS.map(({ action, label, title }, i) => (
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
          {face(action, label)}
        </button>
      )),
    })
  }

  const leading = ios ? IOS_EDIT_ACTIONS : []
  const actions = [...leading, ...formatActions]

  return shell({
    trailing: ios ? (
      <>
        <span className="format-bar__sep" aria-hidden />
        <button
          type="button"
          className="format-bar__btn format-bar__btn--nav"
          data-action="more"
          title="More"
          aria-label="More"
          aria-expanded={false}
          onClick={() => setPage('system')}
        >
          {touch ? <span className="format-bar__word">More</span> : <span className="format-bar__more">⋯</span>}
        </button>
      </>
    ) : null,
    children: actions.map(({ action, label, title, sep }, i) => {
      const isMark = action === 'mark'
      const shown = isMark && marked ? 'Unmark' : label
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
            {face(action, shown)}
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
    }),
  })
}

export function anchorFromView(view: EditorView): FormatBarAnchor | null {
  const rect = selectionAnchorRect(view)
  const state = getFormatState(view)
  if (!rect || !state) return null
  return { view, rect, state }
}
