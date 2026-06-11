// The Concordance drawer — the fidelity record's one inspectable surface.
// Invisible by default, opened on demand (Settings → About). Read-only plus
// three corrections: confirm ("yes, that's how I spell it"), edit, forget.
//
// Boringly honest by design: spellings, names, and identity-only descriptors —
// never moods, themes, or anything concluded about the writer. No completeness
// meter, no "we know N things about you", no streaks. One-off mentions stay
// hidden until they recur (SURFACE_MIN_DISTINCT_ENTRIES) or the user vouches.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CONCORDANCE,
  listConcordance,
  confirmConcordanceItem,
  editConcordanceItem,
  forgetConcordanceItem,
  type ConcordanceItem,
} from '@/lib/concordance'
import './Concordance.css'

const KIND_LABEL: Record<ConcordanceItem['kind'], string> = {
  person: 'person',
  place: 'place',
  org: 'org',
  project: 'project',
  term: 'term',
}

interface Props {
  onClose: () => void
}

export function ConcordanceDrawer({ onClose }: Props) {
  const [items, setItems] = useState<ConcordanceItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listConcordance()
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .catch(() => {
        if (!cancelled) setError('Couldn’t load right now. Try again later.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  async function handleConfirm(item: ConcordanceItem) {
    setItems((rows) =>
      (rows ?? []).map((r) => (r.id === item.id ? { ...r, status: 'confirmed' as const } : r)),
    )
    try {
      await confirmConcordanceItem(item)
    } catch {
      setError('That didn’t save. Try again.')
    }
  }

  async function handleForget(item: ConcordanceItem) {
    setItems((rows) => (rows ?? []).filter((r) => r.id !== item.id))
    try {
      await forgetConcordanceItem(item)
    } catch {
      setError('That didn’t save. Try again.')
    }
  }

  async function handleEdit(item: ConcordanceItem, edit: { canonical: string; aliases: string; descriptor: string }) {
    setEditingId(null)
    try {
      await editConcordanceItem(item, {
        canonical: edit.canonical,
        surface_forms: edit.aliases
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        descriptor: edit.descriptor.trim() || null,
      })
      setItems(await listConcordance())
    } catch {
      setError('That didn’t save. Try again.')
    }
  }

  return createPortal(
    <div className="scrim glass-scrim concordance-scrim" onClick={onClose}>
      <aside
        className="concordance-drawer glass-surface"
        role="dialog"
        aria-modal="true"
        aria-label={CONCORDANCE.DRAWER_TITLE}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="concordance-drawer__head">
          <div>
            <h2 className="concordance-drawer__title">{CONCORDANCE.DRAWER_TITLE}</h2>
            <p className="concordance-drawer__subtitle">{CONCORDANCE.DRAWER_SUBTITLE}</p>
          </div>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close concordance">
            ✕
          </button>
        </header>

        {error && <p className="concordance-drawer__error">{error}</p>}

        {items === null && !error ? (
          <p className="concordance-drawer__empty">…</p>
        ) : items && items.length === 0 ? (
          <p className="concordance-drawer__empty">{CONCORDANCE.DRAWER_EMPTY}</p>
        ) : (
          <ul className="concordance-list">
            {(items ?? []).map((item) =>
              editingId === item.id ? (
                <EditRow
                  key={item.id}
                  item={item}
                  onCancel={() => setEditingId(null)}
                  onSave={(edit) => void handleEdit(item, edit)}
                />
              ) : (
                <li key={item.id} className="concordance-row">
                  <div className="concordance-row__main">
                    <span className="concordance-row__canonical">{item.canonical}</span>
                    <span className="concordance-row__kind">{KIND_LABEL[item.kind]}</span>
                    {item.descriptor && (
                      <span className="concordance-row__descriptor">{item.descriptor}</span>
                    )}
                  </div>
                  {item.surface_forms.length > 0 && (
                    <div className="concordance-row__aliases">
                      {item.surface_forms.map((f) => (
                        <span key={f} className="concordance-row__alias">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="concordance-row__actions">
                    {item.status === 'suggested' && (
                      <button
                        className="btn btn--ghost"
                        onClick={() => void handleConfirm(item)}
                        title="Yes, that’s how I spell it"
                      >
                        Confirm
                      </button>
                    )}
                    <button className="btn btn--ghost" onClick={() => setEditingId(item.id)}>
                      Edit
                    </button>
                    <button
                      className="btn btn--ghost concordance-row__forget"
                      onClick={() => void handleForget(item)}
                    >
                      Forget
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </aside>
    </div>,
    document.body,
  )
}

function EditRow({
  item,
  onSave,
  onCancel,
}: {
  item: ConcordanceItem
  onSave: (edit: { canonical: string; aliases: string; descriptor: string }) => void
  onCancel: () => void
}) {
  const [canonical, setCanonical] = useState(item.canonical)
  const [aliases, setAliases] = useState(item.surface_forms.join(', '))
  const [descriptor, setDescriptor] = useState(item.descriptor ?? '')

  return (
    <li className="concordance-row concordance-row--editing">
      <label className="concordance-edit__field">
        <span>Name</span>
        <input value={canonical} onChange={(e) => setCanonical(e.target.value)} />
      </label>
      <label className="concordance-edit__field">
        <span>Also written as</span>
        <input
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
          placeholder="Comma-separated"
        />
      </label>
      <label className="concordance-edit__field">
        <span>Who/what (a label, e.g. “wife”)</span>
        <input value={descriptor} onChange={(e) => setDescriptor(e.target.value)} />
      </label>
      <div className="concordance-row__actions">
        <button
          className="btn btn--accent"
          disabled={!canonical.trim()}
          onClick={() => onSave({ canonical, aliases, descriptor })}
        >
          Save
        </button>
        <button className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </li>
  )
}
