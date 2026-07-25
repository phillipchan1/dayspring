import { useState } from 'react'
import { DIMENSION_COPY } from '../ascent.config'
import type { GrowthData, GrowthEvidence, GrowthPair } from '../data/types'

interface Props {
  data: GrowthData | null
  onOpenEntry?: ((entryId: string) => void) | undefined
}

const COPY = DIMENSION_COPY.growth

/**
 * GROWTH — the backward-measured dimension, and the only one whose content the
 * app derived rather than the user wrote. It earns that by never concluding:
 *
 *  • The HILLSIDE states how you moved across the month and immediately stands
 *    the claim on dated verbatim lines (the adapter drops unevidenced prose).
 *  • The RIDGE only asks — the tensions you keep circling, never resolved.
 *  • The SUMMIT speaks longest (the throughline), having been climbed to.
 *
 * Deliberately absent: any number, delta, percentage, streak, or completion
 * state. The `gapWatch` line — the one sentence closest to a verdict — renders
 * collapsed behind a disclosure so it is never what you land on.
 */
export function GrowthDimension({ data, onOpenEntry }: Props) {
  const [gapOpen, setGapOpen] = useState(false)

  if (!data) return null
  const { resolution, movement, evidence, pairs, tensions, gapWatch, acrossLabel } = data
  if (resolution === 'week') return null

  const eyebrow = COPY[resolution as 'month' | 'quarter' | 'year']
  const isYear = resolution === 'year'

  return (
    <section className={`ascent-dim ascent-dim--growth${isYear ? ' is-year' : ''}`}>
      <span className="ascent-dim__eyebrow">
        {eyebrow}
        {acrossLabel ? <em className="ascent-growth__across">{COPY.across(acrossLabel)}</em> : null}
      </span>

      {/* The movement — month: the gain · year: the throughline. */}
      {movement.length > 0 ? (
        <div className="ascent-growth__prose">
          {movement.map((p, i) => (
            <p key={i} className="ascent-growth__para">
              {p}
            </p>
          ))}
        </div>
      ) : null}

      {/* The ground under the claim. Never optional at the Hillside — the adapter
          returns null rather than let a gain sentence stand on its own. */}
      {evidence.length > 0 ? (
        <div className="ascent-growth__evidence">
          {evidence.map((e, i) => (
            <EvidenceLine key={e.entryId + i} item={e} onOpenEntry={onOpenEntry} />
          ))}
        </div>
      ) : null}

      {/* THEN / NOW — the growth atom, borrowed from the Altar's bookend. */}
      {pairs.length > 0 ? (
        <div className="ascent-growth__pairs">
          {!isYear ? <span className="ascent-dim__eyebrow ascent-dim__eyebrow--sub">{COPY.pairsLabel}</span> : null}
          {pairs.map((p, i) => (
            <PairBookend key={p.id} pair={p} index={i} onOpenEntry={onOpenEntry} />
          ))}
        </div>
      ) : null}

      {/* The Ridge: open threads, handed back. */}
      {tensions.length > 0 ? (
        <div className="ascent-growth__tensions">
          {tensions.map((t, i) => (
            <div key={t.id} className="ascent-growth__tension" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="ascent-growth__thread">{t.thread}</span>
              <p className="ascent-growth__question">{t.question}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* The Gap reflex — collapsed by default, dismissible back to collapsed. */}
      {gapWatch ? (
        gapOpen ? (
          <div className="ascent-growth__gap">
            <p className="ascent-growth__gap-text">{gapWatch}</p>
            <button type="button" className="ascent-growth__gap-close" onClick={() => setGapOpen(false)}>
              {COPY.gapWatchClose}
            </button>
          </div>
        ) : (
          <button type="button" className="ascent-growth__gap-toggle" onClick={() => setGapOpen(true)}>
            {`⌄ ${COPY.gapWatch}`}
          </button>
        )
      ) : null}

      <p className="ascent-dim__note">{resolution === 'quarter' ? COPY.askNote : COPY.note}</p>
    </section>
  )
}

// ── one dated verbatim line, linking back to its entry ────────────────────────

function EvidenceLine({
  item,
  onOpenEntry,
}: {
  item: GrowthEvidence
  onOpenEntry?: ((entryId: string) => void) | undefined
}) {
  return (
    <button
      type="button"
      className="ascent-growth__ev"
      onClick={() => onOpenEntry?.(item.entryId)}
      disabled={!onOpenEntry}
    >
      <span className="ascent-growth__ev-date">{item.dateLabel}</span>
      <span className="ascent-growth__ev-text">{`“${item.text}”`}</span>
    </button>
  )
}

// ── THEN / NOW — two of your own lines, set side by side ──────────────────────

function PairBookend({
  pair,
  index,
  onOpenEntry,
}: {
  pair: GrowthPair
  index: number
  onOpenEntry?: ((entryId: string) => void) | undefined
}) {
  return (
    <div className="ascent-bookend" style={{ animationDelay: `${index * 70}ms` }}>
      {(['then', 'now'] as const).map((side) => {
        const item = pair[side]
        return (
          <button
            key={side}
            type="button"
            className={`ascent-bookend__half ascent-bookend__half--${side}`}
            onClick={() => onOpenEntry?.(item.entryId)}
            disabled={!onOpenEntry}
          >
            <span className={`ascent-bookend__lbl${side === 'now' ? ' ascent-bookend__lbl--gold' : ''}`}>
              {side === 'now' ? COPY.now : COPY.then}
            </span>
            <span className="ascent-bookend__date">{item.dateLabel}</span>
            <span className="ascent-bookend__text">{item.text}</span>
          </button>
        )
      })}
    </div>
  )
}
