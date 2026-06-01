import { useEffect, useRef, useState } from 'react'
import { createSpiritualItem, fetchScripturePassages } from '@/lib/spiritual'
import type { ScripturePassage } from '@/lib/types'

interface Props {
  entryId: string | null
  entryContent: string
  onInsert: (text: string) => void
  onClose: () => void
}

export function ScriptureModal({ entryId, entryContent, onInsert, onClose }: Props) {
  const hasContent = entryContent.trim().length > 20
  const [query, setQuery] = useState('')
  const [passages, setPassages] = useState<ScripturePassage[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-fetch if the entry has enough content.
  useEffect(() => {
    if (!hasContent) {
      inputRef.current?.focus()
      return
    }
    void search(entryContent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function search(text: string) {
    setLoading(true)
    setError(null)
    try {
      const results = await fetchScripturePassages(text)
      setPassages(results)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not reach scripture search'
      setError(msg === 'Load failed' ? 'Could not reach the server. Try again after updating the app.' : msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(p: ScripturePassage) {
    try {
      await createSpiritualItem({
        entry_id: entryId,
        type: 'scripture',
        content: p.text,
        metadata: { reference: p.reference, reason: p.reason },
      })
    } catch {
      // Non-fatal — still insert the passage
    }
    onInsert(`\n*${p.text}* — ${p.reference}\n`)
    onClose()
  }

  return (
    <div className="reflect-modal-scrim" onClick={onClose}>
      <div
        className="reflect-modal glass-surface"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Find scripture"
      >
        <div className="glass-surface__glow" aria-hidden />

        <header className="reflect-modal__header">
          <span className="reflect-modal__title">Scripture</span>
          <button className="reflect-modal__close btn btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {hasContent && (
          <blockquote className="reflect-modal__quote">
            {entryContent.trim().slice(0, 140)}
            {entryContent.trim().length > 140 ? '…' : ''}
          </blockquote>
        )}

        {!hasContent && !passages && (
          <div className="reflect-modal__section">
            <p className="reflect-modal__prompt">What's on your heart?</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (query.trim()) void search(query.trim())
              }}
            >
              <input
                ref={inputRef}
                className="reflect-modal__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="A word or topic…"
              />
              <button
                type="submit"
                className="btn"
                disabled={!query.trim() || loading}
                style={{ marginTop: '0.75rem', width: '100%' }}
              >
                {loading ? 'Searching…' : 'Search'}
              </button>
            </form>
          </div>
        )}

        {loading && !passages && (
          <p className="reflect-modal__loading">Finding passages…</p>
        )}

        {error && <p className="reflect-modal__error">{error}</p>}

        {passages && (
          <ul className="scripture-list">
            {passages.map((p) => (
              <li key={p.reference} className="scripture-item">
                <button
                  className="scripture-item__btn"
                  onClick={() => void handleSelect(p)}
                >
                  <strong className="scripture-item__ref">{p.reference}</strong>
                  <span className="scripture-item__text">{p.text}</span>
                  <span className="scripture-item__reason">{p.reason}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
