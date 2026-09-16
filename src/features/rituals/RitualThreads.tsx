/**
 * Practices you have walked — the door back into a ritual.
 *
 * Rituals had three doors IN (the topbar on a blank page, the command bar,
 * `/ritual`) and none back out. This is the way back: your own answers to one
 * movement, in order, verbatim.
 *
 * ── It lives in the library's room on purpose ───────────────────────────────
 * Same `.practice-modal` shell, same sky, same hour. A ritual you are about to
 * walk and a ritual you have walked are two faces of one surface, not two
 * places, and the writer should not have to learn a second room to read back
 * what they wrote in the first.
 *
 * ── The rule this surface lives under ───────────────────────────────────────
 * Nothing on screen but the writer's own words and the date they wrote them.
 * No count, no streak, no gap, no completion ring. `RitualThread.walks` is
 * computed and never rendered. MORNING_RITUALS_PLAN §5.3 wrote the constraint
 * down before this existed: a row reflecting how often you practise is one
 * design review away from a frequency, and a frequency here is a streak
 * (Principle 2).
 *
 * A date on a single answer is a fact about a page. A number over a column is
 * a verdict about a person. That is the whole line.
 *
 * ── And nothing is computed ─────────────────────────────────────────────────
 * No summary, no "you keep saying the same thing", no model call. The reader
 * does the noticing. That is not a limitation of the build — it is the one
 * reading surface in the product that cannot hallucinate, because there is
 * nothing on it the writer did not type.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { skyFor } from '@/editor/practices/ritualSky'
import type { Entry } from '@/lib/types'
import { track } from '@/lib/analytics'
import {
  buildRitualThreads,
  openingMovement,
  type RitualMovementThread,
  type RitualThread,
} from './threads'
import './RitualThreads.css'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** "9 June 2026" — the archive's own way of saying when, never "3 months ago". */
function longDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

interface Props {
  /** The same array Pages renders from — no fetch, no new store. */
  entries: readonly Entry[]
  onClose: () => void
  /** Open the page an answer was written on. */
  onOpenEntry: (entryId: string) => void
  /** Injected for the `?__preview=` harness and App Store shots; the app omits it. */
  now?: Date
}

export function RitualThreads({ entries, onClose, onOpenEntry, now }: Props) {
  const threads = useMemo(() => buildRitualThreads(entries), [entries])
  const [openPractice, setOpenPractice] = useState<string | null>(null)
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  const sky = useMemo(() => skyFor(now ?? new Date()), [now])

  useEffect(() => {
    track('ritual_threads_opened', { practices: threads.length })
    // Once per mount — reopening the surface is a new open, changing practice is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      // Escape steps back one level before it leaves, so a misplaced key does
      // not throw away the reading position.
      if (openPractice) setOpenPractice(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [openPractice, onClose])

  const thread = openPractice ? (threads.find((t) => t.practice === openPractice) ?? null) : null
  const movement: RitualMovementThread | null = thread
    ? (thread.movements.find((m) => m.label === openLabel) ?? openingMovement(thread))
    : null

  return createPortal(
    <div
      className="practice-modal ritual-threads"
      role="dialog"
      aria-modal="true"
      aria-label="Practices you have walked"
      data-band={sky.band}
      data-stars={sky.stars ? 'true' : undefined}
    >
      {/* The same three inert sky layers the library renders — see PracticeLibrary.css. */}
      <div className="practice-sky practice-sky--fixed" aria-hidden />
      <div
        className="practice-sky practice-sky--hour"
        aria-hidden
        style={sky.tokens as CSSProperties}
      />
      <div className="practice-sky practice-sky--stars" aria-hidden />

      <button
        type="button"
        className="practice-modal__close"
        onClick={onClose}
        aria-label="Close"
        title="Close"
      >
        ✕
      </button>

      <div className="rt">
        {thread && movement ? (
          <ThreadView
            thread={thread}
            movement={movement}
            onPickMovement={setOpenLabel}
            onBack={() => {
              setOpenPractice(null)
              setOpenLabel(null)
            }}
            onOpenEntry={onOpenEntry}
          />
        ) : (
          <ShelfView
            threads={threads}
            onOpen={(p) => {
              setOpenPractice(p)
              setOpenLabel(null)
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}

function ShelfView({
  threads,
  onOpen,
}: {
  threads: RitualThread[]
  onOpen: (practice: string) => void
}) {
  return (
    <div className="rt__pane">
      <header className="rt__head">
        <h1 className="rt__title">Practices you have walked</h1>
        <p className="rt__sub">
          Ordered by when you last walked them. Open one to read back what you wrote.
        </p>
      </header>

      {threads.length === 0 ? (
        /* Principle 5 — tell the truth about a surface that needs history,
           rather than faking a starter row. */
        <p className="rt__empty">
          Nothing to read back yet. Once you have walked a ritual, your answers to each
          movement will gather here.
        </p>
      ) : (
        <div className="rt__shelf">
          {threads.map((t) => (
            <button
              key={t.practice}
              type="button"
              className="rt__row"
              onClick={() => onOpen(t.practice)}
            >
              <span className="rt__row-name">{t.practice}</span>
              {/* Last walked, and nothing else. No count, no gap. */}
              <span className="rt__row-when">{longDate(t.lastAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ThreadView({
  thread,
  movement,
  onPickMovement,
  onBack,
  onOpenEntry,
}: {
  thread: RitualThread
  movement: RitualMovementThread
  onPickMovement: (label: string) => void
  onBack: () => void
  onOpenEntry: (entryId: string) => void
}) {
  // A year heading over a column that is all one year is a label nobody needs.
  const spansYears = new Set(movement.answers.map((a) => a.at.slice(0, 4))).size > 1
  let lastYear = ''

  return (
    <div className="rt__pane">
      <button type="button" className="rt__back" onClick={onBack}>
        ← Practices
      </button>

      <h1 className="rt__title rt__title--practice">{thread.practice}</h1>

      {thread.movements.length > 1 && (
        <div className="rt__rail" role="tablist" aria-label="Movements">
          {thread.movements.map((m) => (
            <button
              key={m.label}
              type="button"
              role="tab"
              className="rt__rail-btn"
              aria-selected={m.label === movement.label}
              onClick={() => onPickMovement(m.label)}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <p className="rt__label">{movement.label}</p>
      {movement.question ? <h2 className="rt__question">{movement.question}</h2> : null}
      <p className="rt__sub rt__sub--tight">Your answers, newest first.</p>

      <div className="rt__answers">
        {movement.answers.map((a) => {
          const y = a.at.slice(0, 4)
          const showYear = spansYears && y !== lastYear
          lastYear = y
          return (
            <div key={`${a.entryId}-${a.at}`}>
              {showYear ? <div className="rt__year">{y}</div> : null}
              <button
                type="button"
                className="rt__answer"
                onClick={() => onOpenEntry(a.entryId)}
                title="Open this page"
              >
                <span className="rt__answer-date">{longDate(a.at)}</span>
                <span className="rt__answer-text">{a.text}</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
