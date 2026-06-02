import { useState } from 'react'
import { LENS_COPY } from './ascent.config'
import { getLenses, setLenses as persist, type Lens } from './data/lenses'

/**
 * The "watching this season" row — the user's active reflection lenses, surfaced
 * as quiet ATTENTION, not a life-admin filter bar. Small text labels, no colors;
 * editable and calm. (No per-lens insight data exists yet, so this is a local
 * attention preference; the seam stays the same when per-lens synthesis lands.)
 */
export function LensRow() {
  const [lenses, setLensesState] = useState<Lens[]>(() => getLenses())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function add() {
    const v = draft.trim()
    if (!v) return
    setLensesState(persist([...lenses, v]))
    setDraft('')
  }
  function remove(l: Lens) {
    setLensesState(persist(lenses.filter((x) => x !== l)))
  }

  return (
    <div className="ascent-lenses">
      <span className="ascent-lenses__label">{LENS_COPY.label}</span>
      <div className="ascent-lenses__chips">
        {lenses.map((l) => (
          <span className="ascent-lens" key={l}>
            {l}
            {editing ? (
              <button
                type="button"
                className="ascent-lens__x"
                aria-label={`${LENS_COPY.remove} ${l}`}
                onClick={() => remove(l)}
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
        {editing ? (
          <input
            className="ascent-lens__input"
            value={draft}
            autoFocus
            placeholder={LENS_COPY.addPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
              if (e.key === 'Escape') setEditing(false)
            }}
            aria-label={LENS_COPY.add}
          />
        ) : null}
        <button type="button" className="ascent-lenses__edit" onClick={() => setEditing((v) => !v)}>
          {editing ? LENS_COPY.done : LENS_COPY.edit}
        </button>
      </div>
    </div>
  )
}
