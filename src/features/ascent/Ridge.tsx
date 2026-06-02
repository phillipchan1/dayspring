import { useState } from 'react'
import { createSpiritualItem } from '@/lib/spiritual'
import { EMPTY_COPY, RIDGE_COPY, type AltitudeMeta } from './ascent.config'
import type { RidgeData } from './ascentData'

interface Props {
  data: RidgeData | null
  meta: AltitudeMeta
}

type CarryState = 'idle' | 'carrying' | 'carried'

/**
 * RIDGE (quarter) — the unresolved tensions, handed back AS QUESTIONS. The app
 * asks; it never answers, resolves, or renders a verdict. Each tension can be
 * carried into prayer — laid on the Altar as a new prayer line, not resolved.
 */
export function Ridge({ data, meta }: Props) {
  const [carry, setCarry] = useState<Record<string, CarryState>>({})

  if (!data) {
    return <p className="ascent-empty">{EMPTY_COPY.quarter.empty}</p>
  }

  async function onCarry(id: string, prayerLine: string) {
    if (carry[id] === 'carrying' || carry[id] === 'carried') return
    setCarry((c) => ({ ...c, [id]: 'carrying' }))
    try {
      await createSpiritualItem({ type: 'prayer', content: prayerLine })
      setCarry((c) => ({ ...c, [id]: 'carried' }))
    } catch {
      setCarry((c) => ({ ...c, [id]: 'idle' }))
    }
  }

  return (
    <div className="ascent-tensions">
      {data.tensions.map((t, i) => {
        const state = carry[t.id] ?? 'idle'
        const prayerLine = t.thread || t.question
        return (
          <div className="ascent-tension" key={t.id} style={{ animationDelay: `${i * 130}ms` }}>
            {t.thread ? <span className="ascent-tension__thread">{t.thread}</span> : null}
            <p className="ascent-tension__q">{t.question}</p>
            <button
              type="button"
              className="ascent-tension__act"
              onClick={() => void onCarry(t.id, prayerLine)}
              disabled={state !== 'idle'}
            >
              {state === 'carried'
                ? RIDGE_COPY.carried
                : state === 'carrying'
                  ? RIDGE_COPY.carrying
                  : RIDGE_COPY.carry}
            </button>
          </div>
        )
      })}
      <p className="ascent-voice ask">{meta.voice}</p>
    </div>
  )
}
