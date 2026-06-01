import { useEffect, useRef, useState } from 'react'
import { createReminder, type ReminderHorizon } from '@/lib/reminders'

interface Props {
  entryId: string | null
  sentence: string   // pre-populated from the sentence near the cursor
  onClose: () => void
}

const HORIZONS: Array<{
  id: ReminderHorizon
  label: string
  sublabel: string
  hero?: boolean
}> = [
  { id: '1w',  label: '1 week',     sublabel: 'Next week' },
  { id: '1m',  label: '1 month',    sublabel: 'A month from now' },
  { id: '3m',  label: '3 months',   sublabel: 'A season from now' },
  { id: '1y',  label: 'A year',     sublabel: 'A year from now', hero: true },
]

export function RemindModal({ entryId, sentence, onClose }: Props) {
  const [text, setText] = useState(sentence)
  const [horizon, setHorizon] = useState<ReminderHorizon | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  async function handleSave() {
    if (!horizon || !text.trim()) return
    setSaving(true)
    setError(null)

    // For the 1-year option: a brief intentional pause before confirming.
    if (horizon === '1y') {
      await new Promise((r) => setTimeout(r, 320))
    }

    try {
      await createReminder({ entry_id: entryId, content: text.trim(), horizon })
      setSaved(true)
      setTimeout(onClose, 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save reminder')
      setSaving(false)
    }
  }

  const disableSave = !horizon || !text.trim() || saving || saved

  return (
    <div className="reflect-modal-scrim" onClick={onClose}>
      <div
        className="reflect-modal glass-surface"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Set a reminder"
      >
        <div className="glass-surface__glow" aria-hidden />

        <header className="reflect-modal__header">
          <span className="reflect-modal__title">Return to this</span>
          <button className="reflect-modal__close btn btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="reflect-modal__section">
          <p className="reflect-modal__label">Your words</p>
          <textarea
            ref={textareaRef}
            className="reflect-modal__textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="What do you want to carry forward?"
          />
        </div>

        <div className="reflect-modal__section">
          <p className="reflect-modal__label">Return in</p>
          <div className="remind-horizons">
            {HORIZONS.filter((h) => !h.hero).map((h) => (
              <button
                key={h.id}
                className="remind-horizon-btn"
                data-active={horizon === h.id ? 'true' : undefined}
                onClick={() => setHorizon(h.id)}
              >
                <span className="remind-horizon-label">{h.label}</span>
                <span className="remind-horizon-sub">{h.sublabel}</span>
              </button>
            ))}
          </div>

          {/* 1-year hero option — full width, slightly different weight */}
          <button
            className="remind-horizon-btn remind-horizon-btn--year"
            data-active={horizon === '1y' ? 'true' : undefined}
            onClick={() => setHorizon('1y')}
          >
            <span className="remind-horizon-label">A year from now</span>
            <span className="remind-horizon-sub">
              Some things take a year to see clearly.
            </span>
          </button>
        </div>

        {error && <p className="reflect-modal__error">{error}</p>}

        <div className="reflect-modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            disabled={disableSave}
            onClick={() => void handleSave()}
            style={saved ? { background: 'var(--success)', borderColor: 'transparent' } : undefined}
          >
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Set reminder'}
          </button>
        </div>
      </div>
    </div>
  )
}
