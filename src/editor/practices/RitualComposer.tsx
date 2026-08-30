import { useCallback, useEffect, useRef, useState } from 'react'
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
 * this surface exists to undo. A finger drags the track, a key or a button moves
 * it — one mechanism, both platforms.
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
  const [texts, setTexts] = useState<string[]>(block ? block.texts : [])
  const [i, setI] = useState(() => {
    if (!block) return 0
    const firstEmpty = block.texts.findIndex((t) => t.trim() === '')
    return firstEmpty === -1 ? block.texts.length : firstEmpty
  })
  const iRef = useRef(i)
  iRef.current = i
  const trackRef = useRef<HTMLDivElement>(null)
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
      requestAnimationFrame(() => paneRefs.current[clamped]?.focus())
    },
    [CLOSE, commit],
  )

  const goRef = useRef(go)
  goRef.current = go

  // Land in the movement being written, with the caret already in it — and land
  // there again when a sheet that was covering us closes. Keyed on `blocked`
  // rather than mount, so closing About returns here; later moves take focus
  // through `go`.
  useEffect(() => {
    if (blocked) return
    const id = requestAnimationFrame(() => paneRefs.current[iRef.current]?.focus())
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

  // ── The gesture ──────────────────────────────────────────────────────────
  /*
   * Followed on the WINDOW with a NON-PASSIVE listener, for the reason spelled
   * out at length above `follow()` in `useSwipeToDismiss.ts`: React registers
   * `touchmove` passively at its root, so a `preventDefault` inside an
   * `onPointerMove`/`onTouchMove` prop is a no-op. This composer had exactly
   * that, and the cost was not a dead swipe — it was WebKit quietly taking the
   * drag as a pan. With the keyboard up there is nothing to pan but the visual
   * viewport, so the whole overlay slid up under the Dynamic Island and left a
   * gap of the same size above the keyboard, and chased itself trying to
   * recover. The composer keeps `touch-action: pan-y` like every other surface
   * here — the browser gets the vertical axis, this keeps the horizontal one —
   * and says so out loud the moment the drag proves horizontal.
   */
  const drag = useRef<{ x: number; y: number; horizontal: boolean } | null>(null)
  const unbind = useRef<(() => void) | null>(null)

  const setOffset = (px: number | null) => {
    const el = trackRef.current
    if (!el) return
    el.dataset.drag = px === null ? 'false' : 'true'
    // Restore the canonical offset rather than clearing it. React set this
    // inline and will not rewrite a value it thinks is unchanged, so blanking it
    // here left the track at movement one — which a plain tap on the writing
    // area was enough to trigger, since a tap is a touchstart and a touchend.
    el.style.transform =
      px === null ? `translateX(-${iRef.current * 100}%)` : `translateX(calc(-${iRef.current} * 100% + ${px}px))`
  }

  const follow = useCallback(() => {
    unbind.current?.()
    const move = (ev: TouchEvent) => {
      const d = drag.current
      const t = ev.touches[0]
      if (!d || !t) return
      const dx = t.clientX - d.x
      const dy = t.clientY - d.y
      if (!d.horizontal) {
        // Under this much travel the gesture has not said which way it is going,
        // and a vertical one belongs to the writing area's own scrolling.
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.5) return
        d.horizontal = true
      }
      if (ev.cancelable) ev.preventDefault()
      const i = iRef.current
      setOffset((i === 0 && dx > 0) || (i === CLOSE && dx < 0) ? dx * 0.3 : dx)
    }
    const end = (ev: TouchEvent) => {
      const d = drag.current
      drag.current = null
      unbind.current?.()
      setOffset(null)
      const t = ev.changedTouches[0]
      if (!d?.horizontal || !t) return
      const dx = t.clientX - d.x
      if (Math.abs(dx) > 60) goRef.current(iRef.current + (dx < 0 ? 1 : -1))
    }
    const cancel = () => {
      drag.current = null
      unbind.current?.()
      setOffset(null)
    }
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', cancel)
    unbind.current = () => {
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', cancel)
      unbind.current = null
    }
  }, [CLOSE])

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    if (!t) return
    drag.current = { x: t.clientX, y: t.clientY, horizontal: false }
    follow()
  }

  // Never leave the window listening once the composer is gone.
  useEffect(() => () => unbind.current?.(), [])

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
          ? ({
              top: frame.top,
              height: frame.height,
              // The masthead pads itself clear of the Dynamic Island — but once
              // the overlay has been pushed down past it there is nothing left
              // to clear, and the padding would be dead space at the top of a
              // screen that has none to spare.
              '--rc-offset': `${frame.top}px`,
            } as React.CSSProperties)
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

      <div
        className="rc__track"
        ref={trackRef}
        style={{ transform: `translateX(-${i * 100}%)` }}
        onTouchStart={onTouchStart}
      >
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
