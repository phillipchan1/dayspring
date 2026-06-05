import { useEffect, useState } from 'react'
import { getRopesAtHorizon } from '@/features/threads/data'
import type { WarmthBand } from '@/features/threads/data'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { DIMENSION_COPY, EMPTY_COPY, SUMMIT_COPY } from './ascent.config'
import type { ScriptureData } from './data/types'
import { ScriptureDimension } from './dimensions/ScriptureDimension'
import { hueFor } from './warmth'

interface Props {
  /** Year-of-the-year verse (real scripture, kept). */
  scripture: ScriptureData | null
  onScriptureDrill: (osisRef: string) => void
  /** Tap a stone (a rope you climbed past) → its tended timeline. */
  onOpenBand: (band: WarmthBand) => void
}

const W = 600
const GROUND = 280
const CLIMB = 232 // peak rise span (peak sits near y=48)
const MAX_STONES = 8

/** Peak pool bucket → position along the year (0 = early/bottom, 1 = recent/peak). */
function peakSlot(pools: number[]): number {
  if (pools.length <= 1) return 0.5
  let peak = 0
  for (let i = 1; i < pools.length; i++) if (pools[i]! > pools[peak]!) peak = i
  return peak / (pools.length - 1)
}

/** Position a stone along the climbed path by its slot (0–1) up the trail. */
function stonePos(slot: number, i: number): { cx: number; cy: number } {
  const t = Math.min(1, Math.max(0, slot))
  return { cx: 120 + t * 190 + (i % 2 ? 26 : -16), cy: GROUND - t * CLIMB - (i % 3) * 4 }
}

/**
 * SUMMIT (year) — the quietest, most sacred ground, and the ONE illustrative
 * altitude. The mountain is the path climbed; the stones are the ropes climbed
 * past (the year's warmth bands), lit along the mountainside — tap one to walk
 * its tended timeline. Below: the one line of the year (a SELECTED member line,
 * never synthesized), the verse of the year, and the closing question. No
 * verdict, no counts; the app nearly disappears.
 */
export function Summit({ scripture, onScriptureDrill, onOpenBand }: Props) {
  const [bands, setBands] = useState<WarmthBand[] | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    getRopesAtHorizon(3).then(
      (b) => alive && setBands(b),
      () => alive && setBands(null),
    )
    return () => { alive = false }
  }, [])

  const year = new Date().getFullYear()
  const open = (bands ?? []).filter((b) => !b.private)
  const stones = open.slice(0, MAX_STONES)
  const hero = open[0]
  const oneLine = hero?.repLine ?? null

  if (bands === undefined) {
    return <SurfaceLoader label="Looking back down the year…" />
  }
  if (open.length === 0 && (!scripture || scripture.refs.length === 0)) {
    return <p className="ascent-empty">{EMPTY_COPY.year.empty}</p>
  }

  const dateLabel = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
    catch { return iso.slice(0, 10) }
  }

  return (
    <div className="ascent-summit">
      <svg viewBox={`0 0 ${W} 320`} className="ascent-mountain" role="img"
        aria-label={`The year ${year} — the path you climbed, lit by the ropes you climbed past`}>
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

        {/* the ropes you climbed past — points of light, sized by heft, hued by lens */}
        {stones.map((b, i) => {
          const { cx, cy } = stonePos(peakSlot(b.pools), i)
          const r = 4 + Math.min(5, Math.sqrt(b.heft))
          const tone = hueFor(b.lenses[0] ?? 'gold')
          return (
            <g
              key={b.id}
              className="ascent-stone-g"
              style={{ animationDelay: `${i * 150 + 300}ms`, cursor: 'pointer' }}
              onClick={() => onOpenBand(b)}
            >
              <title>{b.label}</title>
              <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="rgba(240,197,135,.28)" className="ascent-stone-ring" />
              <circle cx={cx} cy={cy} r={r} fill={tone} className="ascent-stone-dot" />
            </g>
          )
        })}

        {/* the peak — a quiet, settled light (clarity, not a countdown) */}
        <circle cx="300" cy="48" r="34" fill="url(#ascent-peakglow)" className="ascent-peak-glow" />
        <circle cx="300" cy="48" r="5" fill="#f7ecd6" className="ascent-peak-lit" />
      </svg>

      <p className="ascent-summit__look">{SUMMIT_COPY.lookingBack}</p>

      <div className="ascent-stack ascent-stack--summit">
        {oneLine ? (
          <section className="ascent-dim ascent-dim--words is-year">
            <span className="ascent-dim__eyebrow">{DIMENSION_COPY.words.year}</span>
            <button type="button" className="ascent-oneline" onClick={() => hero && onOpenBand(hero)}>
              “{oneLine.excerpt}”
            </button>
            <span className="ascent-oneline__date">{dateLabel(oneLine.date)}</span>
          </section>
        ) : null}

        <ScriptureDimension data={scripture} onDrill={onScriptureDrill} />

        <section className="ascent-dim">
          <span className="ascent-dim__eyebrow">{DIMENSION_COPY.learning.year}</span>
          <p className="ascent-summit__ask">{SUMMIT_COPY.taught}</p>
          <p className="ascent-dim__note">{DIMENSION_COPY.learning.note}</p>
        </section>
      </div>
    </div>
  )
}
