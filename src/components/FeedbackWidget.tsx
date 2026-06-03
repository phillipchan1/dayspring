import { useState, useRef, useEffect } from 'react'
import { submitFeedback } from '@/lib/feedback'

// Master kill switch — set VITE_BETA_FEEDBACK_ENABLED=true in Vercel to enable
// the feature at all. Individual users also need is_beta=true on their profile.
const MASTER_ENABLED = import.meta.env.VITE_BETA_FEEDBACK_ENABLED === 'true'

type FeedbackType = 'bug' | 'idea' | 'other'
type Status = 'idle' | 'submitting' | 'done' | 'error'

interface Props {
  featureFlags: string[]
}

export function FeedbackWidget({ featureFlags }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [type, setType] = useState<FeedbackType>('idea')
  const [status, setStatus] = useState<Status>('idle')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && textareaRef.current) textareaRef.current.focus()
  }, [open])

  if (!MASTER_ENABLED || !featureFlags.includes('beta')) return null

  async function handleSubmit() {
    if (!message.trim() || status === 'submitting') return
    setStatus('submitting')
    try {
      await submitFeedback(message.trim(), type)
      setStatus('done')
      setTimeout(() => {
        setOpen(false)
        setMessage('')
        setType('idea')
        setStatus('idle')
      }, 1800)
    } catch {
      setStatus('error')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handleSubmit()
  }

  return (
    <div className="feedback-widget">
      {open && (
        <div className="feedback-popover" role="dialog" aria-label="Send feedback">
          <div className="feedback-popover__header">
            <span>beta feedback</span>
            <button
              className="feedback-popover__close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {status === 'done' ? (
            <p className="feedback-popover__done">Thanks! Sent ✓</p>
          ) : (
            <>
              <div className="feedback-popover__types">
                {(['bug', 'idea', 'other'] as FeedbackType[]).map((t) => (
                  <button
                    key={t}
                    className="feedback-type-btn"
                    data-active={type === t}
                    onClick={() => setType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                className="feedback-popover__textarea"
                placeholder="What's on your mind?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                disabled={status === 'submitting'}
              />
              {status === 'error' && (
                <p className="feedback-popover__error">Something went wrong — try again.</p>
              )}
              <div className="feedback-popover__footer">
                <span className="feedback-popover__hint">⌘↵ to send</span>
                <button
                  className="feedback-popover__submit"
                  onClick={() => void handleSubmit()}
                  disabled={!message.trim() || status === 'submitting'}
                >
                  {status === 'submitting' ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        className="feedback-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label="Send feedback"
        aria-expanded={open}
        data-open={open}
      >
        feedback
      </button>
    </div>
  )
}
