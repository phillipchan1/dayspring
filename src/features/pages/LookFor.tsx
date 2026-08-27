import { useEffect, useMemo, useRef, useState } from 'react'
import type { MarkingChip } from './facets'
import type { KeptSubject } from './keptSubjects'
import { searchSubjects, withCounts, wordSubject, type Subject, type SubjectIndex } from './subjects'

/**
 * Look for.
 *
 * Collapsed by default, because the default experience is reading the pages
 * raw. What is ON shows beside the toggle; what is not is behind it. The
 * toggle is the opening of a sentence and the chips complete it — "look for —
 * Mom — the prayers" — so it carries no box of its own.
 *
 * ── Two typographic rules, both load-bearing ────────────────────────────────
 *
 * **Serif is her. Sans is us.** Subjects are set in the face the journal is
 * written in, because they are her words. Every label, gloss and count is sans,
 * one size, one weight, differing only in opacity. There is no mono in this
 * sheet: mono is for dates, and a date is a fact about a page rather than part
 * of a control.
 *
 * **One shape.** Every option is the same pill, whatever it does. What varies
 * is a hairline (kept) against a dashed line (noticed), and colour once
 * something is on. Three control shapes in one sheet is the same mistake as six
 * type styles wearing a different hat.
 *
 * ── What is deliberately not here ───────────────────────────────────────────
 *
 * Asking a question. `api/ask.ts` still exists and D-020's finding is recorded
 * against the day it returns — a vector hit has no word to light, answered by
 * lighting the nearest LINE and putting the writer's own sentence on the chip.
 * Until that is built, offering a question the surface cannot ground is worse
 * than not offering it.
 */

export interface LookChip {
  key: string
  label: string
  kind: 'subject' | 'marking'
  tone?: string
}

interface Props {
  /** Everything kept, in the order kept. Never sorted by size. */
  kept: KeptSubject[]
  /** Everything the journal noticed and she has not kept. */
  offered: Subject[]
  /** The corpus, indexed — the only source of a subject's page count. */
  index: SubjectIndex
  markings: MarkingChip[]
  chips: LookChip[]
  onToggleSubject: (subject: Subject) => void
  onToggleMarking: (key: string) => void
  onRemove: (key: string) => void
  onClear: () => void
  onKeep: (subject: Subject) => void
  onDrop: (key: string) => void
  /** Dim, or show only. Only offered once something is on. */
  onlyLit: boolean
  onOnlyLit: (v: boolean) => void
}

/** How many noticed subjects sit in the sheet before you have typed anything. */
const NOTICED_AT_REST = 6

