import { useMemo, useState } from 'react'
import { SUGGESTED } from '../corpus'
import { occurrenceCount } from '../match'

export function KeepOffer() {
  const ranked = useMemo(
    () =>
      SUGGESTED.map((s) => ({ ...s, n: occurrenceCount(s) })).sort((a, b) => b.n - a.n),
    [],
  )
  const [gone, setGone] = useState<Set<string>>(new Set())
  const [kept, setKept] = useState<string[]>([])

  const visible = ranked.filter((s) => !gone.has(s.key) && !kept.includes(s.label))

  return (
    <div className="paper">
      <div className="keep">
        <div className="chips">
          {visible.map((s) => (
            <div className="chip" key={s.key}>
              <div>
                <span className="chip__name">{s.label}</span>
                <span className="chip__n">{s.n}</span>
              </div>
              <div className="chip__acts">
                <button
                  type="button"
                  onClick={() => setKept((k) => (k.includes(s.label) ? k : [...k, s.label]))}
                >
                  Keep
                </button>
                <button type="button" onClick={() => setGone((g) => new Set(g).add(s.key))}>
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
        {kept.length > 0 && (
          <div className="kept">
            <div className="kept__names">
              {kept.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
