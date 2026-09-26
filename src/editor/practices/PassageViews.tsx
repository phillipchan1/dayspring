import type { Passage, Verse } from './passage'
import { PassageText, type PassageMode } from './PassageText'
import './Passage.css'

interface BodyProps {
  passage: Passage
  /** The passage's verses from its chapter; null while loading, [] when it would not load. */
  verses: Verse[] | null
  mode: PassageMode
  caught: string | null
  cited?: readonly number[]
  onCatch?: (phrase: string) => void
  onCite?: (n: number) => void
  slow?: boolean
}

/**
 * The passage however it can be had: numbered verses when its chapter loads,
 * the fence's own words when it will not (offline — they were written into the
 * page when it was chosen), and a reference alone when it is being read from
 * the writer's own Bible.
 */
export function PassageBody({ passage, verses, mode, caught, cited, onCatch, onCite, slow }: BodyProps) {
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
    return (
      <PassageText
        verses={verses}
        mode={mode}
        caught={caught}
        cited={cited ?? []}
        {...(onCatch ? { onCatch } : {})}
        {...(onCite ? { onCite } : {})}
        slow={Boolean(slow)}
      />
    )
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
