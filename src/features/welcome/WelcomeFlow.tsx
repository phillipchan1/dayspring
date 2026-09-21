import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SpiritualBlockIcon } from '@/editor/spiritualBlockIcons'
import { IconAltar, IconAscent, IconPages, IconRitual, IconScripture } from '@/features/journal/navIcons'
import './Welcome.css'

/* ------------------------------------------------------------------ *
 * Dayspring — first-run Welcome flow.
 * Seven glassy slides over a living dawn gradient that warms from deep
 * night to gold as you advance. One quiet CSS/SVG motif per slide.
 * Copy lives in the SLIDES block below and is the source of truth.
 * ------------------------------------------------------------------ */

type MotifName = 'sunrise' | 'insert' | 'door' | 'wall' | 'ascent' | 'carry' | 'horizon'

type HintIcon = 'plus' | 'ritual' | 'journal' | 'ascent' | 'lamp' | 'altar'

/** One "where to find it" chip: the real control's icon and/or key, then words. */
interface Hint {
  icon?: HintIcon
  kbd?: string
  text: string
}

export interface Slide {
  key: string
  /** Dark-mode three-stop gradient this slide warms TO. The arc tweens across slides. */
  bg: [string, string, string]
  /** Light-mode counterpart — a pale dawn warming to gold across the same arc. */
  bgLight: [string, string, string]
  eyebrow: string
  /** May contain \n for deliberate line breaks (layout, not copy changes). */
  title: string
  body: string
  motif: MotifName
  /**
   * Where the thing on this slide actually lives — the rail item, the key, the
   * button. Touch gets its own list because the doors differ: a phone has a
   * tab bar and a bar above the keyboard, not a sidebar and ⌘-keys.
   */
  find?: { desktop: Hint[]; touch: Hint[] }
  final?: boolean
}

/**
 * All Welcome copy in one place for easy editing. The order is the app's own
 * rail — the one Write act, then the Return surfaces — so the tour is a map of
 * where things actually are. Rewritten Sept 2026 for Pages (D-025), the `+`
 * (D-026) and rituals; when a surface is added or renamed, this list goes stale.
 */
