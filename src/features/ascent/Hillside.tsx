import { useEffect, useState } from 'react'
import { saveArcs, type Arc } from '@/lib/insights'
import { EMPTY_COPY, HILLSIDE_COPY, type AltitudeMeta } from './ascent.config'
import type { HillsideData } from './ascentData'

interface Props {
  data: HillsideData | null
  meta: AltitudeMeta
}

type Mode = { kind: 'idle' } | { kind: 'rename'; id: string } | { kind: 'merge'; id: string }

/**
 * HILLSIDE (month) — the recurrences, clustered and NAMED TENTATIVELY. The name
 * is the one interpretive move, so it's the user's to own: rename, wave off, or
 * merge. Edits persist to the monthly rollup (RLS-guarded owner write).
 */
export function Hillside({ data, meta }: Props) {
  const [arcs, setArcs] = useState<Arc[]>(data?.arcs ?? [])
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [draft, setDraft] = useState('')

  // Reset local state when the underlying rollup changes.
  useEffect(() => {
    setArcs(data?.arcs ?? [])
    setMode({ kind: 'idle' })
  }, [data])

  if (!data) {
    return <p className="ascent-empty">{EMPTY_COPY.month.empty}</p>
  }

  function persist(next: Arc[]) {
    const prev = arcs
    setArcs(next) // optimistic
    setMode({ kind: 'idle' })
    void saveArcs(data!.rollupId, next).catch(() => setArcs(prev)) // revert on failure
  }

  function startRename(arc: Arc) {
    setDraft(arc.name)
    setMode({ kind: 'rename', id: arc.id })
  }

  function commitRename(arc: Arc) {
    const name = draft.trim()
    if (!name || name === arc.name) {
      setMode({ kind: 'idle' })
      return
    }
    persist(arcs.map((a) => (a.id === arc.id ? { ...a, name } : a)))
  }

  function dismiss(arc: Arc) {
    persist(arcs.filter((a) => a.id !== arc.id))
  }

  function mergeInto(source: Arc, target: Arc) {
    const ids = [...new Set([...target.entry_ids, ...source.entry_ids])]
    const merged: Arc = { ...target, entry_ids: ids, weight: ids.length }
    persist(arcs.filter((a) => a.id !== source.id).map((a) => (a.id === target.id ? merged : a)))
  }

  return (
    <div className="ascent-arcs-wrap">
      <div className="ascent-arcs">
        {arcs.map((a, i) => {
          const merging = mode.kind === 'merge'
          const isMergeSource = mode.kind === 'merge' && mode.id === a.id
          const isMergeTarget = merging && !isMergeSource
          return (
            <div
              className={`ascent-arc${isMergeSource ? ' is-merge-source' : ''}${isMergeTarget ? ' is-merge-target' : ''}`}
              key={a.id}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="ascent-arc__weight" aria-hidden>
                {Array.from({ length: Math.min(a.weight, 8) }).map((_, k) => (
                  <span
                    className="ascent-pip"
                    key={k}
                    style={{ animationDelay: `${i * 90 + k * 50}ms` }}
                  />
                ))}
              </div>

              {mode.kind === 'rename' && mode.id === a.id ? (
                <div className="ascent-arc__rename">
                  <input
                    className="ascent-arc__input"
                    value={draft}
                    autoFocus
                    placeholder={HILLSIDE_COPY.renamePlaceholder}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(a)
                      if (e.key === 'Escape') setMode({ kind: 'idle' })
                    }}
                    aria-label={`Rename ${a.name}`}
                  />
                  <div className="ascent-arc__rename-actions">
                    <button type="button" className="ascent-link" onClick={() => commitRename(a)}>
                      {HILLSIDE_COPY.save}
                    </button>
                    <button
                      type="button"
                      className="ascent-link dim"
                      onClick={() => setMode({ kind: 'idle' })}
                    >
                      {HILLSIDE_COPY.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="ascent-arc__name">{a.name}</p>
              )}

              {a.note ? <p className="ascent-arc__note">{a.note}</p> : null}
              <span className="ascent-arc__from">{HILLSIDE_COPY.drawnFrom(a.weight)}</span>

              {mode.kind === 'idle' ? (
                <div className="ascent-arc__actions">
                  <button type="button" className="ascent-link" onClick={() => startRename(a)}>
                    {HILLSIDE_COPY.rename}
                  </button>
                  {arcs.length > 1 ? (
                    <button
                      type="button"
                      className="ascent-link"
                      onClick={() => setMode({ kind: 'merge', id: a.id })}
                    >
                      {HILLSIDE_COPY.merge}
                    </button>
                  ) : null}
                  <button type="button" className="ascent-link dim" onClick={() => dismiss(a)}>
                    {HILLSIDE_COPY.dismiss}
                  </button>
                </div>
              ) : null}

              {isMergeTarget ? (
                <button
                  type="button"
                  className="ascent-arc__merge-target"
                  onClick={() => mergeInto(arcs.find((x) => x.id === (mode as { id: string }).id)!, a)}
                >
                  {HILLSIDE_COPY.mergeHint} → <strong>{a.name}</strong>
                </button>
              ) : null}
              {isMergeSource ? (
                <button
                  type="button"
                  className="ascent-link dim"
                  onClick={() => setMode({ kind: 'idle' })}
                >
                  {HILLSIDE_COPY.cancel}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
      <p className="ascent-voice">{meta.voice}</p>
    </div>
  )
}
