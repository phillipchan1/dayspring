import { EMPTY_COPY, SUMMIT_COPY } from './ascent.config'
import type { SummitData } from './summitData'
import { Wrapped } from './Wrapped'

interface Props {
  data: SummitData | null
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/**
 * SUMMIT (year) — the forming mountain. It GESTATES in the open: solid rock rises
 * only as high as the year has been lived, dawn-glow climbs with it, a faint seed
 * pulses at the unreached peak. Never gated, never a countdown. The content is
 * the user's own marks, returned; the app stays near-silent.
 */
export function Summit({ data, onOpenEntry }: Props) {
  if (!data) {
    return <p className="ascent-empty">{EMPTY_COPY.year.empty}</p>
  }

  const pct = Math.min(1, data.monthsDone / data.total)
  const W = 600
  const H = 300
  const groundY = 270
  const climb = 230 // peak rise span
  const solidH = pct * climb
  const lineY = groundY - solidH

  return (
    <div className="ascent-summit">
      <svg viewBox={`0 0 ${W} ${H}`} className="ascent-mountain" role="img"
        aria-label={`The year ${data.year}, forming — ${data.monthsDone} of ${data.total} months written`}>
        <defs>
          <linearGradient id="ascent-rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ascent-rock-top)" />
            <stop offset="100%" stopColor="var(--ascent-rock-bottom)" />
          </linearGradient>
          <linearGradient id="ascent-dawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0c587" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#e8b873" stopOpacity="0" />
          </linearGradient>
          <clipPath id="ascent-pk">
            <polygon points="300,30 560,270 40,270" />
          </clipPath>
        </defs>

        {/* dawn band climbs only as high as the year has climbed */}
        <rect x="0" y={groundY - pct * climb} width={W} height={pct * climb + 30}
          fill="url(#ascent-dawn)" className="ascent-dawn-band" />
        {/* faint full peak — the mountain it will become */}
        <polygon points="300,30 560,270 40,270" fill="url(#ascent-rock)" opacity={data.complete ? 1 : 0.4} />

        <g clipPath="url(#ascent-pk)">
          {/* solid land — height IS the progress (poetic, not a ring) */}
          <rect x="0" y={groundY - solidH} width={W} height={solidH} fill="url(#ascent-rock)" className="ascent-solid-land" />
          {!data.complete ? (
            <line x1="0" y1={lineY} x2={W} y2={lineY} stroke="rgba(232,184,115,.4)" strokeWidth="1" strokeDasharray="3 5" />
          ) : null}
        </g>

        {/* the trail */}
        <path d="M120,270 C200,225 180,190 260,168 C330,150 285,115 300,40" fill="none"
          stroke="rgba(232,184,115,.22)" strokeWidth="1.5" strokeDasharray="2 4" />

        {/* stones the user set: gold = prayer/encounter, blue = Lamp verse */}
        {data.stones.map((s, i) => {
          const t = s.month / data.total
          const cx = 120 + t * 200 + (i % 2 ? 28 : -18)
          const cy = groundY - t * 225 - i * 5
          const gold = s.kind === 'altar'
          return (
            <g key={`${s.kind}-${i}`} className="ascent-stone-g" style={{ animationDelay: `${i * 160 + 400}ms` }}>
              <title>{s.label}</title>
              <circle cx={cx} cy={cy} r="6" fill={gold ? '#f0c587' : '#9db4d4'} className="ascent-stone-dot" />
              <circle cx={cx} cy={cy} r="12" fill="none"
                stroke={gold ? 'rgba(240,197,135,.3)' : 'rgba(157,180,212,.3)'} className="ascent-stone-ring" />
            </g>
          )
        })}

        {/* seed of light at the unreached peak (still pulsing until whole) */}
        {!data.complete ? (
          <>
            <circle cx="300" cy="40" r="5" fill="rgba(240,197,135,.3)" className="ascent-peak-seed" />
            <circle cx="300" cy="40" r="13" fill="none" stroke="rgba(240,197,135,.15)" className="ascent-peak-halo" />
          </>
        ) : (
          <circle cx="300" cy="40" r="7" fill="#f0c587" className="ascent-peak-lit" />
        )}
      </svg>

      {/* a quiet height marker — not a completion ring */}
      <div className="ascent-status-bar" aria-hidden>
        <div className="ascent-status-fill" style={{ width: `${pct * 100}%` }} />
      </div>
      <span className="ascent-status-text">
        {data.complete ? SUMMIT_COPY.whole : SUMMIT_COPY.monthsLine(data.monthsDone, data.total)}
      </span>

      <div className="ascent-formed-grid">
        <div className="ascent-formed-cell">
          <span className="ascent-fc-num">{data.prayersMet}</span>
          <span className="ascent-fc-label">{SUMMIT_COPY.prayersLabel}</span>
        </div>
        <div className="ascent-formed-cell">
          <span className="ascent-fc-num small">{data.verse ?? '—'}</span>
          <span className="ascent-fc-label">{SUMMIT_COPY.verseLabel}</span>
        </div>
      </div>

      {data.refrain ? (
        <div className="ascent-refrain">
          <span className="ascent-formed-lbl">{SUMMIT_COPY.refrainLabel}</span>
          <button
            type="button"
            className="ascent-refrain__text"
            onClick={() => data.refrain && onOpenEntry?.(data.refrain.entryId)}
          >
            “{data.refrain.text}”
          </button>
          <span className="ascent-refrain__note">{SUMMIT_COPY.refrainNote}</span>
        </div>
      ) : null}

      <Wrapped data={data} onOpenEntry={onOpenEntry} />
    </div>
  )
}