export const SLIDES: Slide[] = [
  {
    key: 'dawn',
    bg: ['#0c1018', '#121a2a', '#1a2236'],
    bgLight: ['#f4f7fb', '#eef1f7', '#dde6f2'],
    eyebrow: 'DAYSPRING',
    title: 'A journal for\nspiritual growth.',
    body: 'Write through your days with God, and watch the long arc of your faith come into view.',
    motif: 'sunrise',
  },
  {
    key: 'write',
    bg: ['#0e1118', '#171a26', '#241f2c'],
    bgLight: ['#f5f5f9', '#eeeef4', '#e3e2ee'],
    eyebrow: 'THE PAGE',
    title: 'A blank page,\nand everything within reach.',
    body: 'Write, and it saves as you go. Type / for everything else — a heading, a highlighter, a verse, a prayer.',
    motif: 'insert',
    find: {
      desktop: [
        { kbd: '/', text: 'type it as you write' },
        { icon: 'plus', text: 'or the + beside any line' },
      ],
      touch: [
        { kbd: '/', text: 'type it as you write' },
        { text: 'or the bar above your keyboard' },
      ],
    },
  },
  {
    key: 'rituals',
    bg: ['#0f1119', '#1a1c2a', '#28222f'],
    bgLight: ['#f6f5f8', '#efedf3', '#e6e0ed'],
    eyebrow: 'RITUALS',
    title: 'When you’d rather\nnot start from nothing.',
    body: 'Old forms of the praying church — the Examen, Lectio Divina, and more. Each opens as its own page, one quiet question at a time.',
    motif: 'door',
    find: {
      desktop: [
        { icon: 'ritual', text: 'at the foot of any blank page' },
        { kbd: '/ritual', text: 'or type it' },
      ],
      touch: [
        { icon: 'ritual', text: 'at the foot of any blank page' },
        { text: 'or Ritual, above your keyboard' },
      ],
    },
  },
  {
    key: 'pages',
    bg: ['#10121c', '#1c1d2e', '#2c2433'],
    bgLight: ['#f7f4f8', '#f0ebf2', '#e9deec'],
    eyebrow: 'YOUR JOURNAL',
    title: 'Everything you’ve written,\nand a way back to it.',
    body: 'Every entry, laid out as a page. Zoom out to see your years, or look for a person or your prayers to see just those.',
    motif: 'wall',
    find: {
      desktop: [{ icon: 'journal', kbd: '⌘2', text: 'Journal, in the sidebar' }],
      touch: [{ icon: 'journal', text: 'Journal, in the tab bar' }],
    },
  },
  {
    key: 'ascent',
    bg: ['#141420', '#241f2a', '#352838'],
    bgLight: ['#f9f4f4', '#f2eaec', '#efdde2'],
    eyebrow: 'THE ASCENT',
    title: "What you write today\nbecomes something you'll\none day weep over.",
    body: 'Your own words, seen from the week, the month, the season and the year. The higher you climb, the less it says.',
    motif: 'ascent',
    find: {
      desktop: [{ icon: 'ascent', kbd: '⌘3', text: 'Ascent, in the sidebar' }],
      touch: [{ icon: 'ascent', text: 'Ascent, in the tab bar' }],
    },
  },
  {
    key: 'carry',
    bg: ['#171520', '#2b2230', '#3d2c33'],
    bgLight: ['#fbf5ef', '#f5eae2', '#f2ddca'],
    eyebrow: 'THE LAMP & THE ALTAR',
    title: 'Where your heart leaned.\nWhere He met you.',
    body: 'The Lamp lights every passage you’ve written about. The Altar gathers your prayers, and the places God met you in them.',
    motif: 'carry',
    find: {
      desktop: [
        { icon: 'lamp', kbd: '⌘4', text: 'Lamp' },
        { icon: 'altar', kbd: '⌘5', text: 'Altar' },
      ],
      touch: [
        { icon: 'lamp', text: 'Lamp' },
        { icon: 'altar', text: 'Altar — both in the tab bar' },
      ],
    },
  },
  {
    key: 'promise',
    bg: ['#1a1620', '#34262e', '#553a35'],
    bgLight: ['#fdf8ee', '#f9efdb', '#f5dcab'],
    eyebrow: 'BEFORE YOU BEGIN',
    title: 'Write honestly.\nThe rest takes care\nof itself.',
    body: 'Dayspring never grades you or tells you what your words mean. Your journal is private, never sold, and never used to train AI.',
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
        <svg viewBox="0 0 300 200" className="wf-motif wf-motif--sunrise" aria-hidden>
          <defs>
            <radialGradient id="wf-sun" cx="50%" cy="100%" r="80%">
              <stop offset="0%" stopColor="#f4cd8a" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#e8b873" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#e8b873" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="150" cy="200" r="120" fill="url(#wf-sun)" className="wf-m-sun" />
          <circle cx="150" cy="200" r="46" fill="#f4cd8a" opacity="0.9" className="wf-m-core" />
          <line x1="40" y1="200" x2="260" y2="200" stroke="rgba(244,205,138,.4)" strokeWidth="1" className="wf-sun-base" />
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
    // The two doors a writer has to be SHOWN, not told about: drawn as the
    // real controls (the gutter +, the palette's own icons, the Ritual pill)
    // so the first time they meet them in the app, they've seen them before.
    case 'insert':
      return (
        <div className="wf-demo wf-demo--slash" aria-hidden>
          <div className="wf-demo__line wf-demo__line--dim">Sat with Psalm 27 again this morning.</div>
          <div className="wf-demo__line">
            <span className="wf-demo__plus wf-demo__plus--quiet">+</span>
            Lord, teach me to wait <span className="wf-demo__slash">/</span>
          </div>
          {/* The real palette's two columns, a few rows of each. */}
          <div className="wf-demo__menu wf-demo__menu--palette">
            <div className="wf-demo__col">
              <div className="wf-demo__head">Format</div>
              <div className="wf-demo__item">
                <span className="wf-demo__badge">#</span>Heading
              </div>
              <div className="wf-demo__item">
                <span className="wf-demo__badge wf-demo__badge--bold">B</span>Bold
              </div>
              <div className="wf-demo__item">
                <span className="wf-demo__badge wf-demo__badge--italic">I</span>Italic
              </div>
              <div className="wf-demo__item">
                <span className="wf-demo__badge">▮</span>
                <span className="wf-demo__wash">Highlight</span>
              </div>
            </div>
            <div className="wf-demo__col">
              <div className="wf-demo__head">Capture</div>
              <div className="wf-demo__item">
                <SpiritualBlockIcon id="scripture" />
                Scripture
              </div>
              <div className="wf-demo__item wf-demo__item--on">
                <SpiritualBlockIcon id="pray" />
                Prayer
              </div>
              <div className="wf-demo__item">
                <SpiritualBlockIcon id="sense" />
                Sense
              </div>
              <div className="wf-demo__item">
                <SpiritualBlockIcon id="ritual" />
                Ritual
              </div>
            </div>
          </div>
        </div>
      )
    case 'door':
      // The shelf at the foot of a blank page (RitualShelf): the page itself
      // stays empty; three practices for the hour wait below it.
      return (
        <div className="wf-demo wf-demo--door" aria-hidden>
          <div className="wf-demo__line wf-demo__line--dim">What’s stirring in you today?</div>
          <div className="wf-demo__shelf">
            <span className="wf-demo__shelf-lead">Or begin with a ritual</span>
            <span className="wf-demo__shelf-pick wf-demo__shelf-pick--on">The Daily Examen</span>
            <span className="wf-demo__shelf-pick">Lectio Divina</span>
            <span className="wf-demo__shelf-pick">Wesley’s Questions</span>
            <span className="wf-demo__shelf-all">All rituals →</span>
          </div>
        </div>
      )
    case 'wall': {
      // Four of eighteen pages answer the "look for" — the rest stay, dimmer.
      const found = new Set([3, 8, 10, 15])
      return (
        <svg viewBox="0 0 250 150" className="wf-motif wf-motif--wall" aria-hidden>
          {Array.from({ length: 18 }).map((_, k) => {
            const r = Math.floor(k / 6)
            const c = k % 6
            const x = 14 + c * 38
            const y = 8 + r * 47
            const on = found.has(k)
            return (
              <g
                key={k}
                className={on ? 'wf-m-page lit' : 'wf-m-page'}
                style={{ animationDelay: `${(r + c) * 0.06}s` }}
              >
                <rect x={x} y={y} width="30" height="40" rx="3" className="wf-m-page__leaf" />
                <rect x={x + 6} y={y + 9} width="18" height="1.6" rx="0.8" className="wf-m-page__text" />
                <rect x={x + 6} y={y + 15} width="14" height="1.6" rx="0.8" className="wf-m-page__text" />
                <rect x={x + 6} y={y + 21} width="16" height="1.6" rx="0.8" className="wf-m-page__text" />
              </g>
            )
          })}
        </svg>
      )
    }
    case 'ascent':
      return (
        <svg viewBox="0 50 300 100" className="wf-motif wf-motif--ascent" aria-hidden>
          {/* Valley, Hillside, Ridge, Summit — one terrain, four heights. */}
          {[
            'M20 140H280',
            'M40 140Q150 100 260 140',
            'M70 140Q150 52 230 140',
            'M100 140Q150 -4 200 140',
          ].map((d, k) => (
            <path
              key={k}
              d={d}
              fill="none"
              stroke="#e8b873"
              strokeWidth="1.2"
              strokeOpacity={0.22 + k * 0.18}
              className="wf-m-contour"
              style={{ animationDelay: `${0.2 + k * 0.25}s` }}
            />
          ))}
          <circle cx="150" cy="68" r="4" fill="#f4cd8a" className="wf-m-summit" />
        </svg>
      )
    case 'carry': {
      const lit = [
        [1, 1], [1, 2], [2, 2], [2, 3], [3, 2], [0, 4], [3, 4],
      ]
      return (
        <svg viewBox="0 30 232 130" className="wf-motif wf-motif--carry" aria-hidden>
          {Array.from({ length: 5 }).map((_, r) =>
            Array.from({ length: 6 }).map((_, c) => {
              const on = lit.some(([rr, cc]) => rr === r && cc === c)
              return (
                <rect
                  key={`${r}-${c}`}
                  x={8 + c * 17}
                  y={38 + r * 17}
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
          <ellipse cx="190" cy="150" rx="34" ry="5" fill="rgba(0,0,0,.35)" className="wf-cairn-shadow" />
          {[
            { w: 48, y: 124, fill: '#3a4356', dx: 0 },
            { w: 40, y: 103, fill: '#3e3549', dx: -4 },
            { w: 34, y: 85, fill: '#453b4d', dx: 4 },
            { w: 28, y: 69, fill: '#4d404f', dx: -2 },
          ].map((stone, k) => (
            <rect
              key={k}
              x={190 - stone.w / 2 + stone.dx}
              y={stone.y}
              width={stone.w}
              height="20"
              rx="9"
              fill={stone.fill}
              className="wf-m-stone"
              style={{ animationDelay: `${0.3 + k * 0.15}s` }}
            />
          ))}
          <ellipse cx="190" cy="60" rx="13" ry="10" fill="#f0c587" className="wf-m-capstone" />
        </svg>
      )
    }
    case 'horizon':
      return (
        <svg viewBox="0 0 300 160" className="wf-motif wf-motif--horizon" aria-hidden>
          <defs>
            <linearGradient id="wf-hz" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4cd8a" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#e8b873" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="0" y="40" width="300" height="80" fill="url(#wf-hz)" className="wf-m-glow" />
          <line x1="20" y1="120" x2="280" y2="120" stroke="rgba(244,205,138,.5)" strokeWidth="1.5" className="wf-hz-line" />
          <circle cx="150" cy="120" r="60" fill="none" stroke="rgba(244,205,138,.18)" strokeWidth="1" className="wf-m-ring" />
          <circle
            cx="150"
            cy="120"
            r="90"
            fill="none"
            stroke="rgba(244,205,138,.1)"
            strokeWidth="1"
            className="wf-m-ring wf-m-ring--faint"
            style={{ animationDelay: '0.3s' }}
          />
        </svg>
      )
  }
}

function HintGlyph({ icon }: { icon: HintIcon }): ReactNode {
  switch (icon) {
    case 'plus':
      return <span className="wf-hint__plus">+</span>
    case 'ritual':
      return <IconRitual size={15} />
    case 'journal':
      return <IconPages size={15} />
    case 'ascent':
      return <IconAscent size={15} />
    case 'lamp':
      return <IconScripture size={15} />
    case 'altar':
      return <IconAltar size={15} />
  }
}

function FindIt({ hints }: { hints: Hint[] }) {
  return (
    <ul className="welcome-flow__find" aria-label="Where to find it">
      {hints.map((h) => (
        <li className="wf-hint" key={`${h.icon ?? ''}${h.kbd ?? ''}${h.text}`}>
          {h.icon ? (
            <span className="wf-hint__icon">
              <HintGlyph icon={h.icon} />
            </span>
          ) : null}
          {h.kbd ? <kbd className="wf-hint__kbd">{h.kbd}</kbd> : null}
          <span>{h.text}</span>
        </li>
      ))}
    </ul>
  )
}

interface WelcomeFlowProps {
  /** Skip / Esc / dismiss without finishing. */
  onClose: () => void
  /** The final "Begin" button. */
  onBegin: () => void
  /** Render the light-mode palette (the app's Dawn theme). */
  isLight?: boolean
  /** Flip between light and dark (sets the app's appearance). Hides the toggle if omitted. */
  onToggleTheme?: () => void
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 14.3A8 8 0 1 1 9.7 4a6.3 6.3 0 0 0 10.3 10.3Z" />
    </svg>
  )
}

/**
 * Self-contained, full-screen overlay. Mounted via portal so it floats above
 * all app chrome. Keyboard: ←/→ navigate, Esc closes. Touch: swipe to navigate.
 */
export function WelcomeFlow({ onClose, onBegin, isLight = false, onToggleTheme }: WelcomeFlowProps) {
  const [i, setI] = useState(0)
  const slide = SLIDES[i]!
  const palette = (s: Slide) => (isLight ? s.bgLight : s.bg)
  const isLast = i === SLIDES.length - 1
  // Which doors to point at. Coarse pointer = a phone/tablet, where the doors
  // are the tab bar and the bar above the keyboard.
  const isTouch = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches,
    [],
  )
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

  // Graceful exit: instead of vanishing, the panel dissolves into the light and
  // the overlay cross-fades out to hand off to the app. We stay mounted through
  // the animation, then fire the real callback. `leaving` records the intent.
  const [leaving, setLeaving] = useState<null | 'begin' | 'close'>(null)
  const requestExit = useCallback((reason: 'begin' | 'close') => {
    setLeaving((prev) => prev ?? reason)
  }, [])

  useEffect(() => {
    if (!leaving) return
    // Slightly longer than the CSS exit (700ms) so it always finishes first.
    const t = window.setTimeout(() => (leaving === 'begin' ? onBegin() : onClose()), 760)
    return () => window.clearTimeout(t)
  }, [leaving, onBegin, onClose])

  // Keyboard: arrows navigate, Esc skips. Capture phase so it wins over the
  // app's own global key handlers while the overlay is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (leaving) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        requestExit('close')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [next, back, requestExit, leaving])

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
    if (txRef.current == null || leaving) return
    const dx = e.changedTouches[0]!.clientX - txRef.current
    if (dx < -50) next()
    else if (dx > 50) back()
    txRef.current = null
  }

  return createPortal(
    <div
      ref={rootRef}
      className={`welcome-flow${isLight ? ' welcome-flow--light' : ''}${leaving ? ' welcome-flow--leaving' : ''}`}
      style={{ background: bgGradient(palette(slide)) }}
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
        style={{ background: bgGradient(palette(prevSlide)) }}
        aria-hidden
      />
      <div className="welcome-flow__grain" aria-hidden />

      {/* aria-live announcer for slide changes */}
      <div className="welcome-flow__sr" aria-live="polite">
        {`Slide ${i + 1} of ${SLIDES.length}. ${slide.eyebrow}. ${slide.title.replace(/\n/g, ' ')}`}
      </div>

      {onToggleTheme && (
        <div className="welcome-flow__theme" role="group" aria-label="Appearance">
          <span className="welcome-flow__theme-pill" data-light={isLight} aria-hidden />
          <button
            type="button"
            className="welcome-flow__theme-opt"
            data-active={!isLight}
            aria-pressed={!isLight}
            aria-label="Dark"
            onClick={() => {
              if (isLight) onToggleTheme()
            }}
          >
            <IconMoon />
          </button>
          <button
            type="button"
            className="welcome-flow__theme-opt"
            data-active={isLight}
            aria-pressed={isLight}
            aria-label="Light"
            onClick={() => {
              if (!isLight) onToggleTheme()
            }}
          >
            <IconSun />
          </button>
        </div>
      )}

      <button type="button" className="welcome-flow__skip" onClick={() => requestExit('close')}>
        Skip
      </button>

      <div className="welcome-flow__stage">
        <div className="welcome-flow__glass" key={slide.key}>
          <div className="welcome-flow__glow" aria-hidden />
          <div
            className={`welcome-flow__motif-wrap${
              slide.motif === 'insert' || slide.motif === 'door' ? ' welcome-flow__motif-wrap--demo' : ''
            }`}
          >
            <Motif name={slide.motif} />
          </div>
          <div className="welcome-flow__copy">
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
          {slide.find ? <FindIt hints={isTouch ? slide.find.touch : slide.find.desktop} /> : null}
          </div>
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
          <button type="button" className="welcome-flow__begin" onClick={() => requestExit('begin')}>
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
