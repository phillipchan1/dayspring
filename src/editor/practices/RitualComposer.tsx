import { useCallback, useEffect, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { createPortal } from 'react-dom'
import { useVisualViewportFrame } from '@/hooks/useViewportHeight'
import { useMediaQuery, useTouchPrimary } from '@/hooks/useMediaQuery'
import { track } from '@/lib/analytics'
import { RITUAL_END_TOKEN } from '@/lib/practiceTokens'
import { parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import { PRACTICE_BY_NAME } from './practicesData'
import { placeholderFor, questionFor } from './usePracticeInsertion'
import {
  answerOffset,
  composeRitualMarkdown,
  readRitual,
  ritualBlockRange,
  ritualEntryShape,
  ritualRemovalRange,
  type RitualContents,
} from './ritualDocument'
import './RitualComposer.css'

interface Props {
  /** Which ritual block in the entry this composer owns. */
  blockIndex: number
  /** The editor's live document. */
  getDoc: () => string
  /** Write the rebuilt block back into the entry. */
  replaceRange: (
    from: number,
    to: number,
    text: string,
    opts?: { focus?: boolean },
  ) => void
  /** Leave the composer. What was written is already in the entry. */
  onClose: () => void
  /** Open the practice's "about" sheet. */
  onAbout: (name: string) => void
  /**
   * Something is layered over the composer (today: the About sheet).
   *
   * While it is, the composer stops answering keys — otherwise Escape closes
   * both, because both listen on `window` in the capture phase and
   * `stopPropagation` does not stop a *sibling* listener on the same target and
   * phase. It also takes its focus back when the cover lifts, so closing About
   * returns the caret to the movement rather than to the entry underneath.
   */
  blocked?: boolean
  /**
   * The real editor, for an answer — so `/`, the `+` and formatting work in a
   * ritual the way they do on any page.
   *
   * Supplied by the journal, which owns what those do (its capture panels,
   * scripture, images). Absent — tests, previews, the phone's filmstrip — an
   * answer is a plain text box.
   */
  renderAnswer?: (answer: AnswerSlot) => React.ReactNode
  /**
   * The ritual IS the entry — one entry, one ritual.
   *
   * Absent, the composer owns one block inside a larger entry (an older, mixed
   * page), exactly as before. Present, it owns the whole document: the block,
   * then an unprompted last page — After — whose words are saved below the
   * block as ordinary prose, so the stored format does not change.
   */
  entry?: RitualEntryMode
}

/** Anything an answer is written in that can take the caret. */
export interface Focusable {
  focus: (opts?: FocusOptions) => void
}

/** What the journal needs to render one answer's editor. */
export interface AnswerSlot {
  /** Stable per movement, so each movement has its own editor. */
  key: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Hand back something that takes the caret, or null on unmount. */
  register: (handle: Focusable | null) => void
  /**
   * Where this answer begins in the entry, read at the moment of asking.
   * Positions inside the answer's editor are the answer's own; anything stored
   * against the entry (a mark on a verse) needs them shifted by this.
   */
  offset: () => number | null
}

export interface RitualEntryMode {
  /** A ritual begun on a blank page: nothing is in the document yet. */
  seed?: { name: string; labels: readonly string[] }
  /** Where leaving goes, said plainly — "your journal", "the page". */
  backTo: string
  /** The same place in one word, for the phone's back button. */
  backShort: string
  /** Delete the whole page — for a ritual entry, the ritual and the page are one. */
  onDelete: () => void
  /** Open on this movement (a click on one answer in the reader). */
  startAt?: number
}

/** After is a page, not a movement: no question, just room. */
const AFTER_LABEL = 'After'
const AFTER_PLACEHOLDER = 'Anything else, in your own words…'

/** What the composer opens with: the ritual, and (for a ritual entry) its After. */
function readSeed(
  doc: string,
  blockIndex: number,
  entry: RitualEntryMode | undefined,
): { block: RitualContents; after: string } | null {
  if (!entry) {
    const block = readRitual(doc, blockIndex)
    return block ? { block, after: '' } : null
  }
  const shape = ritualEntryShape(doc)
  if (shape.kind === 'ritual') return { block: shape.contents, after: shape.after }
  if (entry.seed) {
    return {
      block: {
        name: entry.seed.name,
        labels: [...entry.seed.labels],
        texts: entry.seed.labels.map(() => ''),
      },
      after: '',
    }
  }
  return null
}

/**
 * The ritual composer — one movement at a time, on a surface that owns the screen.
 *
 * A ritual used to be written in place, as a block inside the entry, and on a
 * phone that could not be made to work: the block sat wherever it sat in the
 * document, the keyboard took half the screen, and the line the writer was meant
 * to write on could end up behind it. A block inside a document cannot own a
 * screen; this can.
 *
 * It is a surface, not a store. The entry keeps the markdown (see
 * `ritualDocument.ts`), so nothing downstream changes, and the in-entry
 * rendering stays exactly what it is now — the record you read back.
 *
 * The movements sit on one horizontal track, because they are a sequence in
 * time and sideways is how we draw time; vertical is how a document scrolls, and
 * a ritual being read as a region of a scrolling document is the whole mistake
 * this surface exists to undo.
 *
 * The track is Embla's, not ours. Three hand-written versions of this gesture
 * each failed on a real phone in a different way — a `preventDefault` that was a
 * no-op because React registers `touchmove` passively, and then a drag left
 * stranded halfway when WebKit swallowed the rest of the gesture and no
 * `touchend` ever arrived. Embla owns the drag, the momentum and the snapping,
 * and — the property that matters most here — it always settles on a snap point,
 * so there is no half-state for a lost gesture to leave behind.
 *
 * One caveat is worth writing down rather than discovering again: the slides
 * contain a focused `<textarea>`, and iOS gives horizontal drags on editable
 * text to its own caret and selection recogniser. No library governs that. If a
 * swipe that starts on the writing area is sometimes ignored, this is why — but
 * "ignored" is a recoverable state and "stranded" was not.
 *
 * ── At a desk ──────────────────────────────────────────────────────────────
 *
 * Everything above is an argument about a phone keyboard, and a desk has none.
 * There the filmstrip became a nine-line box floating in an empty screen, with
 * what you wrote a minute ago a swipe away — a form wizard. So on a wide screen
 * with a fine pointer the same composer lays itself out as a rail and a page
 * (`DeskLayout` below): the page holds the one question in front of you and
 * as much room to answer it as the screen has; the rail holds the path — what
 * you said to each movement behind you, where you are, and the NAMES of the
 * movements ahead. Never their questions: that is the pacing `ritualPacing.ts`
 * exists for, and a name does not let you budget an answer. A movement ahead
 * opens once you have walked to it, or once it has words in it.
 *
 * Same state, same writes, same ways out; only the arrangement differs.
 */
export function RitualComposer({
  blockIndex,
  getDoc,
  replaceRange,
  onClose,
  onAbout,
  blocked = false,
  entry,
  renderAnswer,
}: Props) {
  const seed = useRef(readSeed(getDoc(), blockIndex, entry))
  const block = seed.current?.block ?? null
  const [after, setAfter] = useState(seed.current?.after ?? '')
  const afterRef = useRef(after)
  afterRef.current = after
  const entryRef = useRef(entry)
  entryRef.current = entry
  /**
   * Open on the movement still waiting. A finished ritual, reopened from the
   * entry, opens at its beginning — landing on the close would greet someone
   * who came back to write with "you're done".
   */
  const startAt = (() => {
    if (!block) return 0
    const asked = entry?.startAt
    // `labels.length` is After — a click on the After in the reader.
    if (asked !== undefined && asked >= 0 && asked <= block.labels.length) return asked
    const firstEmpty = block.texts.findIndex((t) => t.trim() === '')
    return firstEmpty === -1 ? 0 : firstEmpty
  })()
  const [texts, setTexts] = useState<string[]>(block ? block.texts : [])
  const [i, setI] = useState(startAt)
  const iRef = useRef(i)
  iRef.current = i
  const [emblaRef, embla] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    // Slower than Embla's default: this is a passage between movements, not a
    // photo gallery.
    duration: 26,
    startIndex: startAt,
  })
  const paneRefs = useRef<(Focusable | null)[]>([])
  const touch = useTouchPrimary()
  // The rail wants room beside a reading column; below this the filmstrip is
  // the better use of the width even with a mouse.
  const wide = useMediaQuery('(min-width: 900px)')
  const desk = wide && !touch
  /**
   * The furthest movement the writer has walked to — what the rail may name
   * as reachable. Opening on the movement still waiting counts as having
   * walked there, so a ritual resumed tomorrow does not re-lock what is behind.
   */
  const [reached, setReached] = useState(startAt)
  useEffect(() => {
    setReached((r) => Math.max(r, i))
  }, [i])
  // Not `inset: 0` plus a height: a fixed overlay is anchored to the layout
  // viewport, so once iOS scrolls the page to keep the focused field above the
  // keyboard, the composer rides up under the Dynamic Island and leaves a gap of
  // exactly the same size above the keyboard. Driving both edges from the
  // visual viewport keeps it where the writer can see it.
  const frame = useVisualViewportFrame()

  const practice = block ? PRACTICE_BY_NAME.get(block.name) : undefined
  const labels = block?.labels ?? []
  const total = labels.length
  /** The After page, for a ritual entry — one past the last movement. */
  const AFTER = entry ? total : -1
  /** The pane past everything that can be written: the close. */
  const CLOSE = entry ? total + 1 : total

  // ── Writing back ─────────────────────────────────────────────────────────
  // Debounced while typing, immediate on any move and on the way out, so the
  // entry is never more than a moment behind and never stale when you leave.
  const textsRef = useRef(texts)
  textsRef.current = texts
  // The callbacks come from the parent as fresh closures on every one of its
  // renders, and JournalScreen re-renders on autosave status, the status
  // cluster's tick and its own onChange. Depending on them directly made
  // `commit` a new function each time, which restarted the debounce below —
  // fast enough re-renders would starve the write entirely — and turned the
  // unmount effect into an every-render effect. Held in refs, `commit` is
  // stable for as long as the composer is open, and both effects mean what they
  // say. A component should not need its caller to memoise.
  const getDocRef = useRef(getDoc)
  getDocRef.current = getDoc
  const replaceRangeRef = useRef(replaceRange)
  replaceRangeRef.current = replaceRange
  // Once the writer has asked this ritual out of the entry, later commits —
  // the debounce, the unmount flush — must not write it back. `blockIndex`
  // would then point at whatever ritual slid into this slot, or at nothing.
  const goneRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  /** Replace the whole document — a ritual entry's composer owns all of it. */
  const writeWhole = useCallback((next: string) => {
    const doc = getDocRef.current()
    if (doc === next) return
    replaceRangeRef.current(0, doc.length, next, { focus: false })
  }, [])

  /**
   * A ritual entry's whole document.
   *
   * Nothing at all until something is written: a begun ritual with no words is
   * scaffolding, and the autosave session only refuses to create a row for a
   * BLANK document — markers alone would mint a page of nothing.
   */
  const composeEntry = useCallback(
    (prune: boolean) => {
      if (!block) return ''
      const t = textsRef.current
      const a = afterRef.current.replace(/^\n+/, '').replace(/\s+$/, '')
      if (t.every((x) => x.trim() === '') && !a) return ''
      let names = block.labels
      let answers = t
      if (prune) {
        const kept = block.labels
          .map((label, n) => ({ label, text: t[n] ?? '' }))
          .filter((m) => m.text.trim() !== '')
        names = kept.map((m) => m.label)
        answers = kept.map((m) => m.text)
      }
      // Closed by the end token, so the last movement keeps every paragraph
      // written into it rather than losing the second one to After.
      const out = `${composeRitualMarkdown(block.name, names, answers)}\n${RITUAL_END_TOKEN}`
      return a ? `${out}\n\n${a}` : out
    },
    [block],
  )

  const commit = useCallback(() => {
    if (!block || goneRef.current) return
    if (entryRef.current) {
      writeWhole(composeEntry(false))
      return
    }
    const doc = getDocRef.current()
    const range = ritualBlockRange(doc, blockIndex)
    if (!range) return
    const next = composeRitualMarkdown(block.name, block.labels, textsRef.current)
    if (doc.slice(range.from, range.to) === next) return
    // The editor's replaceRange focuses CodeMirror by default. Doing that
    // here is the bug: the debounce fires, the entry underneath takes the
    // caret, and the movement the writer is looking at goes dead.
    replaceRangeRef.current(range.from, range.to, next, { focus: false })
  }, [block, blockIndex, composeEntry, writeWhole])

  /**
   * How much of the ritual got written, reported once per composer.
   *
   * There are TWO ways out — `leave` (✕ / "done") and `removeBlock` ("remove
   * this ritual from the entry") — and `leave` delegates to `removeBlock` when
   * nothing was written, so a naive call in each would double-count exactly the
   * abandonment case this exists to measure. Hence the latch.
   *
   * Deliberately removing a ritual is the strongest abandonment signal there
   * is, so it must report rather than being treated as "never happened".
   */
  const reportedRef = useRef(false)
  const reportFinished = useCallback(() => {
    if (reportedRef.current) return
    reportedRef.current = true
    // Counts only — the analytics vocabulary has no free-text field by design.
    track('ritual_finished', {
      movements: textsRef.current.length,
      answered: textsRef.current.filter((t) => t.trim() !== '').length,
    })
  }, [])

  const removeBlock = useCallback(() => {
    if (!block || goneRef.current) return
    reportFinished()
    goneRef.current = true
    if (entryRef.current) {
      // The ritual and the page are one: delete the page.
      const { onDelete } = entryRef.current
      onCloseRef.current()
      onDelete()
      return
    }
    const doc = getDocRef.current()
    const range = ritualRemovalRange(doc, blockIndex)
    if (range) replaceRangeRef.current(range.from, range.to, '')
    onCloseRef.current()
  }, [block, blockIndex, reportFinished])

  /**
   * Write the block back with the untouched movements DROPPED.
   *
   * Only for a dynamic ritual, and only on the way out.
   *
   * The Round's movements are the writer's own domains, and skipping one is a
   * legitimate answer — `shape` says so: "a domain you have nothing to say about
   * this week is a real answer; leave it and move on." But `isRitualComplete`
   * requires every movement filled, and an incomplete block renders a
   * **continue** button on the entry, forever. On a four-movement Examen that is
   * a helpful door back in. On a nine-domain Round deliberately walked past five
   * of, it is a permanent "you didn't finish" sitting in someone's own journal —
   * a chore counter, which Principle 2 forbids outright.
   *
   * So a domain with nothing said about it this week simply is not in this
   * week's record, which is also the honest thing for the archive to hold.
   *
   * On the way out only: during the ritual the empty movements must stay, or
   * moving between them would delete the ones ahead.
   */
  const commitPruned = useCallback(() => {
    if (!block || goneRef.current) return false
    if (entryRef.current) {
      writeWhole(composeEntry(true))
      return true
    }
    const doc = getDocRef.current()
    const range = ritualBlockRange(doc, blockIndex)
    if (!range) return false
    const kept = block.labels
      .map((label, n) => ({ label, text: textsRef.current[n] ?? '' }))
      .filter((m) => m.text.trim() !== '')
    const next = composeRitualMarkdown(
      block.name,
      kept.map((m) => m.label),
      kept.map((m) => m.text),
    )
    if (doc.slice(range.from, range.to) !== next) {
      replaceRangeRef.current(range.from, range.to, next, { focus: false })
    }
    return true
  }, [block, blockIndex, composeEntry, writeWhole])

  const leave = useCallback(() => {
    // Before anything else, and latched — the empty branch below exits through
    // `removeBlock`, which reports too. Without this the library's only event
    // is `ritual_begun` and "finished or abandoned?" stays unanswerable.
    reportFinished()
    // An untouched ritual is scaffolding, not a record. Leaving it behind
    // is how "I changed my mind" used to get stuck — ✕ closed the surface
    // and the empty block sat in the entry with no way out but continue.
    const empty =
      textsRef.current.every((t) => t.trim() === '') && afterRef.current.trim() === ''
    if (empty) {
      if (entryRef.current) {
        // Nothing written, so nothing is kept — not a page of markers, and
        // not a deletion either: there was never a page to delete.
        writeWhole('')
        goneRef.current = true
        onCloseRef.current()
        return
      }
      removeBlock()
      return
    }
    // `goneRef` so the unmount flush below cannot put the dropped movements
    // back — `commit` rebuilds from the full label list.
    if (practice?.dynamic && commitPruned()) {
      goneRef.current = true
      onCloseRef.current()
      return
    }
    commit()
    onCloseRef.current()
  }, [commit, commitPruned, practice, removeBlock, reportFinished, writeWhole])

  useEffect(() => {
    const id = setTimeout(commit, 400)
    return () => clearTimeout(id)
  }, [texts, after, commit])
  // Leaving — by the ✕, by Escape, or because the entry closed under us.
  useEffect(() => () => commit(), [commit])

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(CLOSE, next))
      commit()
      setI(clamped)
      // On the filmstrip the caret waits for the slide to land — see `onSettle`.
      if (!desk && embla && embla.selectedScrollSnap() !== clamped) {
        embla.scrollTo(clamped)
        return
      }
      embla?.scrollTo(clamped)
      requestAnimationFrame(() => paneRefs.current[clamped]?.focus({ preventScroll: true }))
    },
    [CLOSE, commit, desk, embla],
  )

  useEffect(() => {
    if (!embla) return
    // `preventScroll`, here specifically: measured in the iOS Simulator
    // (`ritualPreview.tsx`'s `?debug=1` readout, console-logged — see there) that
    // a swipe with the keyboard already open — this handler firing mid-drag
    // settle — was making `window.innerHeight` drop out from under an unchanged
    // `visualViewport.height` for several seconds, which `useVisualViewportFrame`
    // reads straight into the composer's `top`/`height` and is symptom 2 (the
    // whole surface riding up under the Dynamic Island). iOS was re-running
    // scroll-into-view for the newly-focused textarea even though Embla had
    // already placed it on screen. Without `preventScroll` this reproduced on
    // 2/2 tries; with it, 0/3. Not yet confirmed on a physical device.
    const onSelect = () => {
      commit()
      setI(embla.selectedScrollSnap())
    }
    // Focus waits for the track to stop. Focusing on `select` — or a frame
    // after `scrollTo` — hands iOS a textarea that is still sliding in under a
    // transformed track, and WebKit draws the caret where the field was at that
    // instant and leaves it there: the next movement opened with its caret
    // stranded two-thirds of the way across, beside the placeholder rather
    // than at its start. Until the slide lands the previous movement keeps
    // focus (the footer buttons refuse to take it), so the keyboard never drops.
    const onSettle = () => {
      const el = paneRefs.current[embla.selectedScrollSnap()]
      if (el) {
        if ((document.activeElement as unknown) !== el) el.focus({ preventScroll: true })
        return
      }
      // The close has nothing to write in; let the keyboard go.
      const active = document.activeElement
      if (active instanceof HTMLElement && active.closest('.ritual-composer')) active.blur()
    }
    // The layout can change under an open composer (a window narrowed past
    // the desk width), and Embla then starts from its `startIndex`, not from
    // the movement the writer is in.
    if (embla.selectedScrollSnap() !== iRef.current) embla.scrollTo(iRef.current, true)
    embla.on('select', onSelect)
    embla.on('settle', onSettle)
    return () => {
      embla.off('select', onSelect)
      embla.off('settle', onSettle)
    }
  }, [embla, commit])

  // Land in the movement being written, with the caret already in it — and land
  // there again when a sheet that was covering us closes. Keyed on `blocked`
  // rather than mount, so closing About returns here; later moves take focus
  // through `go`.
  useEffect(() => {
    if (blocked) return
    const id = requestAnimationFrame(() =>
      paneRefs.current[iRef.current]?.focus({ preventScroll: true }),
    )
    return () => cancelAnimationFrame(id)
  }, [blocked])

  // ── Keys ─────────────────────────────────────────────────────────────────
  // ⌥↵ is "continue". Not ⌘↵ — that is focus mode everywhere else in the app,
  // and one key meaning two things gave mixed signals. Not the ⌘⇧←/→ chord
  // this used to answer to either: on a Mac those select to the line's
  // start and end, and a writer's own text selection must not be taken.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The sheet over us owns the keyboard while it is open.
      if (blocked) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        leave()
        return
      }
      // Plain Enter is a new paragraph; ⌥↵ is "I'm done with this one". Stopped
      // here, in the capture phase, so the answer's editor never sees it.
      if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        if (i < CLOSE) go(i + 1)
        else leave()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [CLOSE, blocked, go, i, leave])


  if (!block) return null

  // What the writer walks through: the movements, then — for a ritual entry —
  // After. Everything below renders panes, so After needs no layout of its own.
  const paneLabels = entry ? [...labels, AFTER_LABEL] : labels
  const paneTexts = entry ? [...texts, after] : texts
  const paneQuestion = (n: number) => (n === AFTER ? '' : questionFor(practice, labels[n] ?? ''))
  const panePlaceholder = (n: number) =>
    n === AFTER ? AFTER_PLACEHOLDER : placeholderFor(practice, labels[n] ?? '')
  const nothingWritten = paneTexts.every((t) => t.trim() === '')

  const written = i < CLOSE && (paneTexts[i] ?? '').trim().length > 0
  // Only a keyboard makes room worth fighting for; on desktop nothing recedes.
  const yielding = written && touch

  const write = (n: number, value: string) => {
    if (n === AFTER) {
      setAfter(value)
      return
    }
    setTexts((prev) => {
      const next = prev.slice()
      next[n] = value
      return next
    })
  }

  if (desk) {
    return createPortal(
      <DeskLayout
        name={block.name}
        origin={practice?.origin}
        intention={practice?.intention}
        labels={paneLabels}
        texts={paneTexts}
        afterIndex={AFTER}
        i={i}
        reached={reached}
        question={paneQuestion}
        placeholder={panePlaceholder}
        textareaRef={(el) => {
          if (i < CLOSE) paneRefs.current[i] = el
        }}
        renderAnswer={renderAnswer}
        answerOffset={(n) => answerOffset(getDocRef.current(), blockIndex, n)}
        onWrite={write}
        go={go}
        leave={leave}
        remove={removeBlock}
        entryMode={Boolean(entry)}
        about={() => onAbout(block.name)}
        backTo={entry?.backTo ?? 'your entry'}
        saved={
          entry
            ? nothingWritten
              ? 'Nothing is kept until you write.'
              : 'Saved as you write.'
            : 'Saved to your entry as you write.'
        }
        landed={entry ? 'It’s on your journal page, as you wrote it.' : 'It’s in your entry, as you wrote it.'}
      />,
      document.body,
    )
  }

  return createPortal(
    <div
      className="ritual-composer"
      role="dialog"
      aria-modal="true"
      aria-label={`${block.name} — movement ${Math.min(i + 1, total)} of ${total}`}
      style={
        frame
          ? { top: frame.top, height: frame.height }
          : undefined
      }
    >
      <header className="rc__bar">
        {entry ? (
          // Say where it goes, the way the desk's back link does.
          <button
            type="button"
            className="rc__x rc__x--back"
            onClick={leave}
            aria-label={`Back to ${entry.backTo}`}
          >
            ‹ {entry.backShort}
          </button>
        ) : (
          <button
            type="button"
            className="rc__x"
            onClick={leave}
            aria-label={
              texts.every((t) => t.trim() === '')
                ? 'Remove the ritual'
                : 'Leave the ritual'
            }
          >
            ✕
          </button>
        )}
        <span className="rc__name">{block.name}</span>
        <div className="rc__tools">
          {entry ? (
            <MoreMenu about={() => onAbout(block.name)} remove={removeBlock} />
          ) : (
            <button
              type="button"
              className="rc__remove"
              onClick={removeBlock}
              aria-label="Remove this ritual from the entry"
            >
              remove
            </button>
          )}
          {entry ? null : (
            <button
              type="button"
              className="rc__about"
              onClick={() => onAbout(block.name)}
              aria-label={`About ${block.name}`}
            >
              about
            </button>
          )}
        </div>
      </header>

      <div className="rc__spine" data-yield={yielding ? 'true' : undefined} aria-hidden>
        {paneLabels.map((label, n) => (
          <span
            key={n === AFTER ? '__after' : label}
            className="rc__pip"
            data-after={n === AFTER ? 'true' : undefined}
            data-on={n === i ? 'true' : undefined}
            data-done={(paneTexts[n] ?? '').trim() && n !== i ? 'true' : undefined}
          />
        ))}
      </div>

      <div className="rc__viewport" ref={emblaRef}>
        <div className="rc__track">
        {paneLabels.map((label, n) => {
          return (
            <section className="rc__pane" key={n === AFTER ? '__after' : label} aria-hidden={n !== i}>
              <div className="rc__inner">
                <span className="rc__label">{label}</span>
                {n === AFTER ? null : (
                  <p className="rc__q" data-small={n === i && yielding ? 'true' : undefined}>
                    {paneQuestion(n)}
                  </p>
                )}
                <textarea
                  className="rc__write"
                  ref={(el) => {
                    paneRefs.current[n] = el
                  }}
                  value={paneTexts[n] ?? ''}
                  placeholder={panePlaceholder(n)}
                  tabIndex={n === i ? 0 : -1}
                  onChange={(e) => write(n, e.target.value)}
                />
              </div>
            </section>
          )
        })}

          <section className="rc__pane" aria-hidden={i !== CLOSE}>
            <div className="rc__close">
              <h2 className="rc__close-name">{block.name}</h2>
              <p className="rc__close-origin">{practice?.origin ?? ''}</p>
              <button type="button" className="rc__next" onClick={leave}>
                Back to {entry?.backTo ?? 'your entry'}
              </button>
            </div>
          </section>
        </div>
      </div>

      <footer className="rc__foot">
        {/* `preventDefault` on mousedown keeps focus in the movement being
            left, so the keyboard stays up while the next one slides in. */}
        <button
          type="button"
          className="rc__back"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => go(i - 1)}
          disabled={i === 0}
        >
          {i > 0 && i < CLOSE + 1 ? `‹ ${paneLabels[i - 1] ?? ''}` : ''}
        </button>
        {i < CLOSE && (
          <button
            type="button"
            className="rc__next"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(i + 1)}
          >
            {i < CLOSE - 1 ? `Next: ${paneLabels[i + 1]}` : 'Close the ritual'}
          </button>
        )}
      </footer>
    </div>,
    document.body,
  )
}

