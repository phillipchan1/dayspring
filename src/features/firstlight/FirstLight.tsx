import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppNavigation } from '@/context/AppNavigation'
import { usePagedSwipe } from '@/hooks/usePagedSwipe'
import { settingsStore } from '@/lib/settings'
import { pickCards, latestDeck, type Deck } from './pickCards'
import { onOpenFirstLight } from './open'
import { RELEASES, WHATS_NEW_LABEL, type CardArt } from './releases'
import composerStill from './assets/open-your-bible.jpg'
import stepsGif from './assets/open-your-bible.gif'
import './FirstLight.css'

/**
 * A localStorage mirror of settings.lastSeenRelease.
 *
 * settings sync is last-writer-wins, so a stale blob arriving from another
 * device can carry an older lastSeenRelease and re-open a deck this device
 * already dismissed. This key is never written by the sync, so it holds the
 * line locally. Cross-device catch-up still rides on the synced field.
 */
const GUARD_KEY = 'dayspring.firstlight.seen'

/**
 * How long a deck pulled down takes to finish leaving. Its twin is the
 * `translate` transition on `.firstlight[data-leaving='true'] .firstlight__panel`.
 */
const PULL_EXIT_MS = 240

function readGuard(): string | null {
  try {
    return localStorage.getItem(GUARD_KEY)
  } catch {
    return null // private mode / blocked storage — the synced field still works
  }
}

/** Whichever of the two ids is further along the registry. */
function effectiveLastSeen(): string | null {
  const synced = settingsStore.get().lastSeenRelease ?? null
  const guard = readGuard()
  if (synced == null) return guard
  if (guard == null) return synced
  const at = (id: string) => RELEASES.findIndex((r) => r.id === id)
  return at(guard) > at(synced) ? guard : synced
}

/**
 * FIRST LIGHT (internal name; users see “What’s new”) — what changed, on the one
 * morning it matters.
 *
 * PRINCIPLE 3 ("modal interruptions while the cursor is active" are forbidden)
 * is enforced structurally, not by good intentions: the deck is decided **once**,
 * in a useState initialiser, at the moment the app mounts. Nothing recomputes it.
 * There is no effect watching settings, no subscription, no timer. A deck that
 * cannot be recomputed cannot appear over a live cursor — the worst case is that
 * a release ships while someone has the app open and they see it next cold start,
 * which is exactly right.
 *
 * App.tsx mounts this only in the fully-entitled branch, so it can never appear
 * during onboarding, over the paywall, or on the locked screen.
 */
