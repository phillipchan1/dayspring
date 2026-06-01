import { useRef, useState } from 'react'
import { createSpiritualItem } from '@/lib/spiritual'
import type { PrayerType } from '@/lib/types'

const PRAYER_TYPES: { id: PrayerType; label: string }[] = [
  { id: 'intercession', label: 'Intercession' },
  { id: 'gratitude', label: 'Gratitude' },
  { id: 'petition', label: 'Petition' },
  { id: 'praise', label: 'Praise' },
]

interface Props {
  entryId: string | null
  entryContent: string
  onClose: () => void
}

function lastParagraph(text: string): string {
  const paras = text.trim().split(/\n{2,}/).filter(Boolean)
  return paras[paras.length - 1]?.trim() ?? ''
}

export function PrayModal({ entryId, entryContent, onClose }: Props) {
  const [prayerType, setPrayerType] = useState<PrayerType | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const preview = lastParagraph(entryContent)

  async function handleSave() {
    if (!prayerType) return
    setSaving(true)
    setError(null)
    try {
      const content = note.trim() || preview || '(no text)'
      await createSpiritualItem({
        entry_id: entryId,
        type: 'prayer',
        content,
        metadata: { prayer_type: prayerType },
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save prayer')
      setSaving(false)
    }
  }

  return (
    <div className="reflect-modal-scrim" onClick={onClose}>
      <div
        className="reflect-modal glass-surface"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Log a prayer"
      >
        <div className="glass-surface__glow" aria-hidden />

        <header className="reflect-modal__header">
          <span className="reflect-modal__title">Prayer</span>
          <button className="reflect-modal__close btn btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {preview && (
          <blockquote className="reflect-modal__quote">
            {preview.slice(0, 120)}{preview.length > 120 ? '…' : ''}
          </blockquote>
        )}

        <div className="reflect-modal__section">
          <p className="reflect-modal__label">Type</p>
          <div className="prayer-type-grid">
            {PRAYER_TYPES.map((t) => (
              <button
                key={t.id}
                className="prayer-type-btn"
                data-active={prayerType === t.id ? 'true' : undefined}
                onClick={() => {
                  setPrayerType(t.id)
                  noteRef.current?.focus()
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="reflect-modal__section">
          <p className="reflect-modal__label">Note <span style={{ opacity: 0.5 }}>(optional)</span></p>
          <textarea
            ref={noteRef}
            className="reflect-modal__textarea"
            placeholder="Name, specific ask…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </div>

        {error && <p className="reflect-modal__error">{error}</p>}

        <div className="reflect-modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            disabled={!prayerType || saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save prayer'}
          </button>
        </div>
      </div>
    </div>
  )
}
