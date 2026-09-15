import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  SHELF,
  PRACTICE_FUNCTIONS,
  PRACTICE_RHYTHMS,
  resolveMovements,
  type Practice,
  type PracticeFunction,
  type PracticePrompt,
  type PracticeRhythm,
} from './practicesData'
import { skyFor } from './ritualSky'
import './PracticeLibrary.css'

interface Props {
  /**
   * Begin a ritual — the caller closes the modal and seeds the editor.
   *
   * `movements` is what the block is actually written with. For every static
   * ritual it is `practice.prompts`; for The Round it is one movement per Life
   * Map domain, resolved here because this is where the domains are known.
   */
  onBegin: (practice: Practice, movements: PracticePrompt[]) => void
  /** Dismiss without beginning (Escape / scrim) — caller restores the caret. */
  onClose: () => void
  /** When true, selecting a ritual begins immediately (no preview/threshold). */
  skipPreview: boolean
  /** Persist the "skip the preview" preference. */
  onToggleSkipPreview: (value: boolean) => void
  /**
   * Opened from inside an entry that already has writing in it, rather than
   * from a blank page.
   *
   * The library's own taxonomy says why this matters: `PRACTICE_RHYTHMS` files
   * the `anytime` group as "Need-based", and a need-based practice — Lament,
   * Discernment, Threshold — is by definition one you reach for *because
   * something surfaced while writing*. Opening on "Any hour" buries exactly the
   * four you came for. So the filter starts on Need-based here, and says so.
   * Every other filter is still one tap away; this reorders and hides nothing.
   */
  midEntry?: boolean
  /** What beginning a ritual will do to the entry, shown at the threshold. */
  landing?: string | null
  /**
   * The clock, injected — for the App Store screenshot surfaces, which must
   * render the same frame whatever time the capture runs at. The app leaves it
   * unset and gets the real hour.
   */
  now?: Date
  /**
   * The writer's Life Map domains, in the Life Map's own chronological order —
   * the movements The Round is walked through.
   *
   * Injected rather than fetched here, for two reasons. The library is rendered
   * by the App Store screenshot surfaces and the `?__preview=` harness, neither
   * of which has a Supabase session, so a query inside this component would
   * throw in both. And loading is the caller's concern: `JournalScreen` already
   * knows when the library opened.
   *
   * `null` means not known yet (still loading, or a surface that has no Life
   * Map). `[]` means known and empty — a young journal — which is what puts The
   * Round into its "needs a few domains" state rather than hiding it.
   */
  domains?: readonly string[] | null
}

type RhythmFilter = PracticeRhythm | 'all'

/**
 * What search reads. Name, tradition and origin are how a person half-recalls a
 * ritual ("the Ignatian one", "Luther something"); the function label and the
 * movement questions are how they find one they have never heard of, which is
 * the case the old seven-chip function row served badly and this serves well —
 * "decision" reaches Ignatian Discernment without knowing the word "Ignatian".
 */
function haystack(p: Practice, fnLabel: string): string {
  return [
    p.name,
    p.tradition,
    p.origin,
    p.quote,
    p.intention,
    fnLabel,
    ...p.prompts.map((prompt) => `${prompt.label} ${prompt.question}`),
  ]
    .join(' ')
    .toLowerCase()
}

/**
 * Full-screen Rituals Library: browse the forms, pass through an orienting
 * preview (its questions), then begin writing. Fully keyboard-navigable — arrow
 * through the cards, Enter to choose, Enter again to begin. Power users can skip
 * the preview entirely (restored from Settings). Nothing is inserted into the
 * entry until "Begin writing".
 */
