import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
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
import { useMenuExit } from '@/hooks/useMenuKeyboard'
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
  /**
   * Summoned at a collapsed caret with ⌘⇧F rather than raised by a selection.
   * The caret keeps focus in the text, so the bar takes ←/→ for a roving
   * highlight and Return to apply (N4: a toolbar the keyboard can drive).
   */
  caret?: boolean
}

/** Keys the editor hands to the bar first (see Editor.tsx). True = consumed. */
export type FormatBarKeyHandler = (e: KeyboardEvent) => boolean

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
  /**
   * The selection is inside a scripture quotation, so Mark is the only thing
   * on offer.
   *
   * Bold edits the text; marking is an overlay on it. Borrowed words cannot be
   * edited — that is what `scriptureReadOnly` enforces — so a bar advertising
   * B / I / U over a verse would be four buttons that do nothing and one that
   * works. One button is not a reduced bar here, it is the whole truth about
   * what you can do to somebody else's sentence.
   */
  markOnly?: boolean | undefined
  /** Dismiss the bar (Escape on the formatting page). The selection stays. */
  onDismiss?: (() => void) | undefined
  /**
   * Where the bar puts its key handler for the editor to call. The editor's
   * window listener is registered at mount, ahead of the app's own Esc
   * handlers, so the bar's Esc is decided before anything else hears it.
   */
  keyHandlerRef?: MutableRefObject<FormatBarKeyHandler | null> | undefined
}

type Page = 'format' | 'swatches' | 'system' | 'replace'

/** Breathing room between the bar and the viewport's edges. */
const EDGE_PAD = 12

/**
 * Place a floating control above `rect` (below it when there's no room),
 * inside the VISUAL viewport. Shared with the link popover.
 */
