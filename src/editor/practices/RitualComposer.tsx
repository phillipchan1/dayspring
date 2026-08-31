import { useCallback, useEffect, useRef, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { createPortal } from 'react-dom'
import { useVisualViewportFrame } from '@/hooks/useViewportHeight'
import { useTouchPrimary } from '@/hooks/useMediaQuery'
import { PRACTICE_BY_NAME } from './practicesData'
import {
  composeRitualMarkdown,
  readRitual,
  ritualBlockRange,
} from './ritualDocument'
import './RitualComposer.css'

interface Props {
  /** Which ritual block in the entry this composer owns. */
  blockIndex: number
  /** The editor's live document. */
  getDoc: () => string
  /** Write the rebuilt block back into the entry. */
  replaceRange: (from: number, to: number, text: string) => void
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
 */
export function RitualComposer({
  blockIndex,
  getDoc,
  replaceRange,
  onClose,
  onAbout,
  blocked = false,
}: Props) {
  const seed = useRef(readRitual(getDoc(), blockIndex))
  const block = seed.current
  /** Open on the movement still waiting, or on the close if there is none. */
  const startAt = (() => {
    if (!block) return 0
    const firstEmpty = block.texts.findIndex((t) => t.trim() === '')
    return firstEmpty === -1 ? block.texts.length : firstEmpty
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
  const paneRefs = useRef<(HTMLTextAreaElement | null)[]>([])
  const touch = useTouchPrimary()
  // Not `inset: 0` plus a height: a fixed overlay is anchored to the layout
  // viewport, so once iOS scrolls the page to keep the focused field above the
  // keyboard, the composer rides up under the Dynamic Island and leaves a gap of
  // exactly the same size above the keyboard. Driving both edges from the
  // visual viewport keeps it where the writer can see it.
  const frame = useVisualViewportFrame()

  const practice = block ? PRACTICE_BY_NAME.get(block.name) : undefined
  const labels = block?.labels ?? []
  const total = labels.length
  /** The pane past the last movement: the close. */
  const CLOSE = total

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
  const commit = useCallback(() => {
    if (!block) return
    const doc = getDocRef.current()
    const range = ritualBlockRange(doc, blockIndex)
    if (!range) return
    const next = composeRitualMarkdown(block.name, block.labels, textsRef.current)
    if (doc.slice(range.from, range.to) === next) return
    replaceRangeRef.current(range.from, range.to, next)
  }, [block, blockIndex])

  useEffect(() => {
    const id = setTimeout(commit, 400)
    return () => clearTimeout(id)
  }, [texts, commit])
  // Leaving — by the ✕, by Escape, or because the entry closed under us.
  useEffect(() => () => commit(), [commit])

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(CLOSE, next))
      commit()
      setI(clamped)
      embla?.scrollTo(clamped)
      requestAnimationFrame(() => paneRefs.current[clamped]?.focus({ preventScroll: true }))
    },
    [CLOSE, commit, embla],
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
      const n = embla.selectedScrollSnap()
      commit()
      setI(n)
      requestAnimationFrame(() => paneRefs.current[n]?.focus({ preventScroll: true }))
    }
    embla.on('select', onSelect)
    return () => {
      embla.off('select', onSelect)
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
  // Plain arrows belong to the caret, and ⌘←/⌥← are start-of-line and
  // previous-word, so the shift chord is what is left.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The sheet over us owns the keyboard while it is open.
      if (blocked) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(i + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(i - 1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [blocked, go, i, onClose])


  if (!block) return null

  const written = i < total && (texts[i] ?? '').trim().length > 0
  // Only a keyboard makes room worth fighting for; on desktop nothing recedes.
  const yielding = written && touch

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
        <button type="button" className="rc__x" onClick={onClose} aria-label="Leave the ritual">
          ✕
        </button>
        <span className="rc__name">{block.name}</span>
        <button
          type="button"
          className="rc__about"
          onClick={() => onAbout(block.name)}
          aria-label={`About ${block.name}`}
        >
          about
        </button>
      </header>

      <div className="rc__spine" data-yield={yielding ? 'true' : undefined} aria-hidden>
        {labels.map((label, n) => (
          <span
            key={label}
            className="rc__pip"
            data-on={n === i ? 'true' : undefined}
            data-done={(texts[n] ?? '').trim() && n !== i ? 'true' : undefined}
          />
        ))}
      </div>

      <div className="rc__viewport" ref={emblaRef}>
        <div className="rc__track">
        {labels.map((label, n) => {
          const prompt = practice?.prompts.find((p) => p.label === label)
          return (
            <section className="rc__pane" key={label} aria-hidden={n !== i}>
              <div className="rc__inner">
                <span className="rc__label">{label}</span>
                <p className="rc__q" data-small={n === i && yielding ? 'true' : undefined}>
                  {prompt?.question ?? ''}
                </p>
                <textarea
                  className="rc__write"
                  ref={(el) => {
                    paneRefs.current[n] = el
                  }}
                  value={texts[n] ?? ''}
                  placeholder={prompt?.placeholder ?? ''}
                  tabIndex={n === i ? 0 : -1}
                  onChange={(e) =>
                    setTexts((prev) => {
                      const next = prev.slice()
                      next[n] = e.target.value
                      return next
                    })
                  }
                />
              </div>
            </section>
          )
        })}

          <section className="rc__pane" aria-hidden={i !== CLOSE}>
            <div className="rc__close">
              <h2 className="rc__close-name">{block.name}</h2>
              <p className="rc__close-origin">{practice?.origin ?? ''}</p>
              <button type="button" className="rc__next" onClick={onClose}>
                Back to your entry
              </button>
            </div>
          </section>
        </div>
      </div>

      <footer className="rc__foot">
        <button
          type="button"
          className="rc__back"
          onClick={() => go(i - 1)}
          disabled={i === 0}
        >
          {i > 0 && i <= total ? `‹ ${labels[i - 1]}` : ''}
        </button>
        {i < CLOSE && (
          <button type="button" className="rc__next" onClick={() => go(i + 1)}>
            {i < total - 1 ? `Next: ${labels[i + 1]}` : 'Close the ritual'}
          </button>
        )}
      </footer>
    </div>,
    document.body,
  )
}
