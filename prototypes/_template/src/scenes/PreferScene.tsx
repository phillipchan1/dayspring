import { useState, type FormEvent } from 'react'
import { sendFeedback, type Preference } from '../lib/feedback'

const OPTIONS: { id: Preference; label: string }[] = [
  { id: 'A', label: 'Option A' },
  { id: 'B', label: 'Option B' },
  { id: 'C', label: 'Option C' },
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
      <div className="paper prefer">
        <p className="prefer__thanks">Sent — thank you.</p>
      </div>
    )
  }

  return (
    <form className="paper prefer" onSubmit={handleSubmit}>
      <h2 className="prefer__title">What feels most right?</h2>
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
        placeholder="Anything else? (optional)"
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
