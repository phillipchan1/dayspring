import { useState, type FormEvent } from 'react'
import { PREFERENCE_OPTIONS, sendFeedback, type Preference } from '../lib/feedback'

const OPTION_DETAIL: Record<Exclude<Preference, 'other'>, string> = {
  A: 'Link out to ESV.org when I want the full chapter',
  B: 'Read this chapter beside my journal — ESV.org when I want to go deeper',
}

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
      setError(err instanceof Error ? err.message : 'Could not send just now.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="paper prefer">
        <div className="prefer__body">
          <p className="prefer__eyebrow">6 of 6</p>
          <h1 className="prefer__title">Thank you</h1>
          <p className="prefer__lede">Your pick is on its way. You can close this tab.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="paper prefer">
      <form className="prefer__body" onSubmit={(e) => void handleSubmit(e)}>
        <p className="prefer__eyebrow">6 of 6</p>
        <h1 className="prefer__title">How should reading around a verse work?</h1>
        <p className="prefer__lede">
          Pasted verses landing automatically is coming either way. This pick is only about
          reading the chapter — A, B, or something else.
        </p>

        <fieldset className="prefer__options">
          <legend className="prefer__sr-only">Your preference</legend>
          {PREFERENCE_OPTIONS.map((opt) => (
            <label key={opt.id} className="prefer__option">
              <input
                type="radio"
                name="preference"
                value={opt.id}
                checked={preference === opt.id}
                onChange={() => setPreference(opt.id)}
              />
              <span className="prefer__option-label">
                {opt.id === 'other' ? (
                  <>
                    <strong>Something else</strong>
                    <span className="prefer__option-detail">A different direction entirely</span>
                  </>
                ) : (
                  <>
                    <strong>Idea {opt.id}</strong>
                    <span className="prefer__option-detail">{OPTION_DETAIL[opt.id]}</span>
                  </>
                )}
              </span>
            </label>
          ))}
        </fieldset>

        {preference === 'other' && (
          <label className="prefer__field">
            <span className="prefer__field-label">What would you want instead?</span>
            <input
              type="text"
              value={otherDetail}
              onChange={(e) => setOtherDetail(e.target.value)}
              placeholder="e.g. I’d rather keep my Bible app open beside the journal"
            />
          </label>
        )}

        <label className="prefer__field">
          <span className="prefer__field-label">Anything else? (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What felt missing, confusing, or exciting?"
          />
        </label>

        {error && <p className="prefer__error">{error}</p>}

        <button type="submit" className="prefer__submit" disabled={sending}>
          {sending ? 'Sending…' : 'Send my pick'}
        </button>
        <p className="prefer__fine">Sends to the Dayspring team · no account needed</p>
      </form>
    </div>
  )
}
