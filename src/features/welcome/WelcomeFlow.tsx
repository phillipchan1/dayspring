import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Welcome.css'

/* ------------------------------------------------------------------ *
 * Dayspring — first-run Welcome flow.
 * Six glassy slides over a living dawn gradient that warms from deep
 * night to gold as you advance. One quiet CSS/SVG motif per slide.
 * Copy lives in the SLIDES block below and is the source of truth.
 * ------------------------------------------------------------------ */

type MotifName = 'sunrise' | 'line' | 'timeline' | 'cairn' | 'lamp' | 'horizon'

export interface Slide {
  key: string
  /** The three-stop gradient this slide warms TO. The arc tweens across slides. */
  bg: [string, string, string]
  eyebrow: string
  /** May contain \n for deliberate line breaks (layout, not copy changes). */
  title: string
  body: string
  motif: MotifName
  final?: boolean
}

/** All Welcome copy in one place for easy editing. Wording is final. */
export const SLIDES: Slide[] = [
  {
    key: 'dawn',
    bg: ['#0c1018', '#121a2a', '#1a2236'],
    eyebrow: 'DAYSPRING',
    title: 'A journal for\nspiritual growth.',
    body: 'Write through your days with God, and watch the long arc of your faith come into view. Dayspring is built for the slow work — the kind you only see when you look back across months and years.',
    motif: 'sunrise',
  },
  {
    key: 'write',
    bg: ['#0e1118', '#171a26', '#241f2c'],
    eyebrow: 'START HERE',
    title: 'It begins with\na blank page.',
    body: "Open a new entry and write — about your day, a prayer, a passage, whatever's on you. It saves as you go. No prompts to answer, no boxes to fill. The writing is the whole practice; everything else is built on top of it.",
    motif: 'line',
  },
  {
    key: 'time',
    bg: ['#10121c', '#1c1d2e', '#2c2433'],
    eyebrow: 'TIME IS THE GIFT',
    title: "What you write today\nbecomes something you'll\none day weep over.",
    body: "Your entries don't scroll away. Dayspring keeps them and brings the right ones back — weekly, monthly, across years — and weaves them into reflections that let you read the throughline of your own life.",
    motif: 'timeline',
  },
  {
    key: 'altar',
    bg: ['#141420', '#241f2a', '#352838'],
    eyebrow: 'THE ALTAR',
    title: 'Not a list of requests.\nA record of where He met you.',
    body: 'The Altar is where your prayers and senses live. The ones you return to grow into stones you can see. When God moves in one, you mark how — answered, redirected, or simply that He met you there. It becomes a record you can revisit.',
    motif: 'cairn',
  },
  {
    key: 'lamp',
    bg: ['#171520', '#2b2230', '#3d2c33'],
    eyebrow: 'THE LAMP',
    title: 'See where your heart\nhas been leaning.',
    body: "Every passage you write about lights up its place in Scripture. Over time the Lamp becomes a map of where you've been dwelling — the books, the verses, the seasons your heart kept returning to.",
    motif: 'lamp',
  },
  {
    key: 'promise',
    bg: ['#1a1620', '#34262e', '#553a35'],
    eyebrow: 'BEFORE YOU BEGIN',
    title: 'Write honestly.\nThe rest takes care\nof itself.',
    body: 'Dayspring surfaces the connections and brings your words back — but it never grades you or tells you what they mean. And your journal is yours: private by default, never sold, and never used to train AI.',
    motif: 'horizon',
    final: true,
  },
]

/** The living dawn gradient for a slide's three-stop palette. */
function bgGradient([c0, c1, c2]: [string, string, string]): string {
  return [
    `radial-gradient(120% 90% at 50% 118%, ${c2}, transparent 60%)`,
    `radial-gradient(140% 100% at 80% -20%, color-mix(in srgb, ${c2} 55%, transparent), transparent 55%)`,
    `linear-gradient(180deg, ${c0}, ${c1})`,
  ].join(',')
}

