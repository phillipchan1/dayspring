import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useIsMobile, useMediaQuery } from '@/hooks/useMediaQuery'
import { listRollups, type Rollup, type RollupPayload, type RollupType } from '@/lib/insights'
import { deriveTitle, humanizeObservationText } from '@/lib/entryLabels'
import paintingUrl from '@/assets/looking-back.jpg'

/* ════════════════════════════════════════════════════════════════════════ */
/* Tuning constants — everything you'd reach for first lives here.           */
/* ════════════════════════════════════════════════════════════════════════ */

/**
 * The single tall landscape behind everything. One image, one moving camera —
 * never a crossfade. Swap the hi-res file here (one line) when it lands.
 * Intrinsic size is needed to compute the camera math (see cameraTransform).
 */
const PAINTING = { url: paintingUrl, width: 1024, height: 4128 }

/**
 * Four camera presets over the one image. `scale` zooms; `focus` is the
 * vertical fraction of the image that should sit at screen center
 * (0 = top / mountains + dawn, 1 = bottom / forest floor).
 *
 * The wide scale spread (≈2.7→1.05) is deliberate: moving toward "year" should
 * read as *zooming out to take in the view*, not just panning up. Tune freely —
 * especially how tightly "week" frames the forest floor.
 *
 * `type` maps the horizon to a server rollup. quarter has no rollup type yet,
 * and yearly isn't generated yet — both fall back to a graceful empty state.
 */
type HorizonKey = 'week' | 'month' | 'quarter' | 'year'

interface Horizon {
  key: HorizonKey
  label: string
  type: RollupType | null
  scale: number
  focus: number
  /** Veil opacity at this altitude — lightens slightly as you climb. */
  veil: number
  /** Small uppercase prefix; the real period is appended when data loads. */
  kicker: string
  /** Editorial framing — the invitation. The grounded answer comes from data. */
  title: string
  /** Shown when there's no rollup for this horizon yet. */
  emptyHint: string
  /** Used as the left-ruled line only when no verbatim quote is available. */
  question: string
}

const HORIZONS: Horizon[] = [
  {
    key: 'week',
    label: 'Week',
    type: 'weekly',
    kicker: 'this week',
    scale: 2.7,
    focus: 0.94,
    veil: 0.8,
    title: 'What’s still alive in you?',
    emptyHint: 'Your first weekly reflection is still gathering — keep writing.',
    question: 'What from this week do you want to carry into the next?',
  },
  {
    key: 'month',
    label: 'Month',
    type: 'monthly',
    kicker: 'last month',
    scale: 2.0,
    focus: 0.66,
    veil: 0.78,
    title: 'Here’s what changed in you.',
    emptyHint: 'A month’s arc unlocks after a few weeks of writing.',
    question: 'Where did you grow without noticing?',
  },
  {
    key: 'quarter',
    label: 'Quarter',
    type: null,
    kicker: 'this quarter',
    scale: 1.45,
    focus: 0.36,
    veil: 0.74,
    title: 'The arc you can’t see from inside a week.',
    emptyHint: 'A season’s view composes as the months add up.',
    question: 'If this quarter were a chapter, what would you title it?',
  },
  {
    key: 'year',
    label: 'Year',
    type: 'yearly',
    kicker: 'this year',
    scale: 1.05,
    focus: 0.07,
    veil: 0.68,
    title: 'Who you were a year ago — and who you are now.',
    emptyHint: 'Your year-in-review composes as the months add up.',
    question: 'What would the you of a year ago be surprised to find true today?',
  },
]

/**
 * Camera move — slow and unhurried. Land between 2.4s and 4.6s once felt.
 * NB: a smooth, symmetric ease-in-out is what makes the move *read* as slow.
 * Front-loaded curves (e.g. a 2nd control point near x=0.15,y=1) finish ~all
 * the visible motion in the first ~20% of the duration, so the camera looks
 * fast no matter how long the duration is. Keep the easing even.
 */
const CAMERA_DURATION_MS = 4200
const CAMERA_EASING = 'cubic-bezier(.42, 0, .58, 1)'

/** Text crossfades on its own timing so it never smears mid-camera-move. */
const TEXT_FADE_MS = 750

/* ────────────────────────────────────────────────────────────────────────
 * Why text + veil colors are NOT theme tokens (a deliberate decision):
 * The painting is fixed warm-daylight art and is always bright. A warm
 * off-white veil over it reads best at every horizon, so the veil stays
 * parchment and the text stays warm ink regardless of the app theme — that
 * guarantees legibility over the art. (Per the build spec's allowance to make
 * this a deliberate, commented choice rather than letting text go invisible
 * on a dark theme.) These are CSS vars on .looking-back so they stay tunable.
 * ──────────────────────────────────────────────────────────────────────── */

