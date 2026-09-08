import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import type { MarkingChip } from './facets'
import type { KeptSubject } from './keptSubjects'
import { searchSubjects, withCounts, wordSubject, type Subject, type SubjectIndex } from './subjects'
import { aboveFloor, aliveIn, groupSubjects, type Window } from './lookGroups'
import { READINGS, type Reading } from './readings'
import { MarkGlyph } from '@/components/MarkGlyph'
import { Glyph } from '@/features/lifemap/Glyph'
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
 * ── The four lists are the Life Map's, on purpose ───────────────────────────
 *
 * `PagesView` calls `allSubjects()` and `listKeptSubjects()`; the Life Map calls
 * `buildLifeMap()` over those same two tables. It has always been ONE
 * vocabulary — but this sheet rendered it as one flat run of pills, so nothing
 * on screen said so, and a reader who had just named twelve people over there
 * met them again here as an undifferentiated heap. Grouping by `SECTIONS` (via
 * `lookGroups`) is the whole fix: same names, same kinds, same order.
 *
 * AMBER MEANS DAYSPRING FOUND IT, carried across from `LifeMap.css` unchanged —
 * wash, underline, and the kind glyph on the group's own head. Never a wand or a
 * sparkle: BRANDSCRIPT rules out saying *AI-powered*, "it frightens this
 * audience", and a second mark would compete with the one that says what a
 * subject IS.
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
  /**
   * How often something has to recur before it is offered — `floorFor`, one page
   * in a hundred, the Life Map's own constant.
   *
   * OVER THE BRACKET WHEN THERE IS ONE. Same rule, different denominator: one
   * page in a hundred of the months you are holding. That is what keeps a
   * bracketed sheet honest — the counts have always been the bracket's, and
   * until `window` existed the NAMES were still the whole archive's.
   *
   * STATED ON SCREEN, and overruled by typing. A floor is filtering and can be
   * argued with; a top-N would be the app's opinion of who matters (D-016).
   */
  floor: number
  /**
   * The bracketed months, or null for the whole archive.
   *
   * Only ever used to ask whether a subject was ALIVE then — see `aliveIn`. It
   * is not a second filter on the pages; the wall and `index` already answer for
   * those.
   */
  window: Window | null
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
  /**
   * The way back to the Life Map, where this vocabulary is tended.
   *
   * The relationship already ran one way — a name over there opens Pages lit to
   * it — and one-way doors are how two halves of one thing come to look like
   * two things. Optional because the previews and the listing shots mount this
   * surface with no app around it to navigate.
   */
  onTend?: (() => void) | undefined
}

/**
 * How far a search reaches past the floor.
 *
 * Not a cap on what is OFFERED — that is the floor's job, and the floor is a
 * rule about the journal rather than a number about the writer. This is a cap on
 * what a two-letter prefix can drag onto the screen, spread across four lists,
 * and it is the same kind of bound the field already had.
 */
const FOUND_WHEN_SEARCHING = 24

/** A stable empty list, so a shut sheet's memos never hand back a new array. */
const NONE: Subject[] = []