/** ⌥ on Apple hardware, Alt everywhere else — the hint must match the key. */
const ALT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌥' : 'Alt'

/**
 * A walked movement's words, as the rail says them back.
 *
 * An answer can hold a marking, and a marking is a fence — so a movement that
 * opened with a verse or a prayer showed its markup and id in the rail. Each
 * fence says what it holds instead: a verse its reference, anything else the
 * writer's own words.
 */
export function gistOf(text: string): string {
  const blocks = parseSpiritualBlocks(text)
  let out = text
  for (let n = blocks.length - 1; n >= 0; n--) {
    const b = blocks[n]!
    const said = (b.type === 'scripture' && b.reference) || b.content
    out = out.slice(0, b.from) + said + out.slice(b.to)
  }
  return out.replace(/\s+/g, ' ').trim()
}

interface DeskProps {
  name: string
  origin: string | undefined
  intention: string | undefined
  /** Every page walked, in order — the movements, then After for a ritual entry. */
  labels: string[]
  texts: string[]
  /** Which of `labels` is After, or -1. */
  afterIndex: number
  i: number
  reached: number
  question: (n: number) => string
  placeholder: (n: number) => string
  textareaRef: (el: Focusable | null) => void
  renderAnswer: ((answer: AnswerSlot) => React.ReactNode) | undefined
  answerOffset: (n: number) => number | null
  onWrite: (n: number, value: string) => void
  go: (n: number) => void
  leave: () => void
  remove: () => void
  /** A ritual entry (its own page) rather than a ritual inside an older entry. */
  entryMode: boolean
  about: () => void
  /** Where leaving goes: "your journal", "your entry", "the page". */
  backTo: string
  /** The rail's foot line — saved, or not yet. */
  saved: string
  /** What the close says about where the writing now is. */
  landed: string
}