export function clampPosition(rect: DOMRect, bar: DOMRect) {
  const pad = EDGE_PAD
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
export function SelectionFormatBar({
  anchor,
  onRequestLink,
  onMark,
  marked,
  markOnly,
  onDismiss,
  keyHandlerRef,
}: Props) {
  // The bar fades when it goes (N3) — it stays mounted, click-through, on the
  // last anchor until the fade is done. It arrives in one piece.
  const exit = useMenuExit(anchor)
  const live = exit.shown
  const leaving = exit.leaving
  const barRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined'
      ? 0
      : (window.visualViewport?.width ?? window.innerWidth),
  )
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

  // A fresh selection always returns to the formatting row. (Not on the way
  // out: the fading bar keeps the page it was on.)
  useEffect(() => {
    if (!anchor) return
    setPage('format')
    setGuesses([])
  }, [anchor])

  /*
   * Keys. Esc steps back a page, then dismisses — keeping the selection.
   * Summoned at the caret, ←/→ rove across the buttons and Return presses the
   * lit one; the highlight starts on the first. The handler is read by the
   * editor's own early window listener (keyHandlerRef).
   */
  const roveRef = useRef(0)
  const pageRef = useRef<Page>(page)
  pageRef.current = page
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  // Back to the first button when the bar is summoned anew or turns a page —
  // not each time it follows the caret, or Return would lose its place after
  // every press. Before the effect below that paints the highlight.
  const summoned = anchor ? (anchor.caret ? 'caret' : 'selection') : null
  useLayoutEffect(() => {
    roveRef.current = 0
  }, [summoned, page])
  const buttons = () =>
    Array.from(barRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
  useLayoutEffect(() => {
    const caret = !!anchor?.caret
    buttons().forEach((b, i) => {
      if (caret && i === roveRef.current) b.setAttribute('data-highlighted', 'true')
      else b.removeAttribute('data-highlighted')
    })
  })
  // Nothing drawn (see the markOnly guard below): no keys either.
  const drawn = anchor != null && !(markOnly && !onMark)
  useEffect(() => {
    if (!keyHandlerRef) return
    if (!anchor || !drawn) {
      keyHandlerRef.current = null
      return
    }
    const caret = !!anchor.caret
    keyHandlerRef.current = (e) => {
      if (e.isComposing) return false
      if (e.key === 'Escape') {
        if (pageRef.current !== 'format') setPage('format')
        else onDismissRef.current?.()
        return true
      }
      if (!caret || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return false
      const list = buttons()
      if (list.length === 0) return false
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowRight' ? 1 : -1
        roveRef.current = (roveRef.current + dir + list.length) % list.length
        list.forEach((b, i) =>
          i === roveRef.current ? b.setAttribute('data-highlighted', 'true') : b.removeAttribute('data-highlighted'),
        )
        list[roveRef.current]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
        return true
      }
      if (e.key === 'Enter') {
        list[Math.min(roveRef.current, list.length - 1)]?.click()
        return true
      }
      return false
    }
    return () => {
      keyHandlerRef.current = null
    }
  }, [anchor, drawn, keyHandlerRef])

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

  const positionBar = useCallback((refreshAnchor = false) => {
    const el = barRef.current
    if (!anchor || !el) return
    // `anchor.rect` is the opening snapshot. Re-read the live CodeMirror
    // coordinates because wrapping and the editor's viewport position can both
    // change while the application window is being resized.
    const selectionRect = refreshAnchor
      ? (selectionAnchorRect(anchor.view) ?? anchor.rect)
      : anchor.rect
    setPos(clampPosition(selectionRect, el.getBoundingClientRect()))
    setViewportWidth(window.visualViewport?.width ?? window.innerWidth)
  }, [anchor])

  useLayoutEffect(() => {
    positionBar()
  }, [positionBar, onMark, page, guesses, ios, touch])

  useEffect(() => {
    if (!anchor) return
    let frame: number | null = null
    const schedulePosition = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        positionBar(true)
      })
    }

    window.addEventListener('resize', schedulePosition, { passive: true })
    const vv = window.visualViewport
    vv?.addEventListener('resize', schedulePosition)
    vv?.addEventListener('scroll', schedulePosition)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedulePosition)
    ro?.observe(anchor.view.dom)

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedulePosition)
      vv?.removeEventListener('resize', schedulePosition)
      vv?.removeEventListener('scroll', schedulePosition)
      ro?.disconnect()
    }
  }, [anchor, positionBar])

  useLayoutEffect(() => {
    if (!anchor) return
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

  if (!live) return null
  // Borrowed words with nowhere to hang a mark — an entry that has not been
  // saved yet, so there is no id for `marks` to key on. The bar would be a
  // single button that does nothing, and the honest version of that is no bar.
  if (markOnly && !onMark) return null

  const formatActions: { action: BarAction; label: string; title: string; sep?: true }[] = markOnly
    ? [MARK_BAR_ACTION]
    : onMark
      ? [{ ...MARK_BAR_ACTION, sep: true as const }, ...FORMAT_BAR_ACTIONS]
      : ios
        ? FORMAT_BAR_ACTIONS.map((a, i) => (i === 0 ? { ...a, sep: true as const } : a))
        : FORMAT_BAR_ACTIONS

  const runSystem = async (action: SystemAction) => {
    const view = live.view
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
      onMark?.(live.view)
      return
    }
    if (action === 'link') {
      onRequestLink(live.view)
      return
    }
    applyFormat(live.view, action)
  }

  const pageLabel =
    page === 'swatches' ? 'Highlight colour' : page === 'system' ? 'Edit' : page === 'replace' ? 'Replace' : 'Formatting'

  // Both edges' padding. This was `- 16` against a 10px pad each side, so a
  // bar at full width could only be placed with its right edge off-screen —
  // on a phone, the touch row's last label sat cut in half against the glass.
  const maxWidth = Math.max(0, viewportWidth - EDGE_PAD * 2)

  const face = (action: BarAction, label: string) =>
    // A lone bookmark glyph floating over a verse is a riddle; with only one
    // action on the bar there is room for the word, and the word is clearer.
    touch || markOnly ? (
      <TouchFace action={action} label={label} />
    ) : (
      <FormatBarIcon action={action} />
    )

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
        data-leaving={leaving ? 'true' : undefined}
        style={{ left: pos.left, top: pos.top, ...(touch ? { maxWidth } : null) }}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Focus inside the bar (a click on iOS, Tab): the same Esc as the editor's.
          if (e.key !== 'Escape') return
          e.stopPropagation()
          if (page !== 'format') {
            setPage('format')
            return
          }
          onDismiss?.()
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
    const current = live.state.inline.highlight
    return shell({
      leading: (
        <>
          {backButton('format', 'Back to formatting')}
          <span className="format-bar__sep" aria-hidden />
        </>
      ),
      children: HIGHLIGHT_ORDER.map((color) => (
        <button
          key={color}
          type="button"
          className="format-bar__swatch"
          data-color={color}
          data-active={current === color ? 'true' : undefined}
          title={HIGHLIGHT_LABELS[color]}
          aria-label={HIGHLIGHT_LABELS[color]}
          aria-pressed={current === color}
          onClick={() => {
            applyHighlight(live.view, color)
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
              onClick={() => {
                replaceSelection(live.view, guess)
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
      children: IOS_MORE_ACTIONS.map(({ action, label, title }) => (
        <button
          key={action}
          type="button"
          className="format-bar__btn"
          data-action={action}
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
          : isFormatActive(live.state, action as FormatAction)
      const color = action === 'highlight' ? live.state.inline.highlight : null
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
              color ? ({ '--hl-hue': `var(--hl-${color})` } as React.CSSProperties) : undefined
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

export function anchorFromView(view: EditorView, caret = false): FormatBarAnchor | null {
  const rect = selectionAnchorRect(view)
  if (!rect) return null
  return { view, rect, state: getFormatState(view), ...(caret ? { caret: true } : null) }
}
