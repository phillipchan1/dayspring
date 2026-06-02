import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  label: string
  /** Italic subline under the title (e.g. Lamp tooltip). */
  subline?: string | undefined
  /** Shown in a kbd chip, e.g. ⌘N or [ */
  shortcut?: string | undefined
  active: boolean
  children: ReactNode
}

/** Spark-style hover hint — title row + optional subline beside collapsed rail icons. */
export function RailHint({ label, subline, shortcut, active, children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const syncPosition = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ x: r.right + 10, y: r.top + r.height / 2 })
  }, [])

  useEffect(() => {
    if (!visible) return
    syncPosition()
    window.addEventListener('scroll', syncPosition, true)
    window.addEventListener('resize', syncPosition)
    return () => {
      window.removeEventListener('scroll', syncPosition, true)
      window.removeEventListener('resize', syncPosition)
    }
  }, [visible, syncPosition])

  if (!active) return children

  return (
    <>
      <div
        ref={wrapRef}
        className="rail-hint-wrap"
        onMouseEnter={() => {
          syncPosition()
          setVisible(true)
        }}
        onMouseLeave={() => setVisible(false)}
        onFocusCapture={() => {
          syncPosition()
          setVisible(true)
        }}
        onBlurCapture={(e) => {
          const next = e.relatedTarget
          if (next instanceof Node && wrapRef.current?.contains(next)) return
          setVisible(false)
        }}
      >
        {children}
      </div>
      {visible &&
        createPortal(
          <div
            className={`rail-hint${subline ? ' rail-hint--rich' : ''}`}
            style={{ left: pos.x, top: pos.y }}
            role="tooltip"
          >
            <div className="rail-hint__head">
              <span className="rail-hint__label">{label}</span>
              {shortcut ? <kbd className="rail-hint__key">{shortcut}</kbd> : null}
            </div>
            {subline ? <span className="rail-hint__sub">{subline}</span> : null}
          </div>,
          document.body,
        )}
    </>
  )
}
