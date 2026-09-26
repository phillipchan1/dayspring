import { useRef, useState } from 'react'
import { findPhrase, trimPhrase, type Verse } from './passage'
import './Passage.css'

/**
 * How the passage is being used right now. The movement kinds, plus `choose`
 * (the finder: verses are picked) and `plain` (on view, nothing to do to it).
 */
export type PassageMode = 'choose' | 'read' | 'mark' | 'carry' | 'dwell' | 'cite' | 'plain'

interface Props {
  verses: readonly Verse[]
  mode: PassageMode
  /** The word that caught the writer — lit wherever it appears. */
  caught?: string | null
  /** The finder's chosen span. */
  selected?: { from: number; to: number } | null
  /** Verses already quoted into the answer. */
  cited?: readonly number[]
  /** `mark`: a word or phrase was touched. */
  onCatch?: (phrase: string) => void
  /** `choose`: a verse was clicked (shift extends). */
  onVerse?: (n: number, extend: boolean) => void
  /** `cite`: a verse number was touched. */
  onCite?: (n: number) => void
  /** Re-read slowly: the verses arrive one after another. */
  slow?: boolean
}

interface Word {
  text: string
  start: number
  end: number
}

function wordsOf(text: string): Word[] {
  const out: Word[] = []
  let at = 0
  for (const w of text.split(' ')) {
    out.push({ text: w, start: at, end: at + w.length })
    at += w.length + 1
  }
  return out
}

/**
 * The passage as text you can act on: every word a target when a word is to
 * be caught, every verse number a target when a verse is to be quoted, every
 * verse a target when verses are being chosen. Otherwise, only text.
 *
 * Catching: click a word, or drag across a phrase with a mouse. On a touch
 * screen a tap catches a word, and a second tap in the same verse soon after
 * widens it to the phrase between — the drag a finger cannot do over text
 * without starting the system's own selection.
 */
export function PassageText({
  verses,
  mode,
  caught = null,
  selected = null,
  cited = [],
  onCatch,
  onVerse,
  onCite,
  slow = false,
}: Props) {
  const clean = verses.map((v) => ({ n: v.n, text: v.text.replace(/\s+/g, ' ').trim() }))
  const lit = findPhrase(clean, caught)
  const [drag, setDrag] = useState<{ v: number; a: number; b: number } | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  const lastTap = useRef<{ v: number; i: number; at: number } | null>(null)

  const finish = (v: number, a: number, b: number) => {
    const words = wordsOf(clean.find((x) => x.n === v)?.text ?? '')
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    const phrase = trimPhrase(words.slice(lo, hi + 1).map((w) => w.text).join(' '))
    if (phrase) onCatch?.(phrase)
  }

  const marking = mode === 'mark' && Boolean(onCatch)

  return (
    <div
      className="psg"
      data-mode={mode}
      data-slow={slow ? 'true' : undefined}
      onPointerUp={() => {
        const d = dragRef.current
        if (!d) return
        setDrag(null)
        if (d.a !== d.b) finish(d.v, d.a, d.b)
      }}
      onPointerLeave={() => setDrag(null)}
    >
      {clean.map((v, vi) => {
        const words = wordsOf(v.text)
        const inSel = selected != null && v.n >= selected.from && v.n <= selected.to
        return (
          <span
            key={v.n}
            className="psg__v"
            data-sel={inSel ? 'true' : undefined}
            data-cited={cited.includes(v.n) ? 'true' : undefined}
            style={slow ? { animationDelay: `${vi * 1.6}s` } : undefined}
            onClick={
              mode === 'choose' && onVerse ? (e) => onVerse(v.n, e.shiftKey) : undefined
            }
          >
            {mode === 'cite' && onCite ? (
              <button
                type="button"
                className="psg__n psg__n--cite"
                onClick={() => onCite(v.n)}
                aria-label={`Bring verse ${v.n} into your answer`}
                title="Bring this verse into your answer"
              >
                {v.n}
              </button>
            ) : (
              <sup className="psg__n">{v.n}</sup>
            )}
            {words.map((w, i) => {
              const on =
                lit != null && lit.n === v.n && w.end > lit.start && w.start < lit.end
              const pending =
                drag != null &&
                drag.v === v.n &&
                i >= Math.min(drag.a, drag.b) &&
                i <= Math.max(drag.a, drag.b)
              return (
                <span key={i}>
                  <span
                    className="psg__w"
                    data-on={on ? 'true' : undefined}
                    data-pending={pending ? 'true' : undefined}
                    {...(marking
                      ? {
                          onPointerDown: (e: React.PointerEvent) => {
                            if (e.pointerType !== 'mouse') return
                            e.preventDefault()
                            setDrag({ v: v.n, a: i, b: i })
                          },
                          onPointerEnter: () => {
                            const d = dragRef.current
                            if (d && d.v === v.n) setDrag({ ...d, b: i })
                          },
                          onClick: (e: React.MouseEvent) => {
                            // A mouse drag already caught its phrase on pointerup.
                            if ((e.nativeEvent as PointerEvent).pointerType === 'mouse' || e.detail > 1) {
                              finish(v.n, i, i)
                              return
                            }
                            const prev = lastTap.current
                            const now = Date.now()
                            if (prev && prev.v === v.n && prev.i !== i && now - prev.at < 4000) {
                              lastTap.current = null
                              finish(v.n, prev.i, i)
                              return
                            }
                            lastTap.current = { v: v.n, i, at: now }
                            finish(v.n, i, i)
                          },
                        }
                      : {})}
                  >
                    {w.text}
                  </span>
                  {i < words.length - 1 ? ' ' : ''}
                </span>
              )
            })}{' '}
          </span>
        )
      })}
    </div>
  )
}