export function FirstLight() {
  // Decided once. See the note above — this must never become an effect.
  const [autoDeck] = useState<Deck | null>(() => pickCards(effectiveLastSeen()))
  // The Settings → About door. Separate state so the automatic path above stays
  // a pure one-shot; a person pressing a button is not an interruption.
  const [manual, setManual] = useState<Deck | null>(null)
  const [at, setAt] = useState(0)
  const [open, setOpen] = useState(true)
  const deck = manual ?? autoDeck
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<Element | null>(null)
  const { go } = useAppNavigation()

  const close = useCallback(
    (land?: boolean) => {
      if (!deck) return
      // Mark seen on EVERY exit path — "Not now", Esc, backdrop, and finishing
      // all count. Dismissing is final; there is no second attempt.
      try {
        localStorage.setItem(GUARD_KEY, deck.seenId)
      } catch {
        /* ignore quota / private-mode failures */
      }
      settingsStore.update({ lastSeenRelease: deck.seenId })
      setOpen(false)
      setManual(null)
      if (land && deck.land) go({ surface: deck.land })
    },
    [deck, go],
  )

  useEffect(
    () =>
      onOpenFirstLight((deck) => {
        setManual(deck ?? latestDeck())
        setAt(0)
        setOpen(true)
      }),
    [],
  )

  // Focus the panel so Esc and the arrow keys work without a click, and hand
  // focus back where it came from on close.
  useEffect(() => {
    if (!open || !deck) return
    restoreTo.current = document.activeElement
    panelRef.current?.focus()
    return () => {
      const el = restoreTo.current
      if (el instanceof HTMLElement) el.focus()
    }
  }, [open, deck])

  // The cards are a paged track under the finger, and the whole deck can be
  // pulled down and away — a pull is a dismissal like any other, so it is
  // marked seen the same way.
  const swipe = usePagedSwipe({
    index: at,
    count: deck?.cards.length ?? 0,
    onIndex: setAt,
    enabled: open && deck != null,
    pullDown: { onDismiss: () => close(), exitMs: PULL_EXIT_MS },
  })
  const pulling = swipe.dragging === 'down'

  if (!deck || !open) return null

  const last = at === deck.cards.length - 1

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    } else if (e.key === 'ArrowRight' && !last) {
      setAt((n) => n + 1)
    } else if (e.key === 'ArrowLeft' && at > 0) {
      setAt((n) => n - 1)
    }
  }

  return (
    <div
      className="firstlight"
      data-leaving={swipe.leaving}
      data-pulling={pulling}
      style={
        {
          // How far the deck has been pulled, 0–1, for the ground to fade by.
          '--firstlight-pull': Math.min(1, Math.max(0, swipe.offsetY) / 600).toFixed(3),
        } as React.CSSProperties
      }
      // A click on the ground behind the panel is a dismissal, like Esc.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="firstlight__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="firstlight-title"
        tabIndex={-1}
        ref={panelRef}
        onKeyDown={onKeyDown}
        {...swipe.handlers}
        style={{
          // `translate`, not `transform`: the sheet's entrance animation owns
          // `transform`, and a finished animation would win over this.
          translate: swipe.leaving ? undefined : `0 ${swipe.offsetY}px`,
          transitionDuration: swipe.leaving ? undefined : `${swipe.settleMs}ms`,
        }}
      >
        <div className="firstlight__grabber" aria-hidden />
        <div className="firstlight__top">
          <span className="firstlight__mark">{WHATS_NEW_LABEL}</span>
          <button type="button" className="firstlight__skip" onClick={() => close()}>
            Not now
          </button>
        </div>

        <div className="firstlight__body">
          <div
            className="firstlight__track"
            data-dragging={swipe.dragging === 'h'}
            style={{
              transform: `translate3d(calc(${-at * 100}% + ${swipe.offsetX}px), 0, 0)`,
              transitionDuration: `${swipe.settleMs}ms`,
            }}
          >
            {deck.cards.map((c, i) => (
              // Each card scrolls on its own; data-sheet-scroll keeps a pull
              // down from taking a card that is scrolled away from its top.
              <article
                className="firstlight__card"
                key={c.title}
                aria-hidden={i !== at}
                inert={i !== at}
                data-sheet-scroll
              >
                <p className="firstlight__kicker">{c.kicker}</p>
                {c.art && <Art kind={c.art} />}
                <h2 className="firstlight__title" id={i === at ? 'firstlight-title' : undefined}>
                  {c.title}
                </h2>
                {c.body.map((p) => (
                  <p className="firstlight__text" key={p}>
                    {p}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </div>

        <div className="firstlight__foot">
          <div className="firstlight__dots" role="tablist" aria-label="Cards">
            {deck.cards.map((c, i) => (
              <button
                key={c.title}
                type="button"
                role="tab"
                className="firstlight__dot"
                aria-current={i === at}
                aria-label={`Card ${i + 1} of ${deck.cards.length}`}
                onClick={() => setAt(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="firstlight__next"
            onClick={() => (last ? close(true) : setAt((n) => n + 1))}
          >
            {last ? (deck.landLabel ?? 'Done') : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Decorative glyphs are never the carrier of anything the card needs to say; the captures carry an alt. */
function Art({ kind }: { kind: CardArt }) {
  if (kind === 'climb') {
    // Four heights on one rail, rising — week, month, season, year. The top
    // one is lit because the mountain is still there.
    const at = [
      [10, 44],
      [62, 32],
      [114, 20],
      [166, 8],
    ]
    return (
      <svg className="firstlight__climb" viewBox="0 0 176 52" aria-hidden="true">
        <polyline points={at.map(([x, y]) => `${x},${y}`).join(' ')} />
        {at.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === at.length - 1 ? 5 : 3.5} className={i === at.length - 1 ? 'lit' : undefined} />
        ))}
      </svg>
    )
  }
  if (kind === 'composer' || kind === 'steps') {
    // Real captures of the shipped surface (scripts/capture-whats-new.mjs), not
    // drawings. The GIF is the same file the email uses; someone who has asked
    // the system for less motion gets its still instead.
    const still = kind === 'composer' || prefersReducedMotion()
    return (
      <img
        className="firstlight__shot"
        src={still ? composerStill : stepsGif}
        alt={
          kind === 'composer'
            ? 'The passage beside the page: John 15 on the left, and on the right a quote from it with a line drawn back to the words, and a line of your own writing below.'
            : 'A short recording. On a blank page, choose Open your Bible, type John 15, select words in the passage and press Return. The quote lands on your page and you write beside it.'
        }
        draggable={false}
      />
    )
  }
  if (kind === 'wall') {
    // The wall, from far enough away to see its shape. Lit cells stand for the
    // pages a subject touches — dimming, never filtering (D-017).
    const lit = new Set([1, 4, 6, 9])
    return (
      <div className="firstlight__wall" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} className={lit.has(i) ? 'lit' : undefined} />
        ))}
      </div>
    )
  }
  return (
    <div className="firstlight__keys" aria-hidden="true">
      {[
        ['1', 'Write'],
        ['2', 'Journal'],
        ['3', 'Ascent'],
        ['4', 'Lamp'],
        ['5', 'Altar'],
      ].map(([n, label]) => (
        <span className="firstlight__key" key={n}>
          ⌘<b>{n}</b> {label}
        </span>
      ))}
    </div>
  )
}
