import { useState, type FormEvent } from 'react'
import { sendFeedback, type Preference } from '../lib/feedback'

const OPTIONS: { id: Preference; label: string }[] = [
  {
    id: 'A',
    label: 'The separate surface — a shelf you can open and read your own answers back',
  },
  {
    id: 'B',
    label: 'The drawer inside the composer — the return arrives while you are writing',
  },
  {
    id: 'C',
    label:
      'Neither yet. The real gap is that rituals barely get walked, and a reading surface does not fix that',
  },
  { id: 'other', label: 'Something else' },
]

export function PreferScene() {
  const [preference, setPreference] = useState<Preference | null>(null)
  const [otherDetail, setOtherDetail] = useState('')
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!preference) {
      setError('Pick one option first.')
      return
    }
    if (preference === 'other' && !otherDetail.trim()) {
      setError('Tell us a little about the something else.')
      return
    }
    setError(null)
    setSending(true)
    try {
      await sendFeedback({ preference, otherDetail, notes })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="shell prefer">
        <p className="prefer__thanks">Sent — thank you.</p>
      </div>
    )
  }

  return (
    <form className="shell prefer" onSubmit={handleSubmit}>
      <p className="eyebrow">Last step</p>
      <h2 className="title">Which half of this is worth building?</h2>
      <div className="prefer__options">
        {OPTIONS.map((o) => (
          <label key={o.id} className="prefer__option">
            <input
              type="radio"
              name="pref"
              checked={preference === o.id}
              onChange={() => setPreference(o.id)}
            />
            {o.label}
          </label>
        ))}
      </div>
      {preference === 'other' ? (
        <textarea
          className="prefer__notes"
          value={otherDetail}
          onChange={(e) => setOtherDetail(e.target.value)}
          placeholder="What would you prefer?"
          rows={3}
        />
      ) : null}
      <textarea
        className="prefer__notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What did you notice? (optional)"
        rows={3}
      />
      {error ? <p className="prefer__error">{error}</p> : null}
      <button type="submit" className="prefer__submit" disabled={sending}>
        {sending ? 'Sending…' : 'Send my pick'}
      </button>
      <p className="prefer__fine">Sends to the Dayspring team · no account needed</p>
    </form>
  )
}
