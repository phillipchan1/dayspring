import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useKeyboardInset } from '@/hooks/useKeyboard'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import type { SlashState } from './slashDetect'
import {
  firstCursor,
  itemAt,
  moveCursor,
  slashColumns,
  SLASH_COLUMNS,
  type SlashCursor,
  type SlashItem,
  type SlashSelection,
} from './slashCommands'
import { isTapGesture } from './slashTouch'
import { SpiritualBlockIcon } from './spiritualBlockIcons'
import { isGhostClick } from '@/lib/ghostClick'
// The sheet reuses CommandPopover's scrim, grab handle and rise animation, so
// every bottom sheet in the app reads as the same object.
import '@/features/capture/Capture.css'

interface Props {
  state: SlashState
  onSelect: (sel: SlashSelection) => void
  /** The list emptied out (or Escape) — close, leave the typed text alone. */
  onDismiss: () => void
  /** The user backed out on purpose — close *and* remove the `/command` text. */
  onCancel: () => void
}

export function SlashPalette({ state, onSelect, onDismiss, onCancel }: Props) {
  const isMobile = useIsMobile()
  const cols = slashColumns(state.query)
  const total = cols.reduce((n, c) => n + c.length, 0)

  const [cursor, setCursor] = useState<SlashCursor | null>(() => firstCursor(cols))
  // The keydown handler resolves Enter against the latest committed cursor
  // without re-subscribing on every arrow press.
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  const paletteRef = useRef<HTMLDivElement>(null)
  // The active row, so keyboard nav can scroll it into view. Hover updates the
  // cursor too, but we only follow with a scroll for keyboard moves (below).
  const activeRef = useRef<HTMLButtonElement>(null)
  const keyboardNavRef = useRef(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Re-seat the cursor whenever the query narrows or clears the list.
  useEffect(() => {
    setCursor(firstCursor(slashColumns(state.query)))
  }, [state.query])

  // Keep the highlighted row visible when arrowing through a list taller than
  // the palette. `nearest` avoids yanking the page or scrolling sideways.
  useEffect(() => {
    if (keyboardNavRef.current) {
      activeRef.current?.scrollIntoView({ block: 'nearest' })
      keyboardNavRef.current = false
    }
  }, [cursor])

  useEffect(() => {
    if (total === 0) onDismiss()
  }, [total, onDismiss])

  // Reposition when the visual viewport changes — on iOS the on-screen keyboard
  // shrinks visualViewport (window.innerHeight stays put), so without this the
  // palette can sit behind the keyboard.
  const [vvTick, setVvTick] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onChange = () => setVvTick((t) => t + 1)
    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)
    return () => {
      vv.removeEventListener('resize', onChange)
      vv.removeEventListener('scroll', onChange)
    }
  }, [])

  // Measure the rendered palette, then place it: clamp to the *visual* viewport
  // (the part not covered by the on-screen keyboard) on both axes and flip above
  // the caret when there isn't room below. Runs before paint (useLayoutEffect)
  // so it never flashes at the wrong spot. Touch skips all of this — the sheet
  // is docked to the bottom edge and never chases the caret.
  useLayoutEffect(() => {
    const el = paletteRef.current
    if (isMobile || !el || total === 0) return
    const r = el.getBoundingClientRect()
    const pad = 8
    const gap = 8
    const vv = window.visualViewport
    const vpLeft = vv?.offsetLeft ?? 0
    const vpTop = vv?.offsetTop ?? 0
    const vpRight = vpLeft + (vv?.width ?? window.innerWidth)
    const vpBottom = vpTop + (vv?.height ?? window.innerHeight)
    const left = Math.max(vpLeft + pad, Math.min(state.x, vpRight - r.width - pad))
    let top = state.y + gap
    if (top + r.height > vpBottom - pad) {
      const above = state.yTop - r.height - gap
      // Prefer above only when it actually fits better; otherwise pin in view.
      top = above >= vpTop + pad ? above : Math.max(vpTop + pad, vpBottom - r.height - pad)
    }
    setPos({ left, top })
  }, [state.x, state.y, state.yTop, total, vvTick, isMobile])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const colsNow = slashColumns(state.query)
      const move = (dir: 'up' | 'down' | 'left' | 'right') => {
        e.preventDefault()
        e.stopPropagation()
        keyboardNavRef.current = true
        setCursor((c) => (c ? moveCursor(colsNow, c, dir) : firstCursor(colsNow)))
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onDismiss()
      } else if (e.key === 'ArrowDown') {
        move('down')
      } else if (e.key === 'ArrowUp') {
        move('up')
      } else if (e.key === 'ArrowLeft') {
        move('left')
      } else if (e.key === 'ArrowRight') {
        move('right')
      } else if ((e.key === 'Enter' || e.key === 'Tab') && !e.repeat) {
        e.preventDefault()
        e.stopPropagation()
        const item = itemAt(colsNow, cursorRef.current)
        if (item) onSelect(item.selection)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [state.query, onSelect, onDismiss])

  // The touch that *opened* the palette must not also pick a row. Tapping to
  // place the caret next to an existing `/` re-opens the sheet under the finger,
  // and that same gesture's `touchend` used to land on whichever row happened to
  // be there — silently applying a Heading to a real entry, with no undo on
  // mobile to take it back. A row only fires when its own `touchstart` opened
  // the gesture, and only if that gesture stayed a tap (a scroll starts on a
  // row too, and used to choose it on lift).
  const touchStartRow = useRef<{
    sel: SlashSelection
    x: number
    y: number
    scrollTop: number
  } | null>(null)
  // iOS synthesizes a click ~300ms after the tap that opened the sheet. That
  // click lands on the scrim (or the editor behind it) and cancelled the menu
  // before a thumb could scroll or pick. Ignore dismissals for a beat.
  const openedAt = useRef(Date.now())

  // Docked above the keyboard rather than over the caret, so the line being
  // written stays visible while you choose.
  const keyboardInset = useKeyboardInset(isMobile)
  const { handlers: dragHandlers, dragY, dragging } = useSheetDismiss({
    onDismiss: onCancel,
    enabled: isMobile,
  })

  function cancelFromScrim() {
    if (isGhostClick(openedAt.current)) return
    onCancel()
  }

  if (total === 0) return null

  function renderRow(item: SlashItem, colIdx: number, rowIdx: number) {
    // Touch never pre-highlights: an already-tinted row reads as "this one is
    // selected", which is a lie until a finger lands on it.
    const active = !isMobile && cursor?.col === colIdx && cursor?.row === rowIdx
    // Desktop keeps format rows compact (the badge + name already say it) and
    // surfaces the description on hover. Touch has no hover, and the two-column
    // layout was truncating these mid-word, so the sheet shows them all.
    const showHint = isMobile || SLASH_COLUMNS[colIdx]?.key === 'capture'
    return (
      <button
        key={`${colIdx}-${item.selection.id}`}
        ref={active ? activeRef : undefined}
        role="option"
        aria-selected={active}
        className="slash-palette__item"
        data-active={active ? 'true' : undefined}
        title={item.hint}
        onMouseDown={(e) => {
          e.preventDefault()
          if (!isMobile) onSelect(item.selection)
        }}
        onTouchStart={(e) => {
          const t = e.changedTouches[0] ?? e.touches[0]
          if (!t) return
          const scroller = (e.currentTarget as Element).closest('[data-sheet-scroll]')
          touchStartRow.current = {
            sel: item.selection,
            x: t.clientX,
            y: t.clientY,
            scrollTop: scroller instanceof HTMLElement ? scroller.scrollTop : 0,
          }
        }}
        // Touch: select on touchend and swallow the synthesized mouse events.
        // iOS can drop the synthetic mousedown when the row re-renders under
        // the finger, which made taps unreliable. A scroll starts on a row
        // too — only a tap that barely moved is a choice.
        onTouchEnd={(e) => {
          const started = touchStartRow.current
          touchStartRow.current = null
          if (!started || started.sel !== item.selection) return
          const t = e.changedTouches[0]
          if (!t || !isTapGesture(started, { x: t.clientX, y: t.clientY })) return
          const scroller = (e.currentTarget as Element).closest('[data-sheet-scroll]')
          if (scroller instanceof HTMLElement && scroller.scrollTop !== started.scrollTop) {
            return
          }
          e.preventDefault()
          onSelect(item.selection)
        }}
        onTouchCancel={() => {
          touchStartRow.current = null
        }}
        onMouseEnter={() => setCursor({ col: colIdx as 0 | 1, row: rowIdx })}
      >
        <span
          className={`slash-palette__badge${
            item.selection.kind === 'spiritual' ? ' slash-palette__badge--icon' : ''
          }${item.badgeStyle ? ` slash-palette__badge--${item.badgeStyle}` : ''}`}
          aria-hidden
        >
          {item.selection.kind === 'spiritual' ? (
            <SpiritualBlockIcon id={item.selection.id} />
          ) : (
            item.badge
          )}
        </span>
        <span className="slash-palette__text">
          <span className="slash-palette__label">{item.label}</span>
          {showHint && <span className="slash-palette__hint">{item.hint}</span>}
        </span>
      </button>
    )
  }

  const groups = SLASH_COLUMNS.map((meta, colIdx) => {
    const items = cols[colIdx] ?? []
    if (items.length === 0) return null
    return (
      <div className="slash-palette__col" key={meta.key} role="group" aria-label={meta.title}>
        <div className="slash-palette__heading">{meta.title}</div>
        {items.map((item, rowIdx) => renderRow(item, colIdx, rowIdx))}
      </div>
    )
  })

  if (isMobile) {
    const sheet = (
      <div
        ref={paletteRef}
        className="slash-palette slash-palette--sheet"
        style={{
          bottom: keyboardInset,
          // Never more than half the space the keyboard leaves. A capture sheet
          // may grow toward full-screen because it *is* the task; this one is a
          // menu you pick from while writing, so the line being written has to
          // stay in view — the whole point of moving it off the caret. The list
          // scrolls for the rest.
          maxHeight: `calc((100dvh - ${keyboardInset}px) * 0.5)`,
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : undefined,
        }}
        role="listbox"
        aria-label="Commands"
      >
        {/* Pull-to-dismiss lives on the chrome only. The list is the point of
            this sheet — a downward drag on a row is a scroll, not a cancel. */}
        <div {...dragHandlers}>
          <div className="command-popover__grab" aria-hidden />
          <div className="slash-palette__sheet-head">
            <span className="slash-palette__sheet-title">Insert</span>
            {/* The scrim and the handle both cancel, but neither is labelled —
                this is the one exit that says what it does. */}
            <button
              type="button"
              className="slash-palette__cancel"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
        <div className="slash-palette__scroll" data-sheet-scroll>
          {groups}
        </div>
      </div>
    )
    return createPortal(
      <>
        {/* Tapping away cancels — and takes the `/` with it, so backing out
            never leaves a stray slash in the entry. */}
        <div className="command-popover__scrim" onClick={cancelFromScrim} aria-hidden />
        {sheet}
      </>,
      document.body,
    )
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    left: pos?.left ?? state.x,
    top: pos?.top ?? state.y + 8,
    visibility: pos ? 'visible' : 'hidden',
  }

  return createPortal(
    <div
      ref={paletteRef}
      className="slash-palette glass-surface"
      style={style}
      role="listbox"
      aria-label="Commands"
    >
      <div className="glass-surface__glow" aria-hidden />
      {groups}
    </div>,
    document.body,
  )
}
