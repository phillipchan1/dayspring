import { useEffect, useState } from 'react'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import type { Horizon, ThreadsData } from './data/types'
import { loadThreads } from './data'
import { HorizonPill } from './HorizonPill'
import { StrandRow } from './StrandRow'
import './Threads.css'

interface Props {
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/**
 * Threads & Ropes — the reflective spine.
 *
 * A thread is one strand. A rope is threads collected and twisted, richer
 * over time. No verticality. No stats. No AI-assigned meaning.
 */
export function ThreadsView({ onOpenEntry }: Props) {
  const [horizon, setHorizon] = useState<Horizon>(4)
  const [data, setData] = useState<ThreadsData | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    setData(undefined) // loading
    loadThreads(horizon).then(
      (d) => { if (alive) setData(d) },
      () => { if (alive) setData(null) },
    )
    return () => { alive = false }
  }, [horizon])

  return (
    <div className="threads">
      <div className="threads__wrap">
        <div className="threads__eyebrow">one surface · no climbing</div>
        <h1 className="threads__title">Threads &amp; Ropes</h1>
        <p className="threads__sub">
          a thread is one strand · a rope is threads collected and twisted, richer over time
        </p>

        <HorizonPill horizon={horizon} onChange={setHorizon} />

        {data === undefined ? (
          <SurfaceLoader label="Gathering threads…" />
        ) : data === null ? (
          <p className="threads__hint" style={{ marginTop: '24px' }}>
            Could not load threads — make sure derive-threads.ts has run.
          </p>
        ) : data.strands.length === 0 ? (
          <p className="threads__hint" style={{ marginTop: '24px' }}>
            No threads in this window yet.
          </p>
        ) : (
          <>
            <div className="threads__field">
              {data.strands.map((strand) => (
                <StrandRow
                  key={strand.id}
                  strand={strand}
                  candidates={data.candidates}
                  onOpenEntry={onOpenEntry}
                />
              ))}
            </div>

            {data.restingCount > 0 && (
              <p className="threads__resting">
                {data.restingCount === 1
                  ? '1 thread resting'
                  : `${data.restingCount} threads resting`}
              </p>
            )}
          </>
        )}

        <p className="threads__foot">
          The app collects the threads. What the rope means is yours to name.
        </p>
      </div>
    </div>
  )
}