export function PracticeLibrary({
  onBegin,
  onClose,
  skipPreview,
  onToggleSkipPreview,
  midEntry = false,
  landing = null,
  now,
  domains = null,
}: Props) {
  // The sky is decided once, on open. Recomputing it would mean the light
  // shifting under someone who left the library sitting open — and the
  // 10:59 → 11:00 boundary redrawing the whole surface mid-browse.
  const sky = useRef(skyFor(now ?? new Date())).current

  // Mid-entry wins the FILTER: something surfaced while writing, which is a
  // stronger signal than the clock. The sky and the greeting still follow the
  // hour either way — the sky is about the world, the filter is about you.
  const [rhythm, setRhythm] = useState<RhythmFilter>(
    midEntry ? 'anytime' : sky.filter,
  )
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Practice | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const functionLabel = (fn: PracticeFunction) =>
    PRACTICE_FUNCTIONS.find((f) => f.id === fn)?.label ?? fn

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Searching reaches the WHOLE shelf. A person typing "lament" has told us
    // what they want far more precisely than the hour did, and hiding the one
    // ritual they asked for behind a filter they never touched is the kind of
    // cleverness that makes people stop using search.
    const pool = q ? SHELF : SHELF.filter((p) => rhythm === 'all' || p.rhythm.includes(rhythm))
    if (!q) return pool
    const terms = q.split(/\s+/)
    return pool.filter((p) => {
      const hay = haystack(p, functionLabel(p.function))
      return terms.every((t) => hay.includes(t))
    })
  }, [query, rhythm])

  // Reset the keyboard cursor when the visible set changes.
  useEffect(() => setActiveIdx(0), [query, rhythm])

  /** The movements a practice would actually be written with, right now. */
  const movementsOf = (practice: Practice) =>
    resolveMovements(practice, domains ?? [])

  /**
   * A dynamic ritual with nothing to walk yet. Its card stays on the shelf and
   * says what it needs — Principle 5, tell the truth about a surface that needs
   * history rather than faking a generic four-part life.
   *
   * `domains === null` is "not known yet", not "empty": while the Life Map is
   * still loading the card must not accuse a full journal of being empty.
   */
  const unready = (practice: Practice) =>
    practice.dynamic !== undefined && domains !== null && domains.length === 0

  // Selecting a ritual either previews it (threshold) or begins straight away.
  const choose = (practice: Practice) => {
    if (unready(practice)) return
    // Skipping the preview is a power-user setting for rituals whose shape you
    // already know. The Round's shape is your own life and changes week to
    // week, so it always crosses the threshold — that screen is the only place
    // you see which domains you are about to walk.
    if (skipPreview && !practice.dynamic) onBegin(practice, movementsOf(practice))
    else setSelected(practice)
  }

  // Keep the keyboard-active card in view.
  useEffect(() => {
    if (selected) return
    const el = gridRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, selected, visible.length])

  // Measure the live column count so arrow nav matches the rendered grid — which
  // reflows responsively (3 cols → 2 → 1). Cards in the first row share offsetTop.
  const columnCount = (): number => {
    const cards = gridRef.current?.querySelectorAll<HTMLElement>('.practice-card')
    if (!cards || cards.length === 0) return 1
    const top = cards[0]!.offsetTop
    let cols = 0
    for (const c of cards) {
      if (c.offsetTop === top) cols++
      else break
    }
    return Math.max(1, cols)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (selected) setSelected(null)
        else onClose()
        return
      }
      if (selected) {
        if (e.key === 'Enter') {
          e.preventDefault()
          onBegin(selected, movementsOf(selected))
        } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
          e.preventDefault()
          setSelected(null)
        }
        return
      }
      // While the caret is in the search field it owns the keyboard, or arrow
      // keys would move the card cursor instead of the caret and Backspace
      // would leave the threshold instead of deleting a letter. ArrowDown is
      // the one exception: it is how you step out of the field and into the
      // grid, which is what the key means there.
      if (e.target === searchRef.current && e.key !== 'ArrowDown') return
      const len = visible.length
      if (len === 0) return
      if (e.key === 'Enter') {
        e.preventDefault()
        const practice = visible[activeIdx]
        if (practice) choose(practice)
        return
      }
      // Spatial grid navigation: left/right step within a row, up/down jump a row
      // by the live column count. In a single column, left/right are no-ops and
      // only up/down move — matching what the eye expects from the layout.
      const cols = columnCount()
      const arrows = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']
      if (!arrows.includes(e.key)) return
      e.preventDefault()
      setActiveIdx((i) => {
        if (e.key === 'ArrowRight') return i % cols !== cols - 1 && i + 1 < len ? i + 1 : i
        if (e.key === 'ArrowLeft') return i % cols !== 0 ? i - 1 : i
        if (e.key === 'ArrowDown') return i + cols < len ? i + cols : i
        return i - cols >= 0 ? i - cols : i // ArrowUp
      })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const searching = query.trim().length > 0

  return createPortal(
    <div
      className="practice-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Rituals"
      data-band={sky.band}
      data-stars={sky.stars ? 'true' : undefined}
    >
      {/* The sky. Two layers, both inert, both behind everything.

          `--fixed` is the theme's OWN --journal-glow, untouched — the constant
          that keeps a cloister morning reading as cloister. `--hour` is the only
          thing the clock touches: one radial gradient laid over that light
          rather than in place of it. See ritualSky.ts for why that distinction
          is a constraint and not a preference. */}
      <div className="practice-sky practice-sky--fixed" aria-hidden />
      <div
        className="practice-sky practice-sky--hour"
        aria-hidden
        style={sky.tokens as CSSProperties}
      />
      <div className="practice-sky practice-sky--stars" aria-hidden />

      {/* The only way out of this full-screen overlay used to be Escape, and a
          phone has no Escape key — opening Rituals on touch was a dead end. The
          overlay is opaque edge to edge, so there is no scrim to tap either;
          it needs a real control. */}
      <button
        type="button"
        className="practice-modal__close"
        onClick={onClose}
        aria-label="Close rituals"
        title="Close"
      >
        ✕
      </button>
      <div className="practice-library">
        <header className="practice-library__header">
          {/* A fact about the clock. NEVER a claim about the writer — see
              ritualSky.ts. This replaces the static "The Rituals" eyebrow;
              the surface is already labelled by its own dialog title. */}
          <div className="practice-library__eyebrow">{sky.greeting}</div>
          <h1 className="practice-library__title">
            How will you <em>draw near</em> today?
          </h1>
          <p className="practice-library__subline">
            Tried and true rituals for the inner life — gathered from two thousand
            years of faithful writing.
          </p>
          {/* One line, why the shelf opens where it does. Mid-entry keeps
              priority: it knows something the clock doesn't. */}
          <p className="practice-library__because">
            {midEntry
              ? 'Starting from what you’ve written — the need-based practices come first.'
              : sky.because}
          </p>
        </header>

        <div className="practice-library__controls">
          <div
            className="practice-library__filters"
            role="tablist"
            aria-label="Filter by time of day"
          >
            {PRACTICE_RHYTHMS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                className="practice-filter"
                data-active={!searching && rhythm === r.id ? 'true' : undefined}
                aria-selected={!searching && rhythm === r.id}
                onClick={() => {
                  setQuery('')
                  setRhythm(r.id)
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="practice-search">
            <input
              id="practice-search"
              ref={searchRef}
              type="search"
              className="practice-search__input"
              placeholder="Search the rituals…"
              aria-label="Search the rituals by name, tradition, or what they ask"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {searching && (
          <p className="practice-library__searching">
            {visible.length === 0
              ? 'Nothing on the shelf matches that.'
              : `Searching every ritual — ${visible.length} ${visible.length === 1 ? 'match' : 'matches'}.`}
          </p>
        )}

        <div className="practice-library__grid" ref={gridRef}>
          {visible.map((practice, i) => (
            <button
              key={practice.name}
              type="button"
              className="practice-card"
              data-function={practice.function}
              data-active={i === activeIdx ? 'true' : undefined}
              data-unready={unready(practice) ? 'true' : undefined}
              aria-disabled={unready(practice) || undefined}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => choose(practice)}
            >
              <span className="practice-card__function">
                {functionLabel(practice.function)}
              </span>
              <span className="practice-card__name">{practice.name}</span>
              <span className="practice-card__origin">{practice.origin}</span>
              <span className="practice-card__quote">{practice.quote}</span>
              <span className="practice-card__footer">
                <span className="practice-card__tag">{practice.tradition}</span>
                {unready(practice) ? (
                  <span className="practice-card__needs">
                    {practice.dynamic?.needs}
                  </span>
                ) : (
                  <span className="practice-card__arrow" aria-hidden>
                    →
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="practice-threshold" data-visible={selected ? 'true' : undefined}>
        <button
          type="button"
          className="practice-threshold__back"
          onClick={() => setSelected(null)}
        >
          ← Rituals
        </button>
        {selected && (
          <div className="practice-threshold__inner">
            <div className="practice-threshold__function">
              {functionLabel(selected.function)}
            </div>
            <div className="practice-threshold__name">{selected.name}</div>
            <div className="practice-threshold__origin">{selected.origin}</div>
            <div className="practice-threshold__divider" aria-hidden />
            <p className="practice-threshold__intention">{selected.intention}</p>

            {/* Resolved, not `selected.prompts` — The Round's movements are the
                writer's own domains and this screen is the only place they see
                which ones they are about to walk. */}
            <div className="practice-threshold__movements-label">
              {selected.dynamic
                ? `${movementsOf(selected).length} domains, in the order they first appeared`
                : `${movementsOf(selected).length} movements`}
            </div>
            <ol className="practice-threshold__movements">
              {movementsOf(selected).map((prompt) => (
                <li key={prompt.label} className="practice-threshold__movement">
                  <span className="practice-threshold__movement-name">{prompt.label}</span>
                  <span className="practice-threshold__movement-q">{prompt.question}</span>
                </li>
              ))}
            </ol>

            {landing && <p className="practice-threshold__landing">{landing}</p>}

            <button
              type="button"
              className="practice-threshold__begin"
              onClick={() => onBegin(selected, movementsOf(selected))}
            >
              Begin writing
            </button>
            <label className="practice-threshold__skip">
              <input
                type="checkbox"
                checked={skipPreview}
                onChange={(e) => onToggleSkipPreview(e.target.checked)}
              />
              Skip this preview next time
            </label>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
