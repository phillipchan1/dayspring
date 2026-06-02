import { useState } from 'react'
import { createSpiritualItem } from '@/lib/spiritual'
import { DRILL_COPY } from '../ascent.config'
import type { LearningData } from '../data/types'
import { DrillSheet } from './DrillSheet'

interface Props {
  data: LearningData
  onClose: () => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/**
 * Learning drill-in — MOCK. How a realization was woven from the season: the
 * question sits lit at the top; source moments from DIFFERENT lenses descend a
 * single cord, each a verbatim fragment in the user's own words. The payoff is
 * cross-lens convergence. The app never names the lesson — it stays a question.
 * (Mirrors the attached prototype; see data/learning.ts for the // TODO seam.)
 */
export function LearningDrillIn({ data, onClose, onOpenEntry }: Props) {
  const [carried, setCarried] = useState<'idle' | 'carrying' | 'carried'>('idle')

  async function carry() {
    if (carried !== 'idle') return
    setCarried('carrying')
    try {
      await createSpiritualItem({ type: 'prayer', content: data.question })
      setCarried('carried')
    } catch {
      setCarried('idle')
    }
  }

  const frags = data.fragments
  const STEP = 85
  const TOP = 178
  const cordTop = 116
  const cordBottom = TOP + (frags.length - 1) * STEP + 40
  const H = cordBottom + 30
  const W = 640
  const cx = W / 2

  return (
    <DrillSheet title={DRILL_COPY.learningTop} onClose={onClose}>
      <div className="ascent-learndrill">
        <div className="ascent-learndrill__card">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" className="ascent-cord">
            <title>How this thread was woven from the season</title>

            {/* the realization, lit */}
            <circle cx={cx} cy="62" r="76" fill="#e9cf9a" opacity="0.15" />
            <circle cx={cx} cy="62" r="52" fill="#e9cf9a" opacity="0.24" />
            <circle cx={cx} cy="62" r="32" fill="#e9cf9a" opacity="0.34" />
            <text x={cx} y="34" textAnchor="middle" className="ascent-cord__eyebrow">
              {DRILL_COPY.learningTop}
            </text>
            <text x={cx} y="68" textAnchor="middle" className="ascent-cord__q">
              {data.question}
            </text>

            {/* the cord */}
            <line x1={cx} y1={cordTop} x2={cx} y2={cordBottom} stroke="#d8b878" strokeWidth="2" opacity="0.85" />

            {frags.map((f, i) => {
              const y = TOP + i * STEP
              const right = i % 2 === 0
              const tx = right ? cx + 40 : cx - 40
              const anchor = right ? 'start' : 'end'
              const cc = right ? `M${cx},${y} C ${cx + 14},${y - 4} ${cx + 22},${y - 4} ${cx + 30},${y}`
                                : `M${cx},${y} C ${cx - 14},${y - 4} ${cx - 22},${y - 4} ${cx - 30},${y}`
              return (
                <g
                  key={`${f.lens}-${i}`}
                  className="ascent-cord__node"
                  onClick={() => f.entryId && onOpenEntry?.(f.entryId)}
                  style={{ cursor: f.entryId ? 'pointer' : 'default' }}
                >
                  <path d={cc} fill="none" stroke="#c89440" strokeWidth="1.2" opacity="0.6" />
                  <circle cx={cx} cy={y} r="9" fill="none" stroke="#c89440" strokeWidth="1" opacity="0.4" />
                  <circle cx={cx} cy={y} r="5" fill="#c89440" />
                  <text x={tx} y={y - 8} textAnchor={anchor} className="ascent-cord__lens">
                    {f.lens.toUpperCase()}
                  </text>
                  <text x={tx} y={y + 13} textAnchor={anchor} className="ascent-cord__frag">
                    “{f.text}”
                  </text>
                  <text x={tx} y={y + 30} textAnchor={anchor} className="ascent-cord__date">
                    {f.dateLabel}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <footer className="ascent-learndrill__footer">
          <span className="ascent-learndrill__note">{DRILL_COPY.learningFooter}</span>
          <button type="button" className="ascent-link" onClick={() => void carry()} disabled={carried !== 'idle'}>
            {carried === 'carried' ? 'laid on the altar ✓' : carried === 'carrying' ? 'carrying…' : DRILL_COPY.learningCarry}
          </button>
        </footer>
      </div>
    </DrillSheet>
  )
}