/* ════════════════════════════════════════════════════════════════════════ */
/* Grounded content — derived from the server rollups (insights table).      */
/* ════════════════════════════════════════════════════════════════════════ */

interface FeaturedQuote {
  entryId: string
  date: string
  text: string
}

interface HorizonContent {
  state: 'loading' | 'ready' | 'empty'
  /** Real period label, e.g. "May 18 – 24" or "May 2026". Empty while loading. */
  period: string
  /** The grounded observation (humanized) or a facts sentence. */
  body: string
  /** One verbatim line in your own words, set off with the accent rule. */
  quote: FeaturedQuote | null
}

function fmtDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function periodLabel(rollup: Rollup): string {
  const { type, period_start, period_end } = rollup
  if (type === 'monthly') {
    return new Date(`${period_start}T00:00:00Z`).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  if (type === 'yearly') {
    return String(new Date(`${period_start}T00:00:00Z`).getUTCFullYear())
  }
  return `${fmtDay(period_start)} – ${fmtDay(period_end)}`
}

/** Readable cite map for observation prose when the server didn't supply one. */
function fallbackLabels(quotes: RollupPayload['quotes']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const q of quotes) {
    out[q.entry_id] = `${deriveTitle(q.text) || 'Untitled'} (${fmtDay(q.date)})`
  }
  return out
}

/** When there's no AI observation, say something true from the numbers alone. */
function factsSentence(f: RollupPayload['facts']): string {
  const days = `${f.days_written} of ${f.days_in_period} ${f.days_in_period === 1 ? 'day' : 'days'}`
  return `You showed up on ${days}, ${f.words.toLocaleString()} words in all — enough to leave a trace worth reading back.`
}

function deriveContent(rollup: Rollup | null | undefined): HorizonContent {
  if (rollup === undefined) return { state: 'loading', period: '', body: '', quote: null }
  if (rollup === null) return { state: 'empty', period: '', body: '', quote: null }

  const p = rollup.payload
  const labels = p.entry_labels ?? fallbackLabels(p.quotes)
  const body = p.observation?.text.trim()
    ? humanizeObservationText(p.observation.text, labels)
    : factsSentence(p.facts)
  const q = p.quotes[0]
  return {
    state: 'ready',
    period: periodLabel(rollup),
    body,
    quote: q ? { entryId: q.entry_id, date: q.date, text: q.text } : null,
  }
}

interface Props {
  /** Back to the writing surface — the one bit of chrome besides the pill. */
  onBack: () => void
  /** Open one entry in the journal reader (from a verbatim quote). */
  onOpenEntry?: (entryId: string) => void
}

/**
 * Compute the image layer's transform for a given camera preset.
 *
 * The image is laid out at full container width, transform-origin center top,
 * so a point at vertical fraction `f` sits (before transform) at f·H from the
 * top, where H is the rendered (layout) height. Scaling about the top and then
 * translating gives screen_y = translateY + f·H·scale. We want the focus point
 * at screen center, so translateY = centerY − focus·H·scale.
 */
function cameraTransform(h: Horizon, containerW: number, containerH: number): string {
  const renderedHeight = containerW * (PAINTING.height / PAINTING.width)
  const ideal = containerH / 2 - h.focus * renderedHeight * h.scale
  // Coverage guard: never reveal past the image edges (e.g. a flat gap above
  // the dawn at "year" on wide viewports). Clamp keeps the painting filling the
  // screen; within the normal range the specced focus math is untouched.
  const scaledHeight = renderedHeight * h.scale
  const translateY = Math.min(0, Math.max(containerH - scaledHeight, ideal))
  return `translateY(${translateY}px) scale(${h.scale})`
}