/**
 * The phone's tools for a ritual entry, behind one ⋯ so the practice's name
 * keeps the masthead to itself.
 */
function MoreMenu({ about, remove }: { about: () => void; remove: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rc__more">
      <button
        type="button"
        className="rc__about rc__more-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More"
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <div className="rc__more-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); about() }}>
            About this ritual
          </button>
          <ConfirmButton label="Delete page" ask="Delete this page?" onConfirm={remove} />
        </div>
      )}
    </div>
  )
}

/**
 * A tool that asks once before it does something that cannot be walked back
 * from here: the first press turns it into its own question, the second
 * answers it, and moving away lets the question go.
 */
function ConfirmButton({
  className,
  label,
  ask,
  onConfirm,
}: {
  className?: string
  label: string
  ask: string
  onConfirm: () => void
}) {
  const [asking, setAsking] = useState(false)
  return (
    <button
      type="button"
      className={className}
      data-asking={asking ? 'true' : undefined}
      onClick={() => (asking ? onConfirm() : setAsking(true))}
      onBlur={() => setAsking(false)}
      onMouseLeave={() => setAsking(false)}
    >
      {asking ? ask : label}
    </button>
  )
}

/**
 * The composer at a desk: the path in a rail, one question on a page.
 *
 * Stateless on purpose — every decision (what is written, where the writer is,
 * how leaving works) stays in `RitualComposer`, so the two layouts cannot
 * disagree about the ritual, only about how it is arranged.
 */
