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
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { skyFor } from '@/editor/practices/ritualSky'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { PUSH_MS, useEdgeSwipeBack } from '@/features/pages/edgeSwipe'
import { useArrowList } from '@/hooks/useArrowList'
import type { Entry } from '@/lib/types'
import { track } from '@/lib/analytics'
import {
  answerParts,
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

/**
 * An answer as the writer reads it. A Scripture passage shows only as its
 * reference, and a `>` line as a quotation — in a scripture ritual those are
 * the Bible's words, and nothing here may present them as the writer's own
 * (Guardrail H3). Spans, not blocks: this sits inside the answer's button.
 */
function AnswerText({ text }: { text: string }) {
  return (
    <span className="rt__answer-text">
      {answerParts(text).map((p, i) => (
        <span key={i} className={`rt__part rt__part--${p.kind}`}>
          {p.text}
        </span>
      ))}
    </span>
  )
}

interface Props {
  /** The same array Pages renders from — no fetch, no new store. */
  entries: readonly Entry[]
  onClose: () => void
  /** Open the page an answer was written on. */
  onOpenEntry: (entryId: string) => void
  /** Open straight on one practice's thread — from that ritual page's own link. */
  initialPractice?: string
  /** Injected for the `?__preview=` harness and App Store shots; the app omits it. */
  now?: Date
}

export function RitualThreads({ entries, onClose, onOpenEntry, initialPractice, now }: Props) {
  const threads = useMemo(() => buildRitualThreads(entries), [entries])
  const [openPractice, setOpenPractice] = useState<string | null>(initialPractice ?? null)
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
  // Opened straight onto a practice, the surface itself is arriving — the
  // thread is already there, not pushed in over a shelf nobody saw.
  const arrivedOn = useRef(initialPractice ?? null)
  const backToShelf = () => {
    arrivedOn.current = null
    setOpenPractice(null)
    setOpenLabel(null)
  }

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

      <button type="button" className="practice-modal__close" onClick={onClose} aria-label="Close">
        <svg className="rt__glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      {/*
        The shelf stays mounted under an open practice, so it keeps its place
        and is what a back-swipe uncovers. Inert while covered.
      */}
      <div className="rt" inert={thread !== null} aria-hidden={thread !== null || undefined}>
        <ShelfView
          threads={threads}
          onOpen={(p) => {
            arrivedOn.current = null
            setOpenPractice(p)
            setOpenLabel(null)
          }}
        />
      </div>

      {thread && movement ? (
        <ThreadPush
          key={thread.practice}
          sky={sky.tokens as CSSProperties}
          still={arrivedOn.current === thread.practice}
          onBack={backToShelf}
        >
          <ThreadView
            thread={thread}
            movement={movement}
            onPickMovement={setOpenLabel}
            onOpenEntry={onOpenEntry}
          />
        </ThreadPush>
      ) : null}
    </div>,
    document.body,
  )
}

/**
 * A practice's thread, pushed over the shelf.
 *
 * It used to swap in place: the same scroller re-filled (so the thread opened
 * at the shelf's scroll offset), no movement to say where it came from, and a
 * small "← Practices" text link as the only way back. Now it is a pushed view,
 * as the reader is on a phone — in from the right, an edge swipe back out
 * (`useEdgeSwipeBack`), its own scroller, and a back control at the top
 * leading corner, where a thumb and every iOS habit look for it. On a pointer
 * it arrives with a short fade; Macs do not slide their panes.
 *
 * The page carries its own copy of the sky. A pushed view is opaque, and the
 * sky is what this room is made of — a flat parchment sliding over it would be
 * a different room arriving.
 */
function ThreadPush({
  sky,
  still,
  onBack,
  children,
}: {
  sky: CSSProperties
  /** Already there when the surface opened: no entrance. */
  still: boolean
  onBack: () => void
  children: React.ReactNode
}) {
  const touch = useMediaQuery('(pointer: coarse)')
  const pushes = useMediaQuery('(max-width: 767px), (pointer: coarse)')
  const back = useEdgeSwipeBack({ onBack, enabled: touch })
  /*
   * The back control pops the way the swipe does where views push: the page
   * carries on out to the right and the shelf comes back with it, then the
   * practice is closed. On a pointer the page simply goes, as the reader's does.
   */
  const [popping, setPopping] = useState(false)
  const popTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(popTimer.current), [])
  const pop = () => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!pushes || still) return onBack()
    if (popping) return
    setPopping(true)
    popTimer.current = window.setTimeout(onBack, PUSH_MS)
  }
  const leaving = back.leaving || popping
  const out = popping ? 1 : back.out
  /*
   * The shelf is a sibling, so the push's progress is written on the modal they
   * share — per frame of a drag, through the DOM — for the shelf's parallax.
   */
  const layerRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    layerRef.current?.parentElement?.style.setProperty('--rt-out', String(out))
  }, [out])
  useLayoutEffect(() => {
    const host = layerRef.current?.parentElement
    return () => {
      host?.style.removeProperty('--rt-out')
    }
  }, [])
  return (
    <div
      ref={layerRef}
      className="rt-push"
      data-still={still ? 'true' : undefined}
      data-dragging={back.dragging ? 'true' : undefined}
      data-leaving={leaving ? 'true' : undefined}
      style={{ ['--rt-out']: out } as CSSProperties}
      {...back.handlers}
    >
      <div
        className="rt-push__slide"
        style={back.dragX && !back.leaving ? { transform: `translateX(${back.dragX}px)` } : undefined}
      >
        <div className="practice-sky practice-sky--fixed" aria-hidden />
        <div className="practice-sky practice-sky--hour" aria-hidden style={sky} />
        <div className="practice-sky practice-sky--stars" aria-hidden />

        <button type="button" className="rt__back" onClick={pop} aria-label="Back to Practices">
          <svg className="rt__glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span>Practices</span>
        </button>

        <div className="rt rt--thread">{children}</div>
      </div>
    </div>
  )
}

function ShelfView({
  threads,
  onOpen,
}: {
  threads: RitualThread[]
  onOpen: (practice: string) => void
}) {
  // ↑/↓ through the practices, one Tab stop for the lot; Return opens one.
  const rowKeys = useArrowList('.rt__row')
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
        <div className="rt__shelf" ref={rowKeys.ref} onKeyDown={rowKeys.onKeyDown} onFocus={rowKeys.onFocus}>
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
              {/* A row that pushes a view says so, faintly, at its trailing edge. */}
              <span className="rt__row-chev" aria-hidden>
                ›
              </span>
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
  onOpenEntry,
}: {
  thread: RitualThread
  movement: RitualMovementThread
  onPickMovement: (label: string) => void
  onOpenEntry: (entryId: string) => void
}) {
  // A year heading over a column that is all one year is a label nobody needs.
  const spansYears = new Set(movement.answers.map((a) => a.at.slice(0, 4))).size > 1
  let lastYear = ''

  return (
    <div className="rt__pane">
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
              <button type="button" className="rt__answer" onClick={() => onOpenEntry(a.entryId)}>
                <span className="rt__answer-date">{longDate(a.at)}</span>
                <AnswerText text={a.text} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
