import { useState } from 'react'
import { DRILL_COPY } from '../ascent.config'
import type { PrayerData } from '../data/types'
import { DrillSheet } from './DrillSheet'

interface Props {
  data: PrayerData
  onClose: () => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/**
 * Prayer drill-in — MOCK. The asks lay along the path; where one has later
 * evidence, a dotted thread reaches forward and the point can be CONFIRMED into a
 * stone. The app draws ask + candidate evidence only — the user confirms. Confirm
 * is the funnel that would write to the Wall.
 *
 * // TODO: wire real data — on confirm, set the stone on the Wall (currently local).
 */
export function PrayerDrillIn({ data, onClose, onOpenEntry }: Props) {
  const [stones, setStones] = useState<Set<number>>(new Set())

  function setStone(i: number) {
    // TODO: write to the Wall (the funnel). For now this is a local, quiet mark.
    setStones((s) => new Set(s).add(i))
  }

  return (
    <DrillSheet title={DRILL_COPY.prayerTitle} onClose={onClose}>
      <div className="ascent-praydrill">
        <p className="ascent-praydrill__pattern">{data.pattern}</p>
        <ol className="ascent-path">
          {data.asks.map((a, i) => {
            const set = stones.has(i)
            return (
              <li key={i} className="ascent-path__moment">
                <span className="ascent-path__dot" aria-hidden />
                <div className="ascent-path__body">
                  <button
                    type="button"
                    className="ascent-path__excerpt"
                    onClick={() => a.entryId && onOpenEntry?.(a.entryId)}
                  >
                    {a.text}
                  </button>
                  <span className="ascent-path__date">{a.dateLabel}</span>

                  {a.evidence ? (
                    <div className="ascent-praydrill__forward">
                      <span className="ascent-praydrill__thread" aria-hidden />
                      <div className="ascent-praydrill__evidence">
                        <span className="ascent-praydrill__ev-label">{DRILL_COPY.prayerEvidence}</span>
                        <button
                          type="button"
                          className="ascent-path__excerpt"
                          onClick={() => a.evidence?.entryId && onOpenEntry?.(a.evidence.entryId)}
                        >
                          {a.evidence.text}
                        </button>
                        <span className="ascent-path__date">{a.evidence.dateLabel}</span>
                        {set ? (
                          <span className="ascent-path__confirmed">{DRILL_COPY.prayerConfirmed}</span>
                        ) : (
                          <button type="button" className="ascent-link" onClick={() => setStone(i)}>
                            {DRILL_COPY.prayerConfirm}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </DrillSheet>
  )
}