export function LookFor({
  kept,
  offered,
  index,
  floor,
  window,
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
  onTend,
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

  /*
   * Counted at the last moment, and ONLY WHILE THE SHEET IS OPEN.
   *
   * Every count on a pill is a literal re-read of the corpus — one regex per
   * subject across every page in the bracket — because the Concordance's stored
   * number disagrees with a re-count on 123 of the 124 subjects above five pages
   * (see `withCounts`). Measured at ~1.5µs a page, that is 75ms for fifty
   * subjects on three thousand pages: fine once, when the sheet opens, and
   * absurd on every render of a surface whose sheet is shut by default. It used
   * to run unconditionally, which was survivable only because the list was
   * capped at six.
   */
  const heldRows = useMemo(() => {
    if (!open) return NONE
    const matched = q
      ? kept.filter((s) => s.label.toLowerCase().includes(q.toLowerCase()))
      : kept
    // Counted, never filtered: what she keeps is hers, and a kept name that has
    // nothing in the bracketed stretch is dimmed rather than taken away. Exempt
    // from the floor for the same reason — a name she answered must never
    // disappear for going quiet, which would be arithmetic overruling her.
    return withCounts(index, matched)
  }, [open, kept, index, q])

  const noticedRows = useMemo(() => {
    if (!open) return NONE
    /*
     * THE FLOOR, and the one way past it.
     *
     * At rest this was the first six of the vocabulary, which is a cap: honest
     * arithmetic, but it left the other nine hundred names unreachable except by
     * guessing. Now everything that recurs across one page in a hundred is here
     * — the Life Map's own rule, its own constant — and typing lifts the floor
     * entirely, because the find field has always searched the whole vocabulary.
     * That is what makes a floor legitimate where a ranking would not be: the
     * reader can see the rule and overrule it.
     */
    if (searching) {
      const found = searchSubjects(offered, q, FOUND_WHEN_SEARCHING)
      // A pill that lights nothing is not an option anyone can use — the same
      // rule the marking pills follow by dimming.
      return withCounts(index, found).filter((s) => s.count)
    }

    /*
     * ── Bracketed: the names follow the months, not just the numbers ─────────
     *
     * Bracketing has always re-counted every pill against the stretch — `index`
     * is the bracketed index — but it went on offering the WHOLE ARCHIVE'S
     * names, so a winter came back with the winter's numbers written beside
     * eleven years of subjects. The sheet half-followed the bracket, which is
     * worse than either following it or not.
     *
     * Three stages, cheapest first, and only the last one removes a name:
     *
     *   1. `aliveIn` — two date comparisons per subject, no text touched.
     *   2. `aboveFloor` on the Concordance's stored count. Not a proof: that
     *      column UNDER-reports against a literal re-count (see `withCounts`),
     *      so this can drop a subject that would have cleared the floor on the
     *      real number. It is a bound the archive's own record vouches for, it
     *      keeps the re-count from running over nine hundred subjects, and the
     *      find field reaches anything it loses.
     *   3. the literal count, which is the number the pill prints and the wall
     *      is lit by — so under a bracket the floor is measured in exactly the
     *      figure the reader can see. That is strictly more honest than the
     *      unbracketed path, and affordable only because the corpus is small.
     */
    if (window) {
      const alive = aboveFloor(aliveIn(offered, window), floor)
      return withCounts(index, alive).filter((s) => (s.count ?? 0) >= floor)
    }

    return withCounts(index, aboveFloor(offered, floor)).filter((s) => s.count)
  }, [open, offered, index, q, searching, floor, window])

  // Detection finds people and cannot find matters — it will never return
  // "marriage", because nobody capitalises it. So a matter becomes a subject
  // the moment she says so, typed from this same field.
  const mine = useMemo(() => {
    if (!open || q.length < 2) return null
    const w = wordSubject(q)
    if (!w) return null
    const known = [...kept, ...offered].some((s) => s.label.toLowerCase() === q.toLowerCase())
    if (known) return null
    const [counted] = withCounts(index, [w])
    return counted ?? null
  }, [open, q, kept, offered, index])

  /*
   * The four lists, and they are the Life Map's four lists — `groupSubjects`
   * borrows `SECTIONS` rather than restating them beside it.
   *
   * A typed word joins whatever she keeps: it is hers the moment she says so,
   * and `sectionOf` files it under Matters, which is where the Life Map files a
   * typed subject too. Nothing is sorted here — kept order and first-appearance
   * order both come through untouched.
   */
  const groups = useMemo(
    () => groupSubjects(mine ? [...heldRows, mine] : heldRows, noticedRows),
    [heldRows, noticedRows, mine],
  )

  const nothing = groups.length === 0

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
          // Named explicitly because the word is dropped on a phone, where this
          // is a disc — see the note on the narrow rule in Pages.css. Without it
          // the accessible name falls back to the count, and "3" is not a
          // control anyone can find in a rotor.
          aria-label={chips.length > 0 ? `Look for — ${chips.length} on` : 'Look for'}
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
          <span className="pg-look__word">Look for</span>
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

        {/*
          Flip the notebook open.
        
          Beside a cursor it sits in the header, a glyph the width of a
          fingernail that costs the row nothing. On a phone that row is about to
          be empty — the zoom has gone (see `zoom.ts`) — and what was left was
          ONE unlabelled book icon, alone, above the reader's own writing: the
          exact thing this file already refuses to do to `Write`, a lone glyph in
          a corner being a thing to decode. A whole band of the most valuable
          strip on the screen, spent on a mystery.
        
          So on a phone it moves into the sheet, as a row with words on it. It
          belongs there anyway: the sheet is every way INTO the archive that
          isn't scrolling, and letting the notebook fall open is one of them.
        */}
        {narrow ? null : (
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
        )}

        {/*
          How close you're standing — a pointer's control, and only a pointer's,
          and only over the wall.

          A phone renders rows at every setting, so this had nothing left to
          move; the full argument is in `zoom.ts`. It is not hidden with CSS
          because there is no state here to hide: the phone does not have a zoom.

          The readings hide it too, for the same reason rather than a different
          one: zoom arranges the WALL, and every other reading is a list of
          dated lines with no density to set. A slider that moves nothing is
          worse than no slider — it says this view has a setting it does not.
        */}
        {narrow || reading !== 'order' ? null : (
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
        )}
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
            <h3>
              subject
              <span>the four lists your Life Map keeps</span>
            </h3>

            {/*
              First run. A name appearing without explanation is the app
              claiming to know her, so the one line that says where these came
              from — and what the colour means — sits above them until she has
              kept something of her own.

              Conditioned on there BEING amber on screen. It used to fire on an
              empty vocabulary too, and "Amber is what Dayspring found in your
              pages" over a blank space is the surface describing a thing that
              is not there. A legend pinned to the sheet forever would be a
              disclaimer anyway, and if a surface needs a disclaimer the
              disclaimer isn't the fix.
            */}
            {kept.length === 0 && !searching && groups.some((g) => g.found.length > 0) ? (
              <p className="pg-sheet__note">
                Amber is what Dayspring found in your pages. Keep the ones you carry.
              </p>
            ) : null}

            {/*
              Four lists, side by side where there is room.

              The Life Map stacks them down a full-width page; a dropdown is
              wide and short, so the same four go two-up and the sheet stays
              something you can read without scrolling. Same names, same order,
              same glyphs — what changes is the shelf, not the shape.
            */}
            <div className="pg-sheet__kinds">
              {groups.map((g) => (
                <div className="pg-sheet__kind" key={g.id}>
                  <h4>
                    {/*
                      The Life Map's own glyph, imported rather than redrawn.
                      Grey here: on a chip the glyph's colour is the third
                      channel saying "found", and a heading is not a subject —
                      it would be claiming the whole list was found.
                    */}
                    <Glyph kind={g.id} found={false} className="pg-sheet__kglyph" />
                    {g.label}
                  </h4>
                  <div className="pg-sheet__opts">
                    {g.mine.map((s) => {
                      // The one pill that is neither kept nor offered: a word
                      // she has just typed that nothing in the vocabulary
                      // knows. Its aside KEEPS rather than drops.
                      const fresh = mine?.key === s.key
                      return (
                        <SubjectPill
                          key={s.key}
                          subject={s}
                          kept={!fresh}
                          mine={fresh}
                          found={false}
                          on={on.has(s.key)}
                          onToggle={() => (on.has(s.key) ? onRemove(s.key) : onToggleSubject(s))}
                          onAside={() => (fresh ? onKeep(s) : onDrop(s.key))}
                        />
                      )
                    })}

                    {g.found.map((s) => (
                      <SubjectPill
                        key={s.key}
                        subject={s}
                        kept={false}
                        found
                        on={on.has(s.key)}
                        onToggle={() => (on.has(s.key) ? onRemove(s.key) : onToggleSubject(s))}
                        onAside={() => onKeep(s)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/*
              Nothing — and the two nothings are different.
        
              Searching, it is a fact about the word. At rest it is a young
              journal, or a Concordance that has not run, or a read that failed
              silently (which this surface does on purpose — the wall works
              without any of this). Either way the honest answer names the rule
              that emptied the list and points at the one thing that still
              works, which is typing.
            */}
            {nothing ? (
              <p className="pg-sheet__note">
                {searching
                  ? 'Nothing in your pages says that.'
                  : `No subject comes up on ${floor} ${floor === 1 ? 'page' : 'pages'}` +
                    (window ? ' in these months. ' : ' yet. ') +
                    'Type any word and the pages that say it light up.'}
              </p>
            ) : null}

            {/*
              The hem: the rule on the left, the door on the right.

              THE FLOOR IS STATED because that is what separates it from a
              ranking. "Offered from thirty pages up" is a fact about the journal
              the reader can argue with — and the argument is typing, which
              reaches the whole vocabulary. "Your thirty most significant
              subjects" would be the app's opinion of who matters, and there
              would be nothing to say back to it (D-016).

              It re-bases itself on the bracket, and says so. One page in a
              hundred OF THESE MONTHS is the same rule over a different
              denominator, and a floor that quietly kept counting the whole
              archive while the pills counted a winter would be two arithmetics
              on one line.

              Hidden while searching, because while searching it is not true.
            */}
            <div className="pg-sheet__hem">
              {searching || nothing ? (
                <span />
              ) : (
                <span title="Anything you keep stays, however rarely it comes up">
                  offered from {floor} {floor === 1 ? 'page' : 'pages'} up
                  {window ? ' in these months' : null} — type for the rest
                </span>
              )}
              {onTend ? (
                <button
                  type="button"
                  className="pg-sheet__tend"
                  onClick={() => {
                    setOpen(false)
                    onTend()
                  }}
                >
                  Tend these in your Life Map
                  <svg viewBox="0 0 10 10" width="8" height="8" fill="none" aria-hidden>
                    <path
                      d="m3.4 1.6 3.4 3.4-3.4 3.4"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
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

          {/*
            And the way in that isn't looking for anything.
        
            Last, and set as a sentence rather than a pill, because it is not one
            more thing to combine with the others — it ends the sheet by
            abandoning the question it asks. Phone only: beside a cursor it is
            already a glyph in the header, and it does not need saying twice.
          */}
          {narrow ? (
            <button
              type="button"
              className="pg-sheet__somewhere"
              onClick={() => {
                setOpen(false)
                onSomewhere()
              }}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden>
                <path d="M12 7.4v11.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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
                <path
                  d="M12 7.4c1.5-2 3-3.1 4.6-3.4"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  opacity="0.55"
                />
              </svg>
              Let it fall open somewhere
            </button>
          ) : null}
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
  found,
  on,
  onToggle,
  onAside,
}: {
  subject: Subject
  kept: boolean
  mine?: boolean
  /**
   * Dayspring found this; the writer has not answered it. Amber, on the same
   * two channels `LifeMap.css` uses — a wash on the pill and an underline under
   * the word, which is the sign the editor already draws when it recognises
   * something. The third channel, the glyph, sits on the group's head.
   *
   * Never an added mark. A wand or a sparkle would say the word BRANDSCRIPT
   * rules out, and this sheet sits two inches from her own sentences.
   */
  found: boolean
  on: boolean
  onToggle: () => void
  onAside: () => void
}) {
  return (
    <span
      className={`pg-pill ${kept ? 'pg-pill--kept' : 'pg-pill--noticed'}${mine ? ' pg-pill--mine' : ''}`}
      data-on={on ? 'true' : undefined}
      data-off={subject.count === 0 ? 'true' : undefined}
      data-found={found ? 'true' : undefined}
      title={found ? 'Dayspring found this in your pages' : undefined}
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