function DeskLayout({
  name,
  origin,
  intention,
  labels,
  texts,
  i,
  reached,
  question,
  placeholder,
  textareaRef,
  renderAnswer,
  answerOffset,
  onWrite,
  go,
  leave,
  remove,
  entryMode,
  about,
  afterIndex,
  backTo,
  saved,
  landed,
}: DeskProps) {
  const total = labels.length
  const filled = (n: number) => (texts[n] ?? '').trim() !== ''
  const reachable = (n: number) => n <= reached || filled(n)
  const label = labels[i] ?? ''

  return (
    <div
      className="ritual-composer rc--desk"
      role="dialog"
      aria-modal="true"
      aria-label={`${name} — movement ${Math.min(i + 1, total)} of ${total}`}
    >
      {/* The composer covers the whole window in the Mac app, so the rail's
          empty space is what moves it (Tauri drags only on the element that
          carries the attribute, not its children). */}
      <aside className="rc__rail" data-tauri-drag-region>
        {/* Not "close" and not "step out": say where it goes, and (below) that
            nothing is lost by going. */}
        <button type="button" className="rc__home" onClick={leave}>
          <span aria-hidden>←</span> Back to {backTo}
          <kbd className="rc__kbd">esc</kbd>
        </button>
        <h2 className="rc__title">{name}</h2>
        {origin && <p className="rc__origin">{origin}</p>}
        {/* What the practice is for sits with its name, as a dek — not stranded
            at the foot of the rail with a screen of nothing above it. */}
        {intention && <p className="rc__intent">{intention}</p>}

        <ol className="rc__path">
          {labels.map((l, n) => {
            const state =
              n === i ? 'on' : !reachable(n) ? 'ahead' : filled(n) ? 'done' : 'open'
            return (
              <li
                key={n === afterIndex ? '__after' : l}
                data-state={state}
                // After is not a movement: no small caps, a hollow bead.
                data-after={n === afterIndex ? 'true' : undefined}
              >
                <button
                  type="button"
                  onClick={() => go(n)}
                  disabled={state === 'ahead'}
                  aria-current={n === i ? 'step' : undefined}
                >
                  <span className="rc__path-label">{l}</span>
                  {n !== i && filled(n) && <span className="rc__gist">{gistOf(texts[n] ?? '')}</span>}
                </button>
              </li>
            )
          })}
        </ol>

        <footer className="rc__rail-foot">
        <div className="rc__rail-tools">
          <button type="button" onClick={about}>
            About this ritual
          </button>
          {entryMode ? (
            <ConfirmButton label="Delete page" ask="Delete this page?" onConfirm={remove} />
          ) : (
            <button type="button" onClick={remove} aria-label="Remove this ritual from the entry">
              Remove from entry
            </button>
          )}
        </div>
        <p className="rc__saved">{saved}</p>
        </footer>
      </aside>

      <main className="rc__desk">
        {i < total ? (
          <>
            {/* Keyed so each movement arrives rather than being swapped in. */}
            <section
              className="rc__page"
              key={i === afterIndex ? '__after' : label}
              data-after={i === afterIndex ? 'true' : undefined}
            >
              <span className="rc__label">{label}</span>
              {i === afterIndex ? null : <p className="rc__q">{question(i)}</p>}
              {renderAnswer ? (
                <div className="rc__write rc__write--editor">
                  {renderAnswer({
                    key: i === afterIndex ? '__after' : label,
                    value: texts[i] ?? '',
                    onChange: (value) => onWrite(i, value),
                    placeholder: placeholder(i),
                    register: textareaRef,
                    offset: () => answerOffset(i),
                  })}
                </div>
              ) : (
                <textarea
                  className="rc__write"
                  ref={textareaRef}
                  value={texts[i] ?? ''}
                  placeholder={placeholder(i)}
                  onChange={(e) => onWrite(i, e.target.value)}
                />
              )}
            </section>
            <footer className="rc__foot">
              <button
                type="button"
                className="rc__back"
                onClick={() => go(i - 1)}
                disabled={i === 0}
              >
                {i > 0 ? `← ${labels[i - 1]}` : ''}
              </button>
              <span className="rc__foot-go">
                <kbd className="rc__kbd">{ALT} ↵</kbd>
                <button type="button" className="rc__next" onClick={() => go(i + 1)}>
                  {i < total - 1 ? 'Continue' : 'Finish'}
                </button>
              </span>
            </footer>
          </>
        ) : (
          <div className="rc__close">
            <h2 className="rc__close-name">{name}</h2>
            {origin && <p className="rc__close-origin">{origin}</p>}
            <p className="rc__close-origin">{landed}</p>
            <button type="button" className="rc__next" onClick={leave}>
              Back to {backTo}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