export function LookingBack({ onBack, onOpenEntry }: Props) {
  const isMobile = useIsMobile()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const rootRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  // The first camera position must apply instantly; only later horizon changes
  // tween. Without this the image animates from its un-transformed top (clouds)
  // down to the opening preset on every mount — an unwanted intro fly-in.
  const [cameraReady, setCameraReady] = useState(false)

  // Latest rollup per type (undefined = still loading, null = none exists).
  const [rollups, setRollups] = useState<Record<RollupType, Rollup | null | undefined>>({
    weekly: undefined,
    monthly: undefined,
    yearly: undefined,
  })

  // Active horizon = where the camera is headed. `shown` lags it so the text
  // can fade out, swap, and fade back in without smearing mid-move.
  const [activeIndex, setActiveIndex] = useState(0)
  const [shownIndex, setShownIndex] = useState(0)
  const [textVisible, setTextVisible] = useState(true)

  // Pull the grounded rollups. Each resolves independently; a missing table or
  // an ungenerated type just leaves that horizon in its empty state.
  useEffect(() => {
    let cancelled = false
    const load = (type: RollupType) =>
      listRollups(type)
        .then((list) => {
          if (!cancelled) setRollups((prev) => ({ ...prev, [type]: list[0] ?? null }))
        })
        .catch(() => {
          if (!cancelled) setRollups((prev) => ({ ...prev, [type]: null }))
        })
    void load('weekly')
    void load('monthly')
    void load('yearly')
    return () => {
      cancelled = true
    }
  }, [])

  // Measure the container so the camera math has real pixels to work with.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Enable camera transitions only after the opening preset has painted once.
  useEffect(() => {
    if (size.w === 0 || cameraReady) return
    const id = requestAnimationFrame(() => setCameraReady(true))
    return () => cancelAnimationFrame(id)
  }, [size.w, cameraReady])

  // Crossfade the text when the horizon changes (instant swap if reduced motion).
  useEffect(() => {
    if (activeIndex === shownIndex) return
    if (reduceMotion) {
      setShownIndex(activeIndex)
      return
    }
    setTextVisible(false)
    const t = setTimeout(() => {
      setShownIndex(activeIndex)
      setTextVisible(true)
    }, TEXT_FADE_MS)
    return () => clearTimeout(t)
  }, [activeIndex, shownIndex, reduceMotion])

  const active = HORIZONS[activeIndex]!
  const shown = HORIZONS[shownIndex]!
  const content = deriveContent(shown.type ? rollups[shown.type] : null)

  const transform = size.w > 0 ? cameraTransform(active, size.w, size.h) : undefined

  return (
    <div className="looking-back" ref={rootRef} data-horizon={active.key}>
      {/* Camera layer — one image, animated transform only (slide + zoom-out). */}
      <div
        className="looking-back__sky"
        aria-hidden
        style={{
          backgroundImage: `url(${PAINTING.url})`,
          transform,
          transition:
            reduceMotion || !cameraReady
              ? 'none'
              : `transform ${CAMERA_DURATION_MS}ms ${CAMERA_EASING}`,
        }}
      />

      {/* Warm veil for legibility — opacity lightens as altitude increases. */}
      <div
        className="looking-back__veil"
        aria-hidden
        style={{
          opacity: active.veil,
          transition:
            reduceMotion || !cameraReady
              ? 'none'
              : `opacity ${CAMERA_DURATION_MS}ms ${CAMERA_EASING}`,
        }}
      />

      {/* The only persistent chrome: a back affordance + the horizon pill. */}
      <button className="looking-back__back" onClick={onBack} aria-label="Back to writing">
        ←
      </button>

      <nav className="looking-back__pill" aria-label="Reflection horizon">
        {HORIZONS.map((h, i) => (
          <button
            key={h.key}
            className={`looking-back__seg${i === activeIndex ? ' is-active' : ''}`}
            aria-pressed={i === activeIndex}
            onClick={() => setActiveIndex(i)}
          >
            {h.label}
          </button>
        ))}
      </nav>

      {/* Free-floating serif text — no cards, no boxes. Crossfades on its own. */}
      <div className={`looking-back__stage${isMobile ? ' is-mobile' : ''}`}>
        <article
          className={`looking-back__text${textVisible ? ' is-visible' : ''}`}
          style={{ transition: reduceMotion ? 'none' : `opacity ${TEXT_FADE_MS}ms ease` }}
        >
          <p className="looking-back__kicker">
            {content.period ? `${shown.kicker} · ${content.period}` : shown.kicker}
          </p>
          <h1 className="looking-back__title">{shown.title}</h1>

          {content.state === 'loading' && (
            <p className="looking-back__body looking-back__body--muted">Gathering your reflection…</p>
          )}

          {content.state === 'empty' && (
            <p className="looking-back__body looking-back__body--muted">{shown.emptyHint}</p>
          )}

          {content.state === 'ready' && (
            <>
              <p className="looking-back__body">{content.body}</p>
              {content.quote ? (
                <blockquote className="looking-back__quote">
                  <p className="looking-back__quote-text">“{content.quote.text}”</p>
                  <footer className="looking-back__quote-meta">
                    {fmtDay(content.quote.date)}
                    {onOpenEntry && (
                      <button
                        type="button"
                        className="looking-back__quote-open"
                        onClick={() => onOpenEntry(content.quote!.entryId)}
                      >
                        → open entry
                      </button>
                    )}
                  </footer>
                </blockquote>
              ) : (
                <p className="looking-back__question">{shown.question}</p>
              )}
            </>
          )}
        </article>
      </div>
    </div>
  )
}