// ---- per-slide motifs (CSS/SVG only, no raster assets) -----------------
function Motif({ name }: { name: MotifName }) {
  switch (name) {
    case 'sunrise':
      return (
        <svg viewBox="0 0 300 200" className="wf-motif" aria-hidden>
          <defs>
            <radialGradient id="wf-sun" cx="50%" cy="100%" r="80%">
              <stop offset="0%" stopColor="#f4cd8a" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#e8b873" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#e8b873" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="150" cy="200" r="120" fill="url(#wf-sun)" className="wf-m-sun" />
          <circle cx="150" cy="200" r="46" fill="#f4cd8a" opacity="0.9" className="wf-m-core" />
          <line x1="40" y1="200" x2="260" y2="200" stroke="rgba(244,205,138,.4)" strokeWidth="1" />
          {Array.from({ length: 7 }).map((_, i) => (
            <line
              key={i}
              x1="150"
              y1="200"
              x2={150 + Math.cos((Math.PI / 6) * (i - 3) - Math.PI / 2) * 130}
              y2={200 + Math.sin((Math.PI / 6) * (i - 3) - Math.PI / 2) * 130}
              stroke="rgba(244,205,138,.18)"
              strokeWidth="1"
              className="wf-m-ray"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </svg>
      )
    case 'line':
      return (
        <svg viewBox="0 0 300 120" className="wf-motif" aria-hidden>
          <line x1="40" y1="60" x2="260" y2="60" stroke="rgba(232,184,115,.25)" strokeWidth="1" strokeDasharray="2 4" />
          <rect x="40" y="55" width="150" height="2.5" rx="1" fill="#e8b873" className="wf-m-write" />
          <rect
            x="40"
            y="72"
            width="90"
            height="2.5"
            rx="1"
            fill="rgba(232,184,115,.5)"
            className="wf-m-write"
            style={{ animationDelay: '0.5s' }}
          />
          <circle cx="194" cy="56" r="2.5" fill="#f4cd8a" className="wf-m-caret" />
        </svg>
      )
    case 'timeline':
      return (
        <svg viewBox="0 0 300 140" className="wf-motif" aria-hidden>
          <line x1="30" y1="110" x2="270" y2="110" stroke="rgba(150,165,190,.25)" strokeWidth="1" />
          {[60, 110, 160, 210, 250].map((x, i) => (
            <circle
              key={i}
              cx={x}
              cy="110"
              r={i === 4 ? 4 : 2.5}
              fill={i === 4 ? '#e8b873' : 'rgba(150,165,190,.5)'}
              className="wf-m-node"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
          {[60, 110, 160, 210].map((x, i) => (
            <path
              key={i}
              d={`M250 110 Q ${(x + 250) / 2} ${70 - i * 8} ${x} 110`}
              fill="none"
              stroke="url(#wf-tl)"
              strokeWidth="1"
              opacity="0.5"
              className="wf-m-arc"
              style={{ animationDelay: `${0.4 + i * 0.2}s` }}
            />
          ))}
          <defs>
            <linearGradient id="wf-tl" x1="0" x2="1">
              <stop offset="0" stopColor="#e8b873" />
              <stop offset="1" stopColor="rgba(150,165,190,.3)" />
            </linearGradient>
          </defs>
        </svg>
      )
    case 'cairn':
      return (
        <svg viewBox="0 0 200 180" className="wf-motif" aria-hidden>
          <ellipse cx="100" cy="166" rx="46" ry="7" fill="rgba(0,0,0,.35)" />
          {[
            { w: 64, y: 132, fill: '#2a3242', dx: 0 },
            { w: 54, y: 104, fill: '#2d2535', dx: -6 },
            { w: 46, y: 80, fill: '#322a3a', dx: 5 },
            { w: 38, y: 58, fill: '#3a2f3c', dx: -3 },
          ].map((stone, i) => (
            <rect
              key={i}
              x={100 - stone.w / 2 + stone.dx}
              y={stone.y}
              width={stone.w}
              height="26"
              rx="12"
              fill={stone.fill}
              className="wf-m-stone"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
          <ellipse cx="100" cy="46" rx="17" ry="13" fill="#f0c587" className="wf-m-capstone" />
        </svg>
      )
    case 'lamp': {
      const lit = [
        [2, 3], [2, 4], [3, 4], [3, 5], [4, 4], [4, 5], [4, 6], [5, 5], [2, 6], [3, 6], [1, 4],
      ]
      return (
        <svg viewBox="0 0 220 160" className="wf-motif" aria-hidden>
          {Array.from({ length: 7 }).map((_, r) =>
            Array.from({ length: 11 }).map((_, c) => {
              const on = lit.some(([rr, cc]) => rr === r && cc === c)
              return (
                <rect
                  key={`${r}-${c}`}
                  x={20 + c * 17}
                  y={14 + r * 17}
                  width="12"
                  height="12"
                  rx="3"
                  fill={on ? '#e8b873' : 'rgba(150,165,190,.12)'}
                  className={on ? 'wf-m-square lit' : 'wf-m-square'}
                  style={{ animationDelay: `${(r + c) * 0.05}s` }}
                />
              )
            }),
          )}
        </svg>
      )
    }
    case 'horizon':
      return (
        <svg viewBox="0 0 300 160" className="wf-motif" aria-hidden>
          <defs>
            <linearGradient id="wf-hz" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4cd8a" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#e8b873" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="0" y="40" width="300" height="80" fill="url(#wf-hz)" className="wf-m-glow" />
          <line x1="20" y1="120" x2="280" y2="120" stroke="rgba(244,205,138,.5)" strokeWidth="1.5" />
          <circle cx="150" cy="120" r="60" fill="none" stroke="rgba(244,205,138,.18)" strokeWidth="1" className="wf-m-ring" />
          <circle
            cx="150"
            cy="120"
            r="90"
            fill="none"
            stroke="rgba(244,205,138,.1)"
            strokeWidth="1"
            className="wf-m-ring"
            style={{ animationDelay: '0.3s' }}
          />
        </svg>
      )
  }
}

interface WelcomeFlowProps {
  /** Skip / Esc / dismiss without finishing. */
  onClose: () => void
  /** The final "Begin" button. */
  onBegin: () => void
}

/**
 * Self-contained, full-screen overlay. Mounted via portal so it floats above
 * all app chrome. Keyboard: ←/→ navigate, Esc closes. Touch: swipe to navigate.
 */
export function WelcomeFlow({ onClose, onBegin }: WelcomeFlowProps) {
  const [i, setI] = useState(0)
  const slide = SLIDES[i]!
  const isLast = i === SLIDES.length - 1
  const rootRef = useRef<HTMLDivElement>(null)

  // Track the slide we're leaving so the outgoing gradient can fade out over the
  // (already-painted) incoming one — a true cross-tween with no see-through frame.
  const prevIndexRef = useRef(i)
  const prevSlide = SLIDES[prevIndexRef.current]!
  useEffect(() => {
    prevIndexRef.current = i
  }, [i])

  const next = useCallback(() => setI((v) => Math.min(v + 1, SLIDES.length - 1)), [])
  const back = useCallback(() => setI((v) => Math.max(v - 1, 0)), [])

  // Keyboard: arrows navigate, Esc skips. Capture phase so it wins over the
  // app's own global key handlers while the overlay is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [next, back, onClose])

  // Focus trap: move focus into the overlay on mount, keep Tab inside, and
  // restore focus to whatever was focused before on unmount.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    root.focus()

    const onTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    root.addEventListener('keydown', onTrap)
    return () => {
      root.removeEventListener('keydown', onTrap)
      previouslyFocused?.focus?.()
    }
  }, [])

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Touch swipe.
  const txRef = useRef<number | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    txRef.current = e.touches[0]!.clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (txRef.current == null) return
    const dx = e.changedTouches[0]!.clientX - txRef.current
    if (dx < -50) next()
    else if (dx > 50) back()
    txRef.current = null
  }

  return createPortal(
    <div
      ref={rootRef}
      className="welcome-flow"
      style={{ background: bgGradient(slide.bg) }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Dayspring"
      tabIndex={-1}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Outgoing gradient, fading out over the current one painted on the root.
          Keyed so the fade replays on each slide change; never leaves a gap. */}
      <div
        className="welcome-flow__bg"
        key={slide.key}
        style={{ background: bgGradient(prevSlide.bg) }}
        aria-hidden
      />
      <div className="welcome-flow__grain" aria-hidden />

      {/* aria-live announcer for slide changes */}
      <div className="welcome-flow__sr" aria-live="polite">
        {`Slide ${i + 1} of ${SLIDES.length}. ${slide.eyebrow}. ${slide.title.replace(/\n/g, ' ')}`}
      </div>

      <button type="button" className="welcome-flow__skip" onClick={onClose}>
        Skip
      </button>

      <div className="welcome-flow__stage">
        <div className="welcome-flow__glass" key={slide.key}>
          <div className="welcome-flow__glow" aria-hidden />
          <div className="welcome-flow__motif-wrap">
            <Motif name={slide.motif} />
          </div>
          <span className="welcome-flow__eyebrow">{slide.eyebrow}</span>
          <h1 className="welcome-flow__title">
            {slide.title.split('\n').map((lineText, k) => (
              <span key={k}>
                {lineText}
                <br />
              </span>
            ))}
          </h1>
          <p className="welcome-flow__body">{slide.body}</p>
        </div>
      </div>

      <div className="welcome-flow__nav">
        <button
          type="button"
          className="welcome-flow__ghost"
          onClick={back}
          aria-label="Previous"
          style={{ opacity: i === 0 ? 0 : 1, pointerEvents: i === 0 ? 'none' : 'auto' }}
          tabIndex={i === 0 ? -1 : 0}
        >
          Back
        </button>

        <div className="welcome-flow__dots" role="tablist" aria-label="Slides">
          {SLIDES.map((s, k) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`Go to slide ${k + 1}`}
              className={`welcome-flow__dot${k === i ? ' on' : ''}${k < i ? ' past' : ''}`}
              onClick={() => setI(k)}
            />
          ))}
        </div>

        {isLast ? (
          <button type="button" className="welcome-flow__begin" onClick={onBegin}>
            Begin
          </button>
        ) : (
          <button type="button" className="welcome-flow__next" onClick={next}>
            Next
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
