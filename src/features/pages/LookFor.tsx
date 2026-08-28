import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import type { MarkingChip } from './facets'
import type { KeptSubject } from './keptSubjects'
import { searchSubjects, withCounts, wordSubject, type Subject, type SubjectIndex } from './subjects'
import { READINGS, type Reading } from './readings'
import { MarkGlyph } from '@/components/MarkGlyph'
import { LitChips, type LookChip } from './LitChips'

export type { LookChip }

/**
 * Look for.
 *
 * Collapsed by default, because the default experience is reading the pages
 * raw. What is ON shows beside the toggle; what is not is behind it.
 *
 * ── Why this one is a button, against the prototype ─────────────────────────
 *
 * The prototype gives it no box: "look for" is the opening of a sentence the
 * chips complete, and a bordered button would read as machinery sitting on top
 * of her writing. That argument holds where it was made — inside the wall, two
 * inches from her own sentences.
 *
 * Here it sits in a header band above the wall, and set in serif lowercase with
 * no outline it read as a caption rather than a control: the single richest
 * thing on the surface, and nothing about it said it could be pressed. So it
 * gets a hairline, a chevron, and the app's own sans. The restraint moves
 * inward instead — the sheet it opens carries no chrome at all.
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

interface Props {
  /** Everything kept, in the order kept. Never sorted by size. */
  kept: KeptSubject[]
  /** Everything the journal noticed and she has not kept. */
  offered: Subject[]
  /** The corpus, indexed — the only source of a subject's page count. */
  index: SubjectIndex
  markings: MarkingChip[]
  /**
   * How close you are standing. It lives on the surface rather than in the
   * sheet, because it is not part of what you are looking FOR — and it is one
   * continuous move rather than named stops, because naming them makes you pick
   * a mode instead of simply standing closer. The label says where you are; it
   * is not a control.
   */
  zoom: number
  onZoom: (z: number) => void
  /**
   * A phone-width viewport — the sheet becomes a bottom sheet.
   *
   * Not a style choice. As a dropdown it hangs off a control near the top of
   * the screen, so on a phone the status bar and the dynamic island sit over
   * its head and the keyboard takes the rest: you got a filter you could see
   * about a third of. Coming up from the bottom puts it in the thumb's half of
   * the screen with the keyboard below it rather than across it.
   */
  narrow: boolean
  standLabel: string
  reading: Reading
  onReading: (r: Reading) => void
  chips: LookChip[]
  onToggleSubject: (subject: Subject) => void
  onToggleMarking: (key: string) => void
  onRemove: (key: string) => void
  onClear: () => void
  /** Flip the notebook open. Uniformly random — nothing recommended. */
  onSomewhere: () => void
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
  zoom,
  onZoom,
  narrow,
  standLabel,
  reading,
  onReading,
  chips,
  onToggleSubject,
  onToggleMarking,
  onRemove,
  onClear,
  onSomewhere,
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
    /*
     * A tap away shuts a dropdown. It must NOT be wired up for the bottom
     * sheet: that one renders through a portal (see the note where it is
     * rendered), so every tap inside it lands outside `box` and would shut the
     * sheet on the way to the pill you were aiming at. The scrim is the sheet's
     * tap-away, and it is visible, which a document listener never is.
     */
    const away = (e: PointerEvent) => {
      if (narrow) return
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
  }, [open, narrow])

  /*
   * A bottom sheet you cannot flick away is not a bottom sheet.
   *
   * The grabber is the visible half of this and the drag is the other half; the
   * hook hands the gesture back to the sheet's own scroller whenever the finger
   * lands somewhere already scrolled, so pulling the options back up never
   * throws the sheet off the screen.
   */
  const sheet = useSheetDismiss({ onDismiss: () => setOpen(false), enabled: narrow && open })

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
    // Counted, never filtered: what she keeps is hers, and a kept name that has
    // nothing in the bracketed stretch is dimmed rather than taken away.
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
    <div className="pg-look" data-narrow={narrow ? 'true' : undefined} ref={box}>
      <div className="pg-look__row">
        {/*
          THE CONTROL, and where a thumb finds it.

          On a phone this is the primary act of the surface — you came to look
          for something — and it was a 0.78rem hairline button in the far top
          corner, which is the hardest place on a phone to reach and the easiest
          to mistake for a caption. On narrow it becomes a floating pill in the
          bottom corner opposite `New entry`: same 52px disc height as that FAB,
          neutral rather than accent (writing is the primary act of the APP), and
          carrying the number of things currently on so the count is legible
          without opening anything.

          Still the same button, in the same place in the DOM — the
          pointerdown-away handler and `aria-expanded` both depend on that, and
          a second element for narrow would be two things to keep in step.
        */}
        <button
          type="button"
          className="pg-look__open"
          data-on={open ? 'true' : undefined}
          data-lit={chips.length > 0 ? 'true' : undefined}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {/*
            A lens drawn with the same thin hand as the marking glyphs rather
            than lifted from an icon set — this sits two inches from her own
            sentences, and a stock magnifier would read as somebody else's
            software.
          */}
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden>
            <circle cx="6.9" cy="6.9" r="4.6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.3 10.3 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span>Look for</span>
          {chips.length > 0 ? (
            <i className="pg-look__count" aria-label={`${chips.length} on`}>
              {chips.length}
            </i>
          ) : null}
          <svg
            className="pg-look__chev"
            viewBox="0 0 10 6"
            width="9"
            height="6"
            fill="none"
            aria-hidden
          >
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>

        {chips.length > 0 ? (
          <div className="pg-look__on">
            <LitChips chips={chips} onRemove={onRemove} />

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

        <button
          type="button"
          className="pg-look__somewhere"
          onClick={onSomewhere}
          title="Open a page at random"
          aria-label="Open a page at random"
        >
          {/*
            A notebook falling open, not a shuffle arrow.

            This was the media-player shuffle glyph — five arrows crossing —
            which is the one piece of somebody else's software left on this
            surface, and it says "randomise a queue" rather than what actually
            happens. What actually happens is the gesture everyone already has
            for a notebook: you let it fall open somewhere. So: a spine, two
            leaves falling away from it, and one page lifting.
          */}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
            <path
              d="M12 7.4v11.2"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <path
              d="M12 7.4C10.3 6.2 7.9 5.7 5 5.9v10.9c2.9-.2 5.3.3 7 1.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 7.4c1.7-1.2 4.1-1.7 7-1.5v10.9c-2.9-.2-5.3.3-7 1.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* The leaf caught mid-turn — the whole reason to press it. */}
            <path
              d="M12 7.4c1.5-2 3-3.1 4.6-3.4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>
        </button>

        <label className="pg-stand">
          <span className="pg-stand__where">{standLabel}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={zoom}
            aria-label="How close you're standing"
            onChange={(e) => onZoom(Number(e.target.value))}
          />
        </label>
      </div>

      {open ? (
        <Layer portal={narrow}>
          {narrow ? (
            <button
              type="button"
              className="pg-sheet__scrim"
              aria-label="Close"
              onClick={() => setOpen(false)}
            />
          ) : null}

          <div
          className="pg-sheet"
          role={narrow ? 'dialog' : undefined}
          aria-modal={narrow || undefined}
          data-narrow={narrow ? 'true' : undefined}
          data-sheet-scroll={narrow ? 'true' : undefined}
          data-dragging={sheet.dragging ? 'true' : undefined}
          // The `translate` property, not `transform`: the entrance animation
          // owns `transform`, and an animation with a `both` fill beats an
          // inline style on the same property for good. The two compose.
          style={sheet.dragY ? { translate: `0 ${sheet.dragY}px` } : undefined}
          {...sheet.handlers}
        >
          {narrow ? <span className="pg-sheet__grab" aria-hidden /> : null}
          <div className="pg-sheet__find">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.3" stroke="currentColor" strokeWidth="1.25" />
              <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>
            {/*
              Focused on a pointer, never on a phone.

              Autofocus is right at a keyboard — the sheet opens ready to type.
              On a phone it summons the keyboard over half the screen before the
              reader has seen a single option, so what opens is a search field
              and a sliver of the thing they came to look at. The kept pills and
              the markings are the point of this sheet; typing is one of the
              ways in, not the way in. Tapping the field still opens the
              keyboard, at the moment that is what was asked for.
            */}
            <input
              autoFocus={!narrow}
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
                      {/*
                        The kind's own hand, the same one the editor's margin
                        draws. Six words in a row is a list to read; six words
                        each wearing the stroke you make in a margin is a set
                        you recognise — and it is the app's existing language
                        rather than a second one invented for this sheet.
                      */}
                      <MarkGlyph kind={m.kind} className="pg-pill__glyph" />
                      {m.label}
                      <i>{m.count}</i>
                    </button>
                  </span>
                )
              })}
            </div>
          </section>

          {/*
            Four plain pills and ONE gloss — the chosen one. Describing every
            option is four explanations for one decision, and it doubles the
            type in the sheet to do it.

            Never dimmed until a subject is chosen, either. Greying this out is
            exactly what made "the words you used" impossible to find: you would
            open the sheet on the wall, see a dead group, and never learn what
            was in it. Every reading arranges whatever is on screen.
          */}
          <section className="pg-sheet__g">
            <h3>reading</h3>
            <div className="pg-sheet__opts">
              {READINGS.map((r) => (
                <span
                  key={r.id}
                  className="pg-pill pg-pill--read"
                  data-on={reading === r.id ? 'true' : undefined}
                >
                  <button type="button" className="pg-pill__hit" onClick={() => onReading(r.id)}>
                    {r.label}
                  </button>
                </span>
              ))}
            </div>
            <p className="pg-sheet__gloss">{READINGS.find((r) => r.id === reading)?.gloss}</p>
          </section>
          </div>
        </Layer>
      ) : null}
    </div>
  )
}

/**
 * The bottom sheet, out of the surface and onto the body.
 *
 * `.journal-canvas__content` is `position: relative; z-index: 1`, which makes it
 * a stacking context — so the sheet's `z-index: 71` only ever meant "71 within
 * the canvas", and the mobile New-entry disc (z-index 45, a sibling of the
 * canvas) painted straight over the top of it. No z-index inside the surface can
 * fix that; the layer has to leave the surface.
 *
 * Narrow only. The dropdown is positioned against the control it belongs to and
 * has to stay where it is.
 */
function Layer({ portal, children }: { portal: boolean; children: React.ReactNode }) {
  return portal ? createPortal(children, document.body) : <>{children}</>
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
      data-off={subject.count === 0 ? 'true' : undefined}
    >
      {/*
        A subject with nothing in the bracketed stretch DIMS rather than
        disappears — the same rule the marking pills already follow. A list that
        silently changes length teaches the reader that the vocabulary is
        variable; a dimmed pill says "nothing here in these months", which is
        true, and is the most useful thing a bracket has to tell you about a
        name you carry.
      */}
      <button
        type="button"
        className="pg-pill__hit"
        disabled={subject.count === 0}
        onClick={onToggle}
      >
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
