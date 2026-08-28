import { useEffect, type ReactNode } from 'react'
import { ENTRIES, type MarkingKind } from './corpus'
import { KIND_META } from './kinds'
import { formatExpiry, formatRange, type Reading } from './span'

/**
 * The pieces every scene shares, so no scene can quietly invent a figure or a
 * heading. Anything that states a number takes it from `Reading` (span.ts).
 */

export function Dawn() {
  return <div className="dawn" aria-hidden />
}

export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * The head of the artifact: the occasion, the scope, the expiry.
 *
 * The occasion is a season and a year — a fact about the calendar, never a
 * name for what her summer WAS. "Summer" is when it happened; "A Season of
 * Waiting" would be the app telling her what it meant, which is the whole
 * thing this surface exists not to do.
 */
export function Head({ reading }: { reading: Reading }) {
  const { span, entries } = reading
  return (
    <header className="head">
      <h1 className="head__occasion">
        {span.label}
        <small>{span.to.slice(0, 4)}</small>
      </h1>

      {/* Scope, never comparison. See styles.css § .scope. */}
      <div className="scope">
        <span>{formatRange(entries)}</span>
        <span>
          <b>{entries.length}</b> {entries.length === 1 ? 'page' : 'pages'}
        </span>
      </div>

      <p className="expiry">
        <Hourglass />
        <span>This page is here until {formatExpiry(span.expires)}, and then it is gone.</span>
      </p>
    </header>
  )
}

/** Drawn thin, by the same hand as the marking glyphs. A stock icon reads as somebody else's software. */
function Hourglass() {
  return (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="none" aria-hidden>
      <path
        d="M1.5 1h8M1.5 12h8M2.5 1v2.2c0 1.4 3 2.6 3 3.3 0 .7-3 1.9-3 3.3V12M8.5 1v2.2c0 1.4-3 2.6-3 3.3 0 .7 3 1.9 3 3.3V12"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Movement({
  title,
  gloss,
  children,
}: {
  title: string
  gloss?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="movement">
      <h2 className="movement__h">{title}</h2>
      {gloss ? <p className="gloss">{gloss}</p> : null}
      {children}
    </section>
  )
}

export type LineItem = {
  entryId: string
  date: string
  text: string
  kind?: MarkingKind
  /** A word of hers to light inside her own sentence. Never a badge beside it. */
  lit?: string
}

/**
 * Her lines, gathered.
 *
 * Each carries its date and opens its page — RECALL's finding that the line is
 * the unit of memory, with the entry always one deliberate act away.
 */
export function Lines({ items, onOpen }: { items: LineItem[]; onOpen: (id: string) => void }) {
  return (
    <div className="lines">
      {items.map((it, i) => {
        const marked = Boolean(it.kind)
        return (
          <button
            key={`${it.entryId}-${i}`}
            type="button"
            className={marked ? 'line line--marked' : 'line'}
            style={it.kind ? ({ '--tone': `var(--k-${KIND_META[it.kind].tone})` } as React.CSSProperties) : undefined}
            onClick={() => onOpen(it.entryId)}
          >
            <span className="line__date">{formatDay(it.date)}</span>
            {marked ? <span className="line__rule" /> : null}
            <span className="line__text">{lit(it.text, it.lit)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Whole-word, case-folded. Nothing is stemmed — see span.ts § repeatedWords. */
export function lit(text: string, word?: string): ReactNode {
  if (!word) return text
  const re = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi')
  const parts = text.split(re)
  if (parts.length === 1) return text
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p))
}

/**
 * Her page, opened.
 *
 * Nothing on it but her words, her date, and the word that brought you here.
 * Pages.css rule 1 — no badge, no count, no chip, no title we invented.
 */
export function Evidence({ id, word, onClose }: { id: string; word?: string; onClose: () => void }) {
  const entry = ENTRIES.find((e) => e.id === id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!entry) return null
  return (
    <div className="evidence" role="dialog" aria-modal onClick={onClose}>
      <button type="button" className="evidence__close" onClick={onClose}>
        close
      </button>
      <article className="evidence__page" onClick={(e) => e.stopPropagation()}>
        <div className="evidence__date">{formatDay(entry.date)}</div>
        {entry.paragraphs.map((p, i) => (
          <p key={i} className="evidence__p">
            {lit(p, word)}
          </p>
        ))}
      </article>
    </div>
  )
}

/** The facilitator's toggles. Never rendered on the artifact itself. */
export function Rig({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rig">
      <span className="rig__label">{label}</span>
      {children}
    </div>
  )
}
