import { useEffect, useState } from 'react'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { DRILL_COPY } from '../ascent.config'
import { confirmScriptureRef, loadVerseDrill, type Windows } from '../data'
import type { VerseDrill } from '../data'
import { fmtDay } from '../data/words'
import type { Resolution } from '../data/types'
import { DrillSheet } from './DrillSheet'

interface Props {
  osisRef: string
  windows: Windows
  onClose: () => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}

const RISE_LABEL: Record<Resolution, string> = { week: 'wk', month: 'mo', quarter: 'qtr', year: 'yr' }

/**
 * Scripture drill-in — REAL. Every moment a verse was reached for, laid along the
 * season by entry date; each point opens its source entry (never the prose
 * rewritten). Above sits the verse's RISE across altitudes. Suggested (AI-
 * inferred) echoes show faintly with the quiet confirm funnel that promotes them.
 */
export function ScriptureDrillIn({ osisRef, windows, onClose, onOpenEntry }: Props) {
  const [drill, setDrill] = useState<VerseDrill | null | undefined>(undefined)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    loadVerseDrill(osisRef, windows).then(
      (d) => alive && setDrill(d),
      () => alive && setDrill(null),
    )
    return () => {
      alive = false
    }
  }, [osisRef, windows])

  async function confirm(refId: string) {
    if (busy.has(refId) || confirmed.has(refId)) return
    setBusy((b) => new Set(b).add(refId))
    try {
      await confirmScriptureRef(refId)
      setConfirmed((c) => new Set(c).add(refId))
    } catch {
      // leave it as a suggestion; the user can try again
    } finally {
      setBusy((b) => {
        const n = new Set(b)
        n.delete(refId)
        return n
      })
    }
  }

  const title = drill ? DRILL_COPY.scriptureTitle(drill.label) : DRILL_COPY.scriptureTitle('…')
  const riseMax = drill ? Math.max(1, ...drill.rise.map((r) => r.count)) : 1

  return (
    <DrillSheet title={title} onClose={onClose}>
      {drill === undefined ? (
        <SurfaceLoader label="Following the thread…" />
      ) : !drill || drill.moments.length === 0 ? (
        <p className="ascent-dim__empty">This verse hasn’t surfaced in your writing yet.</p>
      ) : (
        <div className="ascent-vdrill">
          {/* the verse's rise as you climbed — distinct entries per altitude */}
          <div className="ascent-vdrill__rise" aria-label={DRILL_COPY.scriptureRise}>
            <span className="ascent-vdrill__rise-lbl">{DRILL_COPY.scriptureRise}</span>
            <div className="ascent-vdrill__rise-bars">
              {drill.rise.map((r) => (
                <div className="ascent-vdrill__rise-col" key={r.resolution}>
                  <span className="ascent-vdrill__rise-n">{r.count || ''}</span>
                  <span
                    className="ascent-vdrill__rise-bar"
                    style={{ height: `${(r.count / riseMax) * 100}%` }}
                    aria-hidden
                  />
                  <span className="ascent-vdrill__rise-x">{RISE_LABEL[r.resolution]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* the season as a path of the moments you reached for it */}
          <ol className="ascent-path">
            {drill.moments.map((m) => {
              const isConfirmed = m.status === 'confirmed' || confirmed.has(m.ref_id)
              return (
                <li
                  key={m.ref_id}
                  className={`ascent-path__moment${isConfirmed ? '' : ' is-suggested'}`}
                >
                  <span className="ascent-path__dot" aria-hidden />
                  <div className="ascent-path__body">
                    <button
                      type="button"
                      className="ascent-path__excerpt"
                      onClick={() => onOpenEntry?.(m.entry_id)}
                    >
                      {m.excerpt || '(open entry)'}
                    </button>
                    <span className="ascent-path__date">{fmtDay(m.entry_created_at)}</span>
                    {!isConfirmed ? (
                      <div className="ascent-path__confirm">
                        <span className="ascent-path__hint">{DRILL_COPY.scriptureSuggested}</span>
                        <button
                          type="button"
                          className="ascent-link"
                          disabled={busy.has(m.ref_id)}
                          onClick={() => void confirm(m.ref_id)}
                        >
                          {DRILL_COPY.scriptureConfirm}
                        </button>
                      </div>
                    ) : confirmed.has(m.ref_id) ? (
                      <span className="ascent-path__confirmed">{DRILL_COPY.scriptureConfirmed}</span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </DrillSheet>
  )
}
