import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppNavigation } from '@/context/AppNavigation'
import { settingsStore } from '@/lib/settings'
import { pickCards, latestDeck, type Deck } from './pickCards'
import { onOpenFirstLight } from './open'
import { RELEASES, type CardArt } from './releases'
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
 * FIRST LIGHT — what changed, on the one morning it matters.
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
      onOpenFirstLight(() => {
        setManual(latestDeck())
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

  if (!deck || !open) return null

  const last = at === deck.cards.length - 1
  const card = deck.cards[at]!

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
      >
        <div className="firstlight__top">
          <span className="firstlight__mark">First light</span>
          <button type="button" className="firstlight__skip" onClick={() => close()}>
            Not now
          </button>
        </div>

        <div className="firstlight__body">
          {/* Keyed so each card animates in rather than cross-fading in place. */}
          <article className="firstlight__card" key={at}>
            <p className="firstlight__kicker">{card.kicker}</p>
            {card.art && <Art kind={card.art} />}
            <h2 className="firstlight__title" id="firstlight-title">
              {card.title}
            </h2>
            {card.body.map((p) => (
              <p className="firstlight__text" key={p}>
                {p}
              </p>
            ))}
          </article>
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

/** Decorative only — never the carrier of anything the card needs to say. */
function Art({ kind }: { kind: CardArt }) {
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
