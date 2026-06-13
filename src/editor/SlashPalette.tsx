import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SlashState } from './slashDetect'
import {
  filterSlashItems,
  firstCursor,
  itemAt,
  moveCursor,
  SLASH_COLUMNS,
  type SlashCursor,
  type SlashItem,
  type SlashSelection,
} from './slashCommands'

interface Props {
  state: SlashState
  onSelect: (sel: SlashSelection) => void
  onDismiss: () => void
}

export function SlashPalette({ state, onSelect, onDismiss }: Props) {
  const { capture, format } = filterSlashItems(state.query)
  const cols: SlashItem[][] = [capture, format]
  const total = capture.length + format.length

  const [cursor, setCursor] = useState<SlashCursor | null>(() => firstCursor(cols))
  // The keydown handler resolves Enter against the latest committed cursor
  // without re-subscribing on every arrow press.
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  const paletteRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Re-seat the cursor whenever the query narrows or clears the list.
  useEffect(() => {
    const next = filterSlashItems(state.query)
    setCursor(firstCursor([next.capture, next.format]))
  }, [state.query])

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
  // so it never flashes at the wrong spot.
  useLayoutEffect(() => {
    const el = paletteRef.current
    if (!el || total === 0) return
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
  }, [state.x, state.y, state.yTop, total, vvTick])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const next = filterSlashItems(state.query)
      const colsNow: SlashItem[][] = [next.capture, next.format]
      const move = (dir: 'up' | 'down' | 'left' | 'right') => {
        e.preventDefault()
        e.stopPropagation()
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

  if (total === 0) return null

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
      {SLASH_COLUMNS.map((meta, colIdx) => {
        const items = cols[colIdx] ?? []
        if (items.length === 0) return null
        return (
          <div className="slash-palette__col" key={meta.key} role="group" aria-label={meta.title}>
            <div className="slash-palette__heading">{meta.title}</div>
            {items.map((item, rowIdx) => {
              const active = cursor?.col === colIdx && cursor?.row === rowIdx
              return (
                <button
                  key={`${meta.key}-${item.selection.id}`}
                  role="option"
                  aria-selected={active}
                  className="slash-palette__item"
                  data-active={active ? 'true' : undefined}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onSelect(item.selection)
                  }}
                  // Touch: select on touchend and swallow the synthesized mouse
                  // events. iOS can drop the synthetic mousedown when the row
                  // re-renders under the finger, which made taps unreliable.
                  onTouchEnd={(e) => {
                    e.preventDefault()
                    onSelect(item.selection)
                  }}
                  onMouseEnter={() => setCursor({ col: colIdx as 0 | 1, row: rowIdx })}
                >
                  <span
                    className={`slash-palette__badge${
                      item.badgeStyle ? ` slash-palette__badge--${item.badgeStyle}` : ''
                    }`}
                    aria-hidden
                  >
                    {item.badge}
                  </span>
                  <span className="slash-palette__text">
                    <span className="slash-palette__label">{item.label}</span>
                    <span className="slash-palette__hint">{item.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
