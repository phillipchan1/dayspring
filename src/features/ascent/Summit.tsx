import { DIMENSION_COPY, EMPTY_COPY, SUMMIT_COPY } from './ascent.config'
import type { ScriptureData, WordsData } from './data/types'
import { ScriptureDimension } from './dimensions/ScriptureDimension'

interface Props {
  /** The year's reflection rollup — the refrain (one line) + the year's arcs. */
  words: WordsData | null
  /** Year-of-the-year verse (real scripture, kept). */
  scripture: ScriptureData | null
  onScriptureDrill: (osisRef: string) => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}

const W = 600
const GROUND = 280

/**
 * SUMMIT (year) — the quietest, most sacred ground. The mountain is the path
 * climbed; below it the ONE line of the year (the verbatim refrain), the year's
 * threads, the verse of the year, and the closing question. No verdict, no counts.
 * (The earlier "stones" were the rope engine's bands — never wired to real data;
 * the Summit now reads the yearly rollup like every other altitude.)
 */
export function Summit({ words, scripture, onScriptureDrill, onOpenEntry }: Props) {
  const year = new Date().getFullYear()
  const oneLine = words?.moments?.[0] ?? null
  const arcs = words?.arcs ?? []

  if (!oneLine && arcs.length === 0 && (!scripture || scripture.refs.length === 0)) {
    return <p className="ascent-empty">{EMPTY_COPY.year.empty}</p>
  }

  return (
    <div className="ascent-summit">
      <svg
        viewBox={`0 0 ${W} 320`}
        className="ascent-mountain"
        role="img"
        aria-label={`The year ${year} — the path you climbed`}
      >
        <defs>
          <linearGradient id="ascent-rock" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ascent-rock-top)" />
            <stop offset="100%" stopColor="var(--ascent-rock-bottom)" />
          </linearGradient>
          <radialGradient id="ascent-peakglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--ascent-gold-soft)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--ascent-gold-soft)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <polygon points={`300,48 560,${GROUND} 40,${GROUND}`} fill="url(#ascent-rock)" />
        <path
          d={`M120,${GROUND} C200,235 180,196 260,172 C330,150 285,112 300,52`}
          fill="none"
          stroke="var(--ascent-trail)"
          strokeWidth="1.5"
          strokeDasharray="2 5"
          className="ascent-trail"
        />
        <circle cx="300" cy="48" r="34" fill="url(#ascent-peakglow)" className="ascent-peak-glow" />
        <circle cx="300" cy="48" r="5" fill="var(--ascent-peak)" className="ascent-peak-lit" />
      </svg>

      <p className="ascent-summit__look">{SUMMIT_COPY.lookingBack}</p>

      <div className="ascent-stack ascent-stack--summit">
        {oneLine ? (
          <section className="ascent-dim ascent-dim--words is-year">
            <span className="ascent-dim__eyebrow">{DIMENSION_COPY.words.year}</span>
            <button
              type="button"
              className="ascent-oneline"
              onClick={() => onOpenEntry?.(oneLine.entryId)}
            >
              “{oneLine.text}”
            </button>
            <span className="ascent-oneline__date">{oneLine.dateLabel}</span>
          </section>
        ) : null}

        {arcs.length > 0 ? (
          <section className="ascent-dim ascent-dim--words">
            <span className="ascent-dim__eyebrow">{DIMENSION_COPY.words.themes.year}</span>
            <div className="ascent-arcs">
              {arcs.map((a, i) => (
                <div key={a.name + i} className="ascent-arc">
                  <span className="ascent-arc__name">{a.name}</span>
                  <p className="ascent-arc__note">{a.note}</p>
                </div>
              ))}
            </div>
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
