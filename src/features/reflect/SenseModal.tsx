import { useEffect, useRef, useState } from 'react'
import { createSpiritualItem } from '@/lib/spiritual'

interface Props {
  entryId: string | null
  onClose: () => void
}

export function SenseModal({ entryId, onClose }: Props) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  async function handleSave() {
    const content = text.trim()
    if (!content) return
    setSaving(true)
    setError(null)
    try {
      await createSpiritualItem({
        entry_id: entryId,
        type: 'sense',
        content,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
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
        aria-label="Record a sense"
      >
        <div className="glass-surface__glow" aria-hidden />

        <header className="reflect-modal__header">
          <span className="reflect-modal__title">I sense God is saying…</span>
          <button className="reflect-modal__close btn btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="reflect-modal__section">
          <textarea
            ref={textareaRef}
            className="reflect-modal__textarea reflect-modal__textarea--sense"
            placeholder="Write it here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSave()
            }}
          />
        </div>

        {error && <p className="reflect-modal__error">{error}</p>}

        <div className="reflect-modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            disabled={!text.trim() || saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
