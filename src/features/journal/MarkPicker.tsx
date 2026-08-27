import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { markGlyphClass, markGlyphHtml } from '@/editor/markGlyph'
import { MARK_GROUPS, MARK_KINDS } from '@/lib/markKinds'
import { canMarkExistingLines } from '@/lib/markSelection'
import type { SpiritualItemType } from '@/lib/types'
import './MarkPicker.css'

/** Where the `+` was, in viewport px. */
export interface MarkPickerAnchor {
  top: number
  bottom: number
  left: number
}

/**
 * Choosing a kind for words already on the page.
 *
 * It opens **in the margin, on the rule**, never as a floating toolbar over the
 * text. That placement is the whole argument: the place you read markings is the
 * place you make them, and a bar that covers the sentence you are deciding about
 * is a bar that makes the decision harder.
 *
 * Seven kinds, grouped by the question each answers. All of them at once rather
 * than a group-then-kind drill-down: two taps for a gesture made mid-writing is
 * worse than a list of seven, and the groups give it enough structure that seven
 * never reads as a wall.
 *
 * Scripture is the one kind missing, and it has to be. Its words are not the
 * writer's own — a verse arrives verbatim from the ESV by reference, so there is
 * nothing on the page to wrap. It stays a /command.
 */
const PICKABLE = MARK_KINDS.filter((k) => canMarkExistingLines(k.kind))

export function MarkPicker({
  anchor,
  onPick,
  onDismiss,
}: {
  anchor: MarkPickerAnchor
  onPick: (kind: SpiritualItemType) => void
  onDismiss: () => void
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss()
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => {
          const next = c + (e.key === 'ArrowDown' ? 1 : -1)
          return (next + PICKABLE.length) % PICKABLE.length
        })
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        onPick(PICKABLE[cursor]!.kind)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [cursor, onPick, onDismiss])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onDismiss()
    }
    // Deferred a frame: the same mousedown that opened this would otherwise
    // close it again.
    const id = requestAnimationFrame(() => document.addEventListener('mousedown', onDown))
    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onDismiss])

  // Flip above when the list would run off the bottom. The estimate is fixed
  // because the list is: seven rows and four headings, always.
  const ESTIMATE = 320
  const below = anchor.bottom + 4
  const placeAbove = below + ESTIMATE > window.innerHeight && anchor.top > ESTIMATE
  const style: React.CSSProperties = placeAbove
    ? { left: anchor.left, bottom: window.innerHeight - anchor.top + 4 }
    : { left: anchor.left, top: below }

  let row = -1

  return createPortal(
    <div
      ref={rootRef}
      className="mark-picker"
      style={style}
      role="menu"
      aria-label="Set this apart as"
      // Never take focus: the selection about to be marked lives in the editor,
      // and a blur would collapse it.
      onMouseDown={(e) => e.preventDefault()}
    >
      {MARK_GROUPS.map((group) => {
        const kinds = PICKABLE.filter((k) => k.group === group.key)
        if (kinds.length === 0) return null
        return (
          <div className="mark-picker__group" key={group.key}>
            <p className="mark-picker__heading">{group.title}</p>
            {kinds.map((meta) => {
              row += 1
              const mine = row
              return (
                <button
                  key={meta.kind}
                  type="button"
                  role="menuitem"
                  className={`mark-picker__item${cursor === mine ? ' mark-picker__item--on' : ''}`}
                  onMouseEnter={() => setCursor(mine)}
                  onClick={() => onPick(meta.kind)}
                >
                  <span
                    className={`mark-picker__glyph ${markGlyphClass(meta.kind)}`}
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: markGlyphHtml(meta.kind) }}
                  />
                  <span className="mark-picker__text">
                    <span className="mark-picker__label">{meta.label}</span>
                    <span className="mark-picker__gloss">{meta.gloss}</span>
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
