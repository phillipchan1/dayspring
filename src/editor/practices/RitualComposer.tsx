import { useCallback, useEffect, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { createPortal } from 'react-dom'
import { useVisualViewportFrame } from '@/hooks/useViewportHeight'
import { useMediaQuery, useTouchPrimary } from '@/hooks/useMediaQuery'
import { track } from '@/lib/analytics'
import { RITUAL_END_TOKEN } from '@/lib/practiceTokens'
import { parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import { PRACTICE_BY_NAME, movementKind, type MovementKind } from './practicesData'
import { placeholderFor, questionFor } from './usePracticeInsertion'
import {
  bodyOf,
  canWalkWithPassage,
  caughtOf,
  citedVerses,
  findQuote,
  formatQuote,
  placeQuote,
  quotesIn,
  quoteVerse,
  readPassage,
  versesIn,
  withCaught,
  writePassage,
  type PassageRef,
  type Verse,
} from './passage'
import type { Highlight, WordSpan } from './PassageText'
import { Tethers, type TetherKey } from './Tethers'
import { loadChapter } from './passageSource'
import { PassageFinder } from './PassageFinder'
import { CaughtLine, DwellView, DrawnCard, PassageBody, PassageStrip, QuoteChip, QuoteGhost } from './PassageViews'
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

/**
 * Anything an answer is written in that can take the caret. The real editor
 * can also say where its caret is and write there — how a verse is quoted into
 * an answer without disturbing what is already written.
 */
export interface Focusable {
  focus: (opts?: FocusOptions) => void
  getCursor?: () => number
  getDoc?: () => string
  insertAt?: (pos: number, text: string) => void
  focusAt?: (pos?: number) => void
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
    // Rest with nothing written is rest done — see `movementKind`.
    const firstEmpty = block.texts.findIndex(
      (t, n) => t.trim() === '' && movementKind(block.name, block.labels[n] ?? '') !== 'dwell',
    )
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

  // ── The passage ──────────────────────────────────────────────────────────
  /**
   * Walked with its passage: a scripture ritual whose first answer is empty or
   * already a passage. Decided once, on open — a Lectio begun before the finder
   * existed holds a passage typed out as prose, and keeps the plain composer it
   * was written in rather than being offered a finder that would replace it.
   */
  const passageMode = useRef(
    Boolean(practice?.passage) && canWalkWithPassage(block?.texts[0] ?? ''),
  ).current
  const kindAt = (n: number): MovementKind | undefined =>
    passageMode && block && n >= 0 && n < total ? movementKind(block.name, labels[n] ?? '') : undefined
  const passage = passageMode ? readPassage(texts[0] ?? '') : null
  /** The finder is up: before the first movement, or to read another passage. */
  const [choosing, setChoosing] = useState<'first' | 'again' | null>(
    passageMode && !passage ? 'first' : null,
  )
  const [askChange, setAskChange] = useState(false)
  /** The rail widening into the leaf, once, as the chosen passage arrives. */
  const [widen, setWiden] = useState(false)
  const [slow, setSlow] = useState(0)
  /** The phone's strip that is open, by movement. */
  const [openStrip, setOpenStrip] = useState<number | null>(null)
  const passageRef = passage?.ref ?? null
  const chapterKey = passageRef && !passage?.own ? `${passageRef.book} ${passageRef.chapter}` : null
  const [chapter, setChapter] = useState<{ key: string; verses: Verse[] } | null>(null)
  useEffect(() => {
    if (!chapterKey) return
    const at = chapterKey.lastIndexOf(' ')
    let live = true
    void loadChapter(chapterKey.slice(0, at), Number(chapterKey.slice(at + 1))).then(
      (verses) => live && setChapter({ key: chapterKey, verses }),
    )
    return () => {
      live = false
    }
  }, [chapterKey])
  /** The passage's verses: null while its chapter loads, [] when it will not. */
  const passageVerses: Verse[] | null =
    !passageRef || !chapterKey
      ? []
      : chapter?.key === chapterKey
        ? versesIn(passageRef, chapter.verses)
        : null
  const markIndex =
    passageMode && block ? block.labels.findIndex((l) => movementKind(block.name, l) === 'mark') : -1
  const caught = markIndex >= 0 ? caughtOf(texts[markIndex] ?? '') : null

  // ── Drawn lines ──────────────────────────────────────────────────────────
  /**
   * Every writing movement of a scripture ritual can bring words in from the
   * passage: select them, and they land in the answer as a quote line, with a
   * line drawn back to where they came from. Lectio's Meditatio keeps its own
   * single catch; Read and Rest have nothing to write in.
   */
  const drawsAt = (n: number) => {
    if (!passageMode || n < 0 || n >= total) return false
    const k = kindAt(n)
    return k !== 'read' && k !== 'dwell' && k !== 'mark'
  }
  /** Every quote in the ritual, keyed `movement:index`, in each answer's order. */
  const drawn = passageMode
    ? labels.flatMap((_, n) => {
        const k = kindAt(n)
        if (k === 'read' || k === 'dwell') return []
        return quotesIn(texts[n] ?? '').map((q, idx) => ({ key: `${n}:${idx}`, n, idx, ...q }))
      })
    : []
  /** Words chosen in the passage and not yet brought in. */
  const [pending, setPending] = useState<WordSpan | null>(null)
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  const bringInRef = useRef<() => void>(() => {})
  const [rest, setRest] = useState<{ n: number; offset: number } | null>(null)
  const [hovered, setHovered] = useState<{ keys: string[]; el: HTMLElement } | null>(null)
  const [pageLit, setPageLit] = useState<string | null>(null)
  useEffect(() => {
    setPending(null)
    setHovered(null)
    setPageLit(null)
  }, [i])
  useEffect(() => {
    if (!widen) return
    const id = setTimeout(() => setWiden(false), 1000)
    return () => clearTimeout(id)
  }, [widen])

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
    if (blocked || choosing) return
    const id = requestAnimationFrame(() =>
      paneRefs.current[iRef.current]?.focus({ preventScroll: true }),
    )
    return () => cancelAnimationFrame(id)
  }, [blocked, choosing])

  // ── Keys ─────────────────────────────────────────────────────────────────
  // ⌥↵ is "continue". Not ⌘↵ — that is focus mode everywhere else in the app,
  // and one key meaning two things gave mixed signals. Not the ⌘⇧←/→ chord
  // this used to answer to either: on a Mac those select to the line's
  // start and end, and a writer's own text selection must not be taken.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The sheet over us owns the keyboard while it is open — and so does the
      // finder, which answers Escape one level at a time on its own.
      if (blocked || choosing) return
      // Words chosen in the passage: Enter brings them in, Escape lets them go
      // (before Escape can mean "leave the ritual").
      if (pendingRef.current && !e.altKey && !e.metaKey && !e.ctrlKey) {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          bringInRef.current()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          setPending(null)
          return
        }
      }
      if (askChange) {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          setAskChange(false)
        }
        return
      }
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
  }, [CLOSE, askChange, blocked, choosing, go, i, leave])


  if (!block) return null

  // What the writer walks through: the movements, then — for a ritual entry —
  // After. Everything below renders panes, so After needs no layout of its own.
  const paneLabels = entry ? [...labels, AFTER_LABEL] : labels
  // A `mark` answer opens with the caught word as a quote line; the writer's
  // box holds only what is under it. See passage.ts.
  const shown = texts.map((t, n) => (kindAt(n) === 'mark' ? bodyOf(t) : t))
  const paneTexts = entry ? [...shown, after] : shown
  const paneQuestion = (n: number) => (n === AFTER ? '' : questionFor(practice, labels[n] ?? ''))
  const panePlaceholder = (n: number) =>
    n === AFTER ? AFTER_PLACEHOLDER : placeholderFor(practice, labels[n] ?? '')
  const nothingWritten = paneTexts.every((t) => t.trim() === '')

  const written = i < CLOSE && (paneTexts[i] ?? '').trim().length > 0
  // Only a keyboard makes room worth fighting for; on desktop nothing recedes.
  // A passage is not typing: the Read movement keeps its question full size.
  const yielding = written && touch && kindAt(i) !== 'read'

  const write = (n: number, value: string) => {
    if (n === AFTER) {
      setAfter(value)
      return
    }
    setTexts((prev) => {
      const next = prev.slice()
      next[n] = kindAt(n) === 'mark' ? withCaught(caughtOf(prev[n] ?? ''), value) : value
      return next
    })
  }

  // ── The passage, acted on ────────────────────────────────────────────────
  const choosePassage = (ref: PassageRef, verses: Verse[] | null) => {
    // The same fence keeps its id when the passage is changed, so the saved
    // scripture item is updated rather than a second one minted.
    const had = parseSpiritualBlocks(textsRef.current[0] ?? '').find((b) => b.type === 'scripture')
    const md = writePassage(ref, verses, had?.id ?? crypto.randomUUID())
    setTexts((prev) => {
      const next = prev.slice()
      next[0] = md
      return next
    })
    const first = choosing === 'first'
    setChoosing(null)
    if (first) {
      setWiden(true)
      setI(0)
      embla?.scrollTo(0, true)
    }
  }
  /** Change it — asked first when anything has been written under it. */
  const requestChange = () => {
    if (texts.some((t, n) => n > 0 && t.trim() !== '')) setAskChange(true)
    else setChoosing('again')
  }
  const setCaught = (phrase: string | null) => {
    if (markIndex < 0) return
    setTexts((prev) => {
      const next = prev.slice()
      next[markIndex] = withCaught(phrase, bodyOf(prev[markIndex] ?? ''))
      return next
    })
  }
  /**
   * A quote, into the answer being written: on its own line at the caret, with
   * a blank line either side so markdown never folds the writer's next
   * sentence into it — which would show their words as Scripture.
   */
  const insertQuote = (quote: string) => {
    const n = iRef.current
    const handle = paneRefs.current[n]
    if (handle?.insertAt && handle.getCursor && handle.getDoc) {
      const p = placeQuote(handle.getDoc(), handle.getCursor(), quote)
      handle.insertAt(p.at, p.text)
      if (handle.focusAt) handle.focusAt(p.caret)
      else handle.focus()
      return
    }
    const current = paneTexts[n] ?? ''
    const box = handle instanceof HTMLTextAreaElement ? handle : null
    const p = placeQuote(current, box ? box.selectionStart : current.length, quote)
    write(n, current.slice(0, p.at) + p.text + current.slice(p.at))
    if (box) {
      requestAnimationFrame(() => {
        box.focus()
        box.setSelectionRange(p.caret, p.caret)
      })
    }
  }
  const bringIn = () => {
    const span = pendingRef.current
    if (!span) return
    insertQuote(formatQuote(span.text, span.v, span.vEnd))
    setPending(null)
  }
  bringInRef.current = bringIn
  /** A whole verse, by its number. */
  const citeVerse = (vn: number) => {
    const v = passageVerses?.find((x) => x.n === vn)
    if (!v) return
    insertQuote(quoteVerse(v.text, vn))
    setPending(null)
  }
  const atClose = i >= CLOSE
  /** Where each quote's words are in the passage — drawn from the quotes, never stored. */
  const highlights: Highlight[] = passageVerses
    ? drawn.flatMap((q) =>
        (findQuote(passageVerses, q.text, q.v, q.vEnd) ?? []).map((r) => ({
          key: q.key,
          n: r.n,
          start: r.start,
          end: r.end,
          here: atClose || q.n === i,
        })),
      )
    : []
  /** Which writing movement a quote came from, as a tone at the close. */
  const toneOf = (n: number) => labels.slice(0, n).filter((_, m) => kindAt(m) !== 'read' && kindAt(m) !== 'dwell').length
  const tetherKeys: TetherKey[] = atClose
    ? drawn.map((q) => ({ key: q.key, tone: toneOf(q.n) }))
    : drawn.filter((q) => q.n === i).map((q) => ({ key: q.key, tone: null }))
  const lit =
    pageLit ??
    (hovered ? (hovered.keys.find((k) => k.startsWith(`${i}:`)) ?? hovered.keys[0] ?? null) : null)
  /** What a movement said right after it quoted — for the card on a highlight. */
  const saidAfter = (key: string): string => {
    const q = drawn.find((d) => d.key === key)
    if (!q) return ''
    const lines = (texts[q.n] ?? '').split('\n')
    for (let l = q.line + 1; l < lines.length; l++) {
      const t = lines[l]!.trim()
      if (!t) continue
      if (t.startsWith('>')) return ''
      return t
    }
    return ''
  }
  /** Where each quote sits on the right-hand page, for its line. */
  const tetherTargets = (): Map<string, HTMLElement> => {
    const out = new Map<string, HTMLElement>()
    if (atClose) {
      document.querySelectorAll<HTMLElement>('.rc__drawn [data-qkey]').forEach((el) => out.set(el.dataset.qkey!, el))
      return out
    }
    const page = document.querySelector<HTMLElement>('.rc--facing .rc__page')
    if (!page) return out
    const mine = drawn.filter((q) => q.n === i)
    let k = 0
    const caughtEl = kindAt(i) === 'mark' ? page.querySelector<HTMLElement>('.rc__caught') : null
    if (caughtEl && mine[0]) out.set(mine[k++]!.key, caughtEl)
    page.querySelectorAll<HTMLElement>('.cm-line').forEach((line) => {
      if (!/^\s*>/.test(line.textContent ?? '')) return
      const q = mine[k++]
      if (q) out.set(q.key, line)
    })
    return out
  }
  /** Following a quote from the page side: which one is under the pointer. */
  const onPageHover = (e: React.MouseEvent) => {
    const line = (e.target as HTMLElement).closest<HTMLElement>('.cm-line, .rc__caught, [data-qkey]')
    let key: string | null = null
    if (line) {
      for (const [k, el] of tetherTargets()) if (el === line) key = k
    }
    if (key !== pageLit) setPageLit(key)
  }

  if (choosing && practice) {
    return createPortal(
      <PassageFinder
        practice={practice}
        current={choosing === 'again' ? (passage?.reference ?? null) : null}
        onChoose={choosePassage}
        // Leaving before any passage is chosen leaves nothing behind.
        onBack={() => (choosing === 'first' ? leave() : setChoosing(null))}
        backLabel={entry?.backTo ?? 'your entry'}
      />,
      document.body,
    )
  }

  const kind = kindAt(i)
  const own = passage?.own ?? false
  const where = desk ? 'on the left' : 'above'
  /** The passage, however this movement uses it. */
  const passageBody = (mode: MovementKind | 'plain' | 'quote', opts: { slowly?: boolean } = {}) =>
    passage ? (
      <PassageBody
        key={opts.slowly ? `slow-${slow}` : 'still'}
        passage={passage}
        verses={passageVerses}
        mode={mode}
        caught={caught}
        cited={mode === 'quote' || mode === 'cite' ? citedVerses(texts[i] ?? '') : []}
        highlights={highlights}
        lit={lit}
        pending={pending}
        {...(mode === 'mark' ? { onCatch: (p: string) => setCaught(p) } : {})}
        {...(mode === 'quote' || mode === 'cite'
          ? {
              onCite: citeVerse,
              onChoosing: setPending,
              onChosen: setPending,
              onRest: setRest,
            }
          : {})}
        onHoverHighlight={(keys, el) => setHovered(keys && el ? { keys, el } : null)}
        slow={Boolean(opts.slowly && slow > 0)}
      />
    ) : null
  /** What a movement puts between its question and the box — or instead of the box. */
  const lead = (n: number): React.ReactNode => {
    const k = kindAt(n)
    if (k === 'mark') {
      if (own) {
        return (
          <input
            className="rc__typein"
            value={caught ?? ''}
            placeholder="Type the word or phrase that caught you"
            onChange={(e) => setCaught(e.target.value)}
          />
        )
      }
      return caught ? (
        <CaughtLine phrase={caught} onRelease={() => setCaught(null)} />
      ) : (
        <p className="rc__await">Touch a word {where}, or {desk ? 'drag across' : 'tap two'} for a phrase.</p>
      )
    }
    const said = k === 'carry' && caught ? <CaughtLine phrase={caught} small /> : null
    // Said once, until the first quote is in: after that the gesture is known.
    const hint =
      drawsAt(n) && !own && quotesIn(texts[n] ?? '').length === 0 ? (
        <p className="rc__await">
          {desk ? 'Select any words on the left to bring them in.' : 'Open the passage and select words to bring them in.'}
        </p>
      ) : null
    const ghost =
      desk && n === i && pending ? (
        <QuoteGhost span={pending} locate={() => caretLine(paneRefs.current[n])} />
      ) : null
    return said || hint || ghost ? (
      <>
        {said}
        {hint}
        {ghost}
      </>
    ) : null
  }
  /** A movement with nothing to write in: the passage is the answer, or rest is. */
  const instead = (n: number): React.ReactNode | undefined => {
    const k = kindAt(n)
    if (k === 'read') return desk ? <p className="rc__await">The passage is on the left. Take your time.</p> : null
    // An older Contemplatio written in keeps its words and its box.
    if (k === 'dwell' && (texts[n] ?? '').trim() === '') {
      return <DwellView word={caught ?? passage?.reference ?? ''} />
    }
    return undefined
  }
  const nextLabel = (n: number): string | undefined => {
    const k = kindAt(n)
    if (k === 'read') return 'I’ve read it'
    if (k === 'dwell') return 'Amen'
    return undefined
  }
  const askChangeDialog = askChange ? (
    <div className="rc__ask" role="alertdialog" aria-modal="true" aria-label="Read another passage?">
      <div className="rc__ask-box">
        <h3>Read another passage?</h3>
        <p>
          What you’ve written stays on this page. {passage?.reference} is replaced by the passage you choose
          next{caught ? `, and “${caught}” stays in your words but goes dark in the text if it isn’t there` : ''}.
        </p>
        <div className="rc__ask-tools">
          <button type="button" onClick={() => setAskChange(false)}>
            Keep {passage?.reference}
          </button>
          <button
            type="button"
            className="rc__ask-go"
            onClick={() => {
              setAskChange(false)
              setChoosing('again')
            }}
          >
            Choose another
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (desk) {
    const leafMode: MovementKind | 'plain' | 'quote' =
      kind === 'read' || kind === 'mark' || kind === 'dwell' ? kind : drawsAt(i) ? 'quote' : 'plain'
    /** At the close: every line drawn, movement by movement. */
    const drawnRecord =
      passage && drawn.length > 0 ? (
        <section className="rc__drawn" aria-label={`What you drew from ${passage.reference}`}>
          <p className="rc__drawn-head">What you drew from {passage.reference}</p>
          {labels.map((label, n) => {
            const mine = drawn.filter((q) => q.n === n)
            if (mine.length === 0) return null
            return (
              <div key={label} className="rc__drawn-mv" data-tone={toneOf(n) % 3}>
                <span className="rc__drawn-label">{label}</span>
                {mine.map((q) => {
                  const after = saidAfter(q.key)
                  return (
                    <div key={q.key} className="rc__drawn-q">
                      <blockquote data-qkey={q.key}>
                        {q.text}
                        {q.v != null && (
                          <span className="rc__drawn-v">
                            {q.vEnd != null && q.vEnd !== q.v ? `vv. ${q.v}–${q.vEnd}` : `v. ${q.v}`}
                          </span>
                        )}
                      </blockquote>
                      {after && <p>{after}</p>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </section>
      ) : null
    return createPortal(
      <>
      <DeskLayout
        leaf={
          passage ? (
            <div className="rc__leaf-text">
              <div className="rc__leaf-ref">
                <span>{passage.reference}</span>
                {(kind === 'read' || !kind) && (
                  <button type="button" onClick={requestChange}>
                    change
                  </button>
                )}
              </div>
              {passageBody(leafMode, { slowly: kind === 'read' })}
              {kind === 'read' && !own && (
                <div className="rc__leaf-under rc__chrome">
                  <button type="button" onClick={() => setSlow((n) => n + 1)}>
                    Read it again, slowly
                  </button>
                </div>
              )}
            </div>
          ) : undefined
        }
        widen={widen}
        closeExtra={drawnRecord}
        onPageHover={passage ? onPageHover : undefined}
        lead={lead}
        instead={instead}
        nextLabel={nextLabel}
        // Said from what is stored, not what the box shows: a Meditatio with
        // only its caught word is walked, and says the word.
        filledAt={(n) => ((n < total ? texts[n] : paneTexts[n]) ?? '').trim() !== ''}
        gistAt={(n) => gistOf((n < total ? texts[n] : paneTexts[n]) ?? '')}
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
      />
      {passage && !own && <Tethers keys={tetherKeys} targets={tetherTargets} lit={lit} rest={drawsAt(i) ? rest : null} />}
      {pending && drawsAt(i) && <QuoteChip span={pending} onBring={bringIn} onLetGo={() => setPending(null)} />}
      {hovered && !pending && (
        <DrawnCard
          el={hovered.el}
          rows={hovered.keys.flatMap((k) => {
            const q = drawn.find((d) => d.key === k)
            return q ? [{ key: k, label: q.n === i ? 'In this answer' : (labels[q.n] ?? ''), said: saidAfter(k), tone: toneOf(q.n) % 3 }] : []
          })}
          foot={drawsAt(i) && hovered.keys.every((k) => !k.startsWith(`${i}:`)) ? 'Select it to bring it in here too' : null}
        />
      )}
      {askChangeDialog}
      </>,
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
          const k = kindAt(n)
          const replaced = instead(n)
          // The passage on a phone: the whole pane when reading it, the top of
          // the pane when a word is to be caught, a strip everywhere else.
          const above =
            !passage || k === 'read' || k === 'dwell' || n === AFTER ? null : k === 'mark' ? (
              <div className="rc__psg-top">{passageBody('mark')}</div>
            ) : (
              <>
                <PassageStrip
                  reference={passage.reference}
                  word={caught}
                  open={openStrip === n}
                  onToggle={() => setOpenStrip((o) => (o === n ? null : n))}
                />
                {openStrip === n && (
                  <div className="rc__psg-top">
                    {passageBody(drawsAt(n) ? 'quote' : 'plain')}
                    {pending && n === i && (
                      <div className="rc__bring">
                        <button type="button" className="rc__bring-go" onMouseDown={(e) => e.preventDefault()} onClick={bringIn}>
                          Reflect on “{pending.text.length > 40 ? `${pending.text.slice(0, 40)}…` : pending.text}”
                        </button>
                        <button type="button" onClick={() => setPending(null)}>
                          Let go
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          return (
            <section className="rc__pane" key={n === AFTER ? '__after' : label} aria-hidden={n !== i}>
              <div className="rc__inner">
                {above}
                <span className="rc__label">{label}</span>
                {n === AFTER ? null : (
                  <p className="rc__q" data-small={n === i && yielding ? 'true' : undefined}>
                    {paneQuestion(n)}
                  </p>
                )}
                {k === 'read' && passage ? (
                  <div className="rc__psg-pane">
                    {passageBody('read')}
                    <div className="rc__leaf-under">
                      <button type="button" onClick={requestChange}>
                        Change passage
                      </button>
                    </div>
                  </div>
                ) : replaced !== undefined && replaced !== null ? (
                  replaced
                ) : (
                  <>
                    {lead(n)}
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
                  </>
                )}
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
            {nextLabel(i) ?? (i < CLOSE - 1 ? `Next: ${paneLabels[i + 1]}` : 'Close the ritual')}
          </button>
        )}
      </footer>
      {askChangeDialog}
    </div>,
    document.body,
  )
}

/** Which line of an answer the caret is on, and whether it is empty — where a quote will land. */
function caretLine(h: Focusable | null | undefined): { line: number; empty: boolean } | null {
  if (!h?.getDoc || !h.getCursor) return null
  const doc = h.getDoc()
  const line = doc.slice(0, h.getCursor()).split('\n').length - 1
  return { line, empty: (doc.split('\n')[line] ?? '').trim() === '' }
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
  // A caught word (Lectio's Meditatio) opens its answer as a quote line.
  const phrase = caughtOf(out)
  if (phrase !== null) {
    const rest = bodyOf(out).replace(/\s+/g, ' ').trim()
    return rest ? `“${phrase}” — ${rest}` : `“${phrase}”`
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
  /** A scripture ritual's passage: the rail widens into a leaf that holds it. */
  leaf?: React.ReactNode
  /** Widening now — once, as the chosen passage arrives. */
  widen?: boolean
  /** Between a movement's question and its box. */
  lead?: (n: number) => React.ReactNode
  /** Instead of a movement's box, when it has nothing to write in (undefined: the box). */
  instead?: (n: number) => React.ReactNode | undefined
  /** The continue button's words for a movement, when not the default. */
  nextLabel?: (n: number) => string | undefined
  filledAt?: (n: number) => boolean
  gistAt?: (n: number) => string
  /** More for the close — the lines a scripture ritual drew. */
  closeExtra?: React.ReactNode
  /** Pointer over the page, to follow a quote's line from its end. */
  onPageHover?: ((e: React.MouseEvent) => void) | undefined
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
  leaf,
  widen = false,
  lead,
  instead,
  nextLabel,
  filledAt,
  gistAt,
  closeExtra,
  onPageHover,
}: DeskProps) {
  const total = labels.length
  const filled = filledAt ?? ((n: number) => (texts[n] ?? '').trim() !== '')
  const gist = gistAt ?? ((n: number) => gistOf(texts[n] ?? ''))
  const reachable = (n: number) => n <= reached || filled(n)
  const label = labels[i] ?? ''
  const facing = leaf != null
  /**
   * Focus, on the facing leaf: while the writer types, everything on it but
   * the passage fades back. A real move of the mouse brings it back — not a
   * trackpad's twitch.
   */
  const [typing, setTyping] = useState(false)
  const replaced = i < total ? instead?.(i) : undefined

  return (
    <div
      className={`ritual-composer rc--desk${facing ? ' rc--facing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} — movement ${Math.min(i + 1, total)} of ${total}`}
      data-widen={facing && widen ? 'true' : undefined}
      data-typing={facing && typing ? 'true' : undefined}
      onMouseMove={
        facing && typing
          ? (e) => {
              if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) setTyping(false)
            }
          : undefined
      }
    >
      {/* The composer covers the whole window in the Mac app, so the rail's
          empty space is what moves it (Tauri drags only on the element that
          carries the attribute, not its children). */}
      <aside className="rc__rail" data-tauri-drag-region>
        {/* Not "close" and not "step out": say where it goes, and (below) that
            nothing is lost by going. */}
        <button type="button" className="rc__home rc__chrome" onClick={leave}>
          <span aria-hidden>←</span> Back to {backTo}
          <kbd className="rc__kbd">esc</kbd>
        </button>
        <h2 className="rc__title rc__chrome">{name}</h2>
        {origin && <p className="rc__origin rc__chrome">{origin}</p>}
        {/* What the practice is for sits with its name, as a dek — not stranded
            at the foot of the rail with a screen of nothing above it. */}
        {intention && <p className="rc__intent rc__chrome">{intention}</p>}

        {/* On the facing leaf the same path lies on one line, so the passage
            has the height; a walked movement says its gist on hover. */}
        <ol className={`rc__path${facing ? ' rc__path--row rc__chrome' : ''}`}>
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
                  title={facing && n !== i && filled(n) ? gist(n) : undefined}
                >
                  <span className="rc__path-label">{l}</span>
                  {n !== i && filled(n) && <span className="rc__gist">{gist(n)}</span>}
                </button>
              </li>
            )
          })}
        </ol>

        {leaf}

        <footer className="rc__rail-foot rc__chrome">
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

      <main
        className="rc__desk"
        onMouseOver={onPageHover}
        onKeyDown={
          facing
            ? (e) => {
                if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.length === 1) setTyping(true)
              }
            : undefined
        }
      >
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
              {replaced !== undefined ? (
                replaced
              ) : (
                <>
              {lead?.(i)}
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
                </>
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
                  {nextLabel?.(i) ?? (i < total - 1 ? 'Continue' : 'Finish')}
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
            {closeExtra}
          </div>
        )}
      </main>
    </div>
  )
}