export function LookFor({
  kept,
  offered,
  index,
  markings,
  chips,
  onToggleSubject,
  onToggleMarking,
  onRemove,
  onClear,
  onKeep,
  onDrop,
  onlyLit,
  onOnlyLit,
}: Props) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const on = useMemo(() => new Set(chips.map((c) => c.key)), [chips])
  const q = typed.trim()
  const searching = q.length > 0

  // Counted here, at the last moment, over the handful actually on screen.
  // Counting the whole vocabulary is hundreds of regexes across thousands of
  // pages, and this list never shows more than a dozen rows.
  const heldRows = useMemo(() => {
    const matched = q
      ? kept.filter((s) => s.label.toLowerCase().includes(q.toLowerCase()))
      : kept
    return withCounts(index, matched) as KeptSubject[]
  }, [kept, index, q])

  const noticedRows = useMemo(() => {
    const found = searching ? searchSubjects(offered, q, 8) : offered.slice(0, NOTICED_AT_REST * 3)
    // A pill that lights nothing is not an option anyone can use — the same rule
    // the marking pills follow by dimming.
    const counted = withCounts(index, found).filter((s) => s.count)
    return searching ? counted : counted.slice(0, NOTICED_AT_REST)
  }, [offered, index, q, searching])

  // Detection finds people and cannot find matters — it will never return
  // "marriage", because nobody capitalises it. So a matter becomes a subject
  // the moment she says so, typed from this same field.
  const mine = useMemo(() => {
    if (q.length < 2) return null
    const w = wordSubject(q)
    if (!w) return null
    const known = [...kept, ...offered].some((s) => s.label.toLowerCase() === q.toLowerCase())
    if (known) return null
    const [counted] = withCounts(index, [w])
    return counted ?? null
  }, [q, kept, offered, index])

  const nothing = heldRows.length === 0 && noticedRows.length === 0 && !mine

  return (
    <div className="pg-look" ref={box}>
      <div className="pg-look__row">
        <button
          type="button"
          className="pg-look__open"
          data-on={open ? 'true' : undefined}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {/*
            A lens drawn with the same thin hand as the marking glyphs rather
            than lifted from an icon set — this sits two inches from her own
            sentences, and a stock magnifier would read as somebody else's
            software.
          */}
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
            <circle cx="6.9" cy="6.9" r="4.6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M10.3 10.3 14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span>look for</span>
        </button>

        {chips.length > 0 ? (
          <div className="pg-look__on">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                className="pg-held"
                data-kind={c.kind}
                style={c.tone ? ({ ['--tone']: c.tone } as React.CSSProperties) : undefined}
                onClick={() => onRemove(c.key)}
                aria-label={`Stop looking for ${c.label}`}
              >
                {c.label}
                <svg viewBox="0 0 8 8" width="7" height="7" fill="none" aria-hidden>
                  <path
                    d="M1.5 1.5 6.5 6.5M6.5 1.5 1.5 6.5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ))}

            {/*
              Dim, or only. Off by default and staying that way — the pages that
              don't carry a word are what give the ones that do their shape.
            */}
            <button
              type="button"
              className="pg-look__only"
              data-on={onlyLit ? 'true' : undefined}
              aria-pressed={onlyLit}
              onClick={() => onOnlyLit(!onlyLit)}
            >
              only these
            </button>
            <button
              type="button"
              className="pg-look__clear"
              onClick={onClear}
              aria-label="Take everything off"
            >
              clear
            </button>
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="pg-sheet">
          <div className="pg-sheet__find">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.3" stroke="currentColor" strokeWidth="1.25" />
              <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            <input
              autoFocus
              value={typed}
              placeholder="a name, or a word you carry"
              aria-label="Find a subject"
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>

          <section className="pg-sheet__g">
            <h3>subject</h3>

            {/*
              First run. An empty row teaches nothing and looks broken, so the
              group opens on what the journal already noticed — with one line
              saying where those came from, because a name appearing without
              explanation is the app claiming to know her.
            */}
            {kept.length === 0 && !searching ? (
              <p className="pg-sheet__note">Names you wrote most often. Keep the ones you carry.</p>
            ) : null}

            <div className="pg-sheet__opts">
              {heldRows.map((s) => (
                <SubjectPill
                  key={s.key}
                  subject={s}
                  kept
                  on={on.has(s.key)}
                  onToggle={() => (on.has(s.key) ? onRemove(s.key) : onToggleSubject(s))}
                  onAside={() => onDrop(s.key)}
                />
              ))}

              {noticedRows.map((s) => (
                <SubjectPill
                  key={s.key}
                  subject={s}
                  kept={false}
                  on={on.has(s.key)}
                  onToggle={() => (on.has(s.key) ? onRemove(s.key) : onToggleSubject(s))}
                  onAside={() => onKeep(s)}
                />
              ))}

              {mine ? (
                <SubjectPill
                  subject={mine}
                  kept={false}
                  mine
                  on={on.has(mine.key)}
                  onToggle={() => (on.has(mine.key) ? onRemove(mine.key) : onToggleSubject(mine))}
                  onAside={() => onKeep(mine)}
                />
              ) : null}

              {searching && nothing ? (
                <p className="pg-sheet__note">Nothing in your pages says that.</p>
              ) : null}
            </div>
          </section>

          <section className="pg-sheet__g">
            <h3>
              marking
              <span>what you set apart, and what the journal noticed</span>
            </h3>
            <div className="pg-sheet__opts">
              {markings.map((m) => {
                const lit = on.has(m.key)
                return (
                  <span
                    key={m.key}
                    className="pg-pill pg-pill--mark"
                    data-on={lit ? 'true' : undefined}
                    data-off={m.count === 0 ? 'true' : undefined}
                    style={{ ['--tone']: m.tone } as React.CSSProperties}
                  >
                    <button
                      type="button"
                      className="pg-pill__hit"
                      disabled={m.count === 0}
                      onClick={() => (lit ? onRemove(m.key) : onToggleMarking(m.key))}
                    >
                      {m.label}
                      <i>{m.count}</i>
                    </button>
                  </span>
                )
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function SubjectPill({
  subject,
  kept,
  mine,
  on,
  onToggle,
  onAside,
}: {
  subject: Subject
  kept: boolean
  mine?: boolean
  on: boolean
  onToggle: () => void
  onAside: () => void
}) {
  return (
    <span
      className={`pg-pill ${kept ? 'pg-pill--kept' : 'pg-pill--noticed'}${mine ? ' pg-pill--mine' : ''}`}
      data-on={on ? 'true' : undefined}
    >
      <button type="button" className="pg-pill__hit" onClick={onToggle}>
        <em>{subject.label}</em>
        <i>{subject.count}</i>
      </button>
      {/*
        Keep, or stop keeping — the same slot, revealed on hover. Dropping is
        safe, and that is what makes keeping cheap enough to do: the journal
        still notices the name, nothing she wrote changes, and it is one click
        from kept again.
      */}
      <button
        type="button"
        className={`pg-pill__aside${kept ? '' : ' pg-pill__aside--keep'}`}
        title={kept ? `Stop keeping ${subject.label}` : `Keep ${subject.label}`}
        aria-label={kept ? `Stop keeping ${subject.label}` : `Keep ${subject.label}`}
        onClick={onAside}
      >
        {kept ? (
          <svg viewBox="0 0 8 8" width="7" height="7" fill="none" aria-hidden>
            <path
              d="M1.5 1.5 6.5 6.5M6.5 1.5 1.5 6.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10" width="9" height="9" fill="none" aria-hidden>
            <path d="M5 1.4v7.2M1.4 5h7.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </span>
  )
}
