import { EMPTY_COPY, SUMMIT_COPY } from './ascent.config'
import type { SummitView } from './data/types'
import { LearningDimension } from './dimensions/LearningDimension'
import { PrayerDimension } from './dimensions/PrayerDimension'
import { ScriptureDimension } from './dimensions/ScriptureDimension'
import { WordsDimension } from './dimensions/WordsDimension'

interface Props {
  data: SummitView | null
  onOpenEntry?: ((entryId: string) => void) | undefined
  onScriptureDrill: (osisRef: string) => void
  onPrayerDrill: () => void
  onLearningDrill: () => void
}

const W = 600
const GROUND = 280
const CLIMB = 232 // peak rise span (peak sits near y=48)

/** Position a stone along the climbed path by its month (1–12). */
function stonePos(month: number, i: number): { cx: number; cy: number } {
  const t = Math.min(1, Math.max(0, month / 12))
  return { cx: 120 + t * 190 + (i % 2 ? 26 : -16), cy: GROUND - t * CLIMB - (i % 3) * 4 }
}

/**
 * SUMMIT (year) — the quietest, most sacred ground. The mountain is redrawn as
 * the PATH the user climbed, with the stones they set on the Wall as points of
 * light along the mountainside: looking back down the year, the trail lit by
 * their own markers. No progress bar, no stat cards, no countdown — the content
 * is the user's own words and marks, and the app nearly disappears. The four
 * dimensions persist here at their most distilled.
 */
export function Summit({ data, onOpenEntry, onScriptureDrill, onPrayerDrill, onLearningDrill }: Props) {
  const empty =
    !data || (!data.words && !data.scripture && !data.prayer && !data.learning && data.stones.length === 0)
  if (empty) {
    return <p className="ascent-empty">{EMPTY_COPY.year.empty}</p>
  }

  return (
    <div className="ascent-summit">
      <svg viewBox={`0 0 ${W} 320`} className="ascent-mountain" role="img"
        aria-label={`The year ${data.year} — the path you climbed, lit by the stones you set`}>
        <defs>
          <linearGradient id="ascent-rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ascent-rock-top)" />
            <stop offset="100%" stopColor="var(--ascent-rock-bottom)" />
          </linearGradient>
          <radialGradient id="ascent-peakglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f0c587" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f0c587" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* the mountain you climbed */}
        <polygon points={`300,48 560,${GROUND} 40,${GROUND}`} fill="url(#ascent-rock)" />

        {/* the trail — your own path up the year */}
        <path
          d={`M120,${GROUND} C200,235 180,196 260,172 C330,150 285,112 300,52`}
          fill="none"
          stroke="rgba(232,184,115,.28)"
          strokeWidth="1.5"
          strokeDasharray="2 5"
          className="ascent-trail"
        />

        {/* the stones you set — points of light along the mountainside */}
        {data.stones.map((s, i) => {
          const { cx, cy } = stonePos(s.month, i)
          return (
            <g
              key={`${s.month}-${i}`}
              className="ascent-stone-g"
              style={{ animationDelay: `${i * 150 + 300}ms`, cursor: s.entryId ? 'pointer' : 'default' }}
              onClick={() => s.entryId && onOpenEntry?.(s.entryId)}
            >
              <title>{s.label}</title>
              <circle cx={cx} cy={cy} r="11" fill="none" stroke="rgba(240,197,135,.28)" className="ascent-stone-ring" />
              <circle cx={cx} cy={cy} r="5" fill="#f0c587" className="ascent-stone-dot" />
            </g>
          )
        })}

        {/* the peak — a quiet, settled light (clarity, not a countdown) */}
        <circle cx="300" cy="48" r="34" fill="url(#ascent-peakglow)" className="ascent-peak-glow" />
        <circle cx="300" cy="48" r="5" fill="#f7ecd6" className="ascent-peak-lit" />
      </svg>

      <p className="ascent-summit__look">{SUMMIT_COPY.lookingBack}</p>

      <div className="ascent-stack ascent-stack--summit">
        <WordsDimension data={data.words} onOpenEntry={onOpenEntry} />
        <ScriptureDimension data={data.scripture} onDrill={onScriptureDrill} />
        <PrayerDimension data={data.prayer} onDrill={onPrayerDrill} />
        <LearningDimension data={data.learning} onDrill={onLearningDrill} />
      </div>
    </div>
  )
}
