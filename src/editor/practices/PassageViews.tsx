import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Passage, Verse } from './passage'
import { PassageText, type Highlight, type PassageMode, type WordSpan } from './PassageText'
import './Passage.css'

interface BodyProps {
  passage: Passage
  /** The passage's verses from its chapter; null while loading, [] when it would not load. */
  verses: Verse[] | null
  mode: PassageMode
  caught: string | null
  cited?: readonly number[]
  highlights?: readonly Highlight[]
  lit?: string | null
  pending?: WordSpan | null
  onCatch?: (phrase: string) => void
  onCite?: (n: number) => void
  onChoosing?: (span: WordSpan | null) => void
  onChosen?: (span: WordSpan) => void
  onRest?: (at: { n: number; offset: number } | null) => void
  onHoverHighlight?: (keys: string[] | null, el: HTMLElement | null) => void
  slow?: boolean
}

/**
 * The passage however it can be had: numbered verses when its chapter loads,
 * the fence's own words when it will not (offline — they were written into the
 * page when it was chosen), and a reference alone when it is being read from
 * the writer's own Bible.
 */
export function PassageBody({ passage, verses, slow, ...text }: BodyProps) {
  if (passage.own) {
    return (
      <div className="rc__leaf-own">
        <b>{passage.reference}</b>
        Your own Bible is open beside you. The reference is all this page keeps, and it is enough to find it
        again.
      </div>
    )
  }
  if (verses && verses.length > 0) {
    return <PassageText verses={verses} {...text} slow={Boolean(slow)} />
  }
  if (verses === null && !passage.text) return <p className="rc__leaf-loading">Opening {passage.reference}…</p>
  return <p className="rc__leaf-fallback">{passage.text}</p>
}

/** The word that caught the writer, said back above the question. */
export function CaughtLine({
  phrase,
  small = false,
  onRelease,
}: {
  phrase: string
  small?: boolean
  onRelease?: () => void
}) {
  return (
    <p className="rc__caught" data-small={small ? 'true' : undefined}>
      <q>{phrase}</q>
      {onRelease && (
        <button type="button" onClick={onRelease}>
          choose another
        </button>
      )}
    </p>
  )
}

/** Rest: the word alone, and nothing to write. */
export function DwellView({ word }: { word: string }) {
  return (
    <div className="rc__dwell">
      <div className="rc__dwell-word">{word}</div>
      <p>Stay as long as you like.</p>
    </div>
  )
}

/** The phone's folded passage: the reference and the caught word, tap to open. */
export function PassageStrip({
  reference,
  word,
  open,
  onToggle,
}: {
  reference: string
  word: string | null
  open: boolean
  onToggle: () => void
}) {
  return (
    <button type="button" className="rc__strip" onClick={onToggle} aria-expanded={open}>
      <span className="rc__strip-ref">{reference}</span>
      {word && <span className="rc__strip-word">{word}</span>}
      <span className="rc__strip-chev" aria-hidden>
        {open ? '▴' : '▾'}
      </span>
    </button>
  )
}

const verseTag = (span: WordSpan) => (span.vEnd !== span.v ? `vv. ${span.v}–${span.vEnd}` : `v. ${span.v}`)

/**
 * Where the chosen words will land, before they do: a dashed quote standing at
 * the caret's line in the answer (below it when that line has writing on it).
 * The line from the passage runs to it, dashed, until the words are brought in.
 */
export function QuoteGhost({
  span,
  locate,
}: {
  span: WordSpan
  locate: () => { line: number; empty: boolean } | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const page = el?.closest<HTMLElement>('.rc__page')
    if (!el || !page) return
    const lines = [...page.querySelectorAll<HTMLElement>('.cm-content > .cm-line')]
    const at = locate()
    const pr = page.getBoundingClientRect()
    const line = at ? lines[Math.min(at.line, lines.length - 1)] : lines[lines.length - 1]
    if (!line) {
      setTop(null)
      return
    }
    const lr = line.getBoundingClientRect()
    setTop((at?.empty ? lr.top : lr.bottom + 6) - pr.top + page.scrollTop)
  }, [span, locate])
  return (
    <div className="rc__ghost" ref={ref} style={top == null ? undefined : { top }} aria-live="polite">
      {span.text}
      <span className="rc__ghost-v">{verseTag(span)}</span>
      <span className="rc__ghost-lands">lands here · ↵ to bring it in</span>
    </div>
  )
}

/** The one question a choice asks: bring it in? Beside the last chosen word. */
export function QuoteChip({ span, onBring, onLetGo }: { span: WordSpan; onBring: () => void; onLetGo: () => void }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const words = document.querySelectorAll<HTMLElement>('.rc--facing .psg__w[data-pending]')
    const last = words[words.length - 1]
    if (!last) return
    const rects = last.getClientRects()
    const r = rects[rects.length - 1] ?? last.getBoundingClientRect()
    setPos({ left: Math.min(r.right + 8, window.innerWidth - 240), top: r.bottom + 6 })
  }, [span])
  if (!pos) return null
  return createPortal(
    <div className="rc__chip" style={pos} role="group" aria-label="Bring these words in">
      <button type="button" className="rc__chip-go" onMouseDown={(e) => e.preventDefault()} onClick={onBring}>
        Reflect on this <kbd>↵</kbd>
      </button>
      <button type="button" className="rc__chip-x" onMouseDown={(e) => e.preventDefault()} onClick={onLetGo} aria-label="Let go">
        ×
      </button>
    </div>,
    document.body,
  )
}

/** Over a phrase already quoted: where it was quoted, and what was written after it. */
export function DrawnCard({
  el,
  rows,
  foot,
}: {
  el: HTMLElement
  rows: { key: string; label: string; said: string; tone: number }[]
  foot: string | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const card = ref.current
    if (!card) return
    const r = el.getClientRects()[0] ?? el.getBoundingClientRect()
    const h = card.offsetHeight
    const top = r.top - h - 10 < 12 ? r.bottom + 10 : r.top - h - 10
    setPos({ left: Math.max(12, Math.min(r.left, window.innerWidth - 320)), top })
  }, [el, rows.length])
  if (rows.length === 0) return null
  return createPortal(
    <div className="rc__card" ref={ref} style={pos ?? { visibility: 'hidden' }} role="tooltip">
      {rows.map((r) => (
        <div key={r.key} className="rc__card-row">
          <span className="rc__card-mv" data-tone={r.tone}>
            {r.label}
          </span>
          {r.said && <span className="rc__card-said">“{r.said.length > 140 ? `${r.said.slice(0, 140)}…` : r.said}”</span>}
        </div>
      ))}
      {foot && <span className="rc__card-foot">{foot}</span>}
    </div>,
    document.body,
  )
}
