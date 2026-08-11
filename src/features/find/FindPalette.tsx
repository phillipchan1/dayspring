import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { guessVerb, shouldOfferAsk, type Verb } from './askVerb'
import {
  findBridge,
  findCount,
  findEntries,
  warmConcordance,
  warmFindCorpus,
  type FindBridge,
  type FindHit,
} from './findLocal'
import './Find.css'

interface Props {
  onClose: () => void
  /** Jump to an entry — Find is transit; the palette closes behind you. */
  onOpenEntry: (entryId: string) => void
  /** Escalate to Ask. Slow, costs a call, only ever on Return. */
  onAsk: (question: string) => void
  /** Seeds the field (e.g. the word under the cursor). */
  initialQuery?: string
}

type Row =
  | { kind: 'bridge'; bridge: FindBridge }
  | { kind: 'entry'; hit: FindHit }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * ⌘K — one line, two speeds.
 *
 * Typing runs Find: local substring search over the whole cached corpus, on every
 * keystroke, no network. Pressing Return on a question runs Ask, which leaves for
 * the server and comes back as a lit wall on Entries — the answer is the set of
 * pages it found, shown as a removable chip. Nothing here is a mode the writer sets — the
 * verb is guessed from what was typed and can always be overridden (Tab, or the
 * button), and an empty result set offers Ask by itself.
 */
export function FindPalette({ onClose, onOpenEntry, onAsk, initialQuery = '' }: Props) {
  const [query, setQuery] = useState(initialQuery)
  const [ready, setReady] = useState(false)
  const [lockedVerb, setLockedVerb] = useState<Verb | null>(null)
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Warm the local corpus + concordance before the first keystroke, so typing
  // never waits on IndexedDB.
  useEffect(() => {
    let alive = true
    void Promise.all([warmFindCorpus(), warmConcordance()]).then(() => {
      if (alive) setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  const hits = useMemo(() => (ready ? findEntries(query) : []), [query, ready])
  const total = useMemo(() => (ready ? findCount(query) : 0), [query, ready])
  const bridge = useMemo(() => (ready ? findBridge(query) : null), [query, ready])

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    if (bridge) out.push({ kind: 'bridge', bridge })
    for (const hit of hits) out.push({ kind: 'entry', hit })
    return out
  }, [bridge, hits])

  const empty = ready && query.trim().length > 0 && rows.length === 0
  const offersAsk = empty && shouldOfferAsk(query)
  const verb: Verb = lockedVerb ?? (offersAsk ? 'ask' : guessVerb(query))

  // The bridge sits first because it's the discovery — but it must not steal
  // Return from someone who typed a word to jump to an entry. Selection starts
  // on the first real hit whenever there is one.
  useEffect(() => {
    setSel(hits.length > 0 && bridge ? 1 : 0)
  }, [query, hits.length, bridge])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${sel}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const submit = useCallback(() => {
    const q = query.trim()
    if (!q) return
    const row = rows[sel]
    if (row?.kind === 'bridge') {
      onAsk(`tell me about ${row.bridge.canonical}`)
      return
    }
    if (verb === 'ask') {
      onAsk(q)
      return
    }
    if (row?.kind === 'entry') onOpenEntry(row.hit.entry.id)
  }, [query, rows, sel, verb, onAsk, onOpenEntry])

  const toggleVerb = useCallback(() => {
    setLockedVerb(verb === 'ask' ? 'find' : 'ask')
    inputRef.current?.focus()
  }, [verb])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(rows.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      toggleVerb()
    }
  }

  // Esc closes, in capture so it wins over focus mode's handler underneath.
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

  return (
    <div className="scrim glass-scrim find-scrim" onClick={onClose}>
      <div
        className="find glass-surface"
        role="dialog"
        aria-modal="true"
        aria-label="Find or ask"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-surface__glow" aria-hidden />

        <div className="find__q">
          <span className="find__q-icon" aria-hidden>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round">
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13 13l4 4" />
            </svg>
          </span>
          <input
            ref={inputRef}
            className="find__input"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLockedVerb(null)
            }}
            onKeyDown={onKeyDown}
            placeholder="a word, or a question"
            aria-label="Find a word, or ask a question"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="find__verb"
            data-verb={verb}
            onClick={toggleVerb}
            aria-label={
              verb === 'ask'
                ? 'Ask — searches meaning. Press to switch to Find.'
                : 'Find — searches words. Press to switch to Ask.'
            }
          >
            {verb === 'ask' ? 'ASK' : 'FIND'}
            <span className="find__verb-key" aria-hidden>↵</span>
          </button>
        </div>

        <div className="find__results" ref={listRef}>
          {!query.trim() && (
            <div className="find__hint">
              <p className="find__hint-h">Type a word to find it. Type a question to ask it.</p>
              <p className="find__hint-s">
                Find searches the words you wrote, instantly and offline. Ask searches what you
                meant.
              </p>
            </div>
          )}

          {bridge && (
            <button
              type="button"
              className="find__bridge"
              data-row={0}
              data-sel={sel === 0 ? 'true' : undefined}
              onMouseEnter={() => setSel(0)}
              onClick={submit}
            >
              <span className="find__bridge-main">
                <span className="find__bridge-h">
                  Ask about <b>{bridge.canonical}</b> across everything
                </span>
                {bridge.forms.length > 0 && (
                  <span className="find__bridge-s">also {bridge.forms.slice(0, 4).join(' · ')}</span>
                )}
              </span>
              {bridge.occurrences > 0 && (
                <span className="find__bridge-n">{bridge.occurrences} entries</span>
              )}
            </button>
          )}

          {rows.map((row, i) =>
            row.kind === 'entry' ? (
              <button
                key={row.hit.entry.id}
                type="button"
                className="find__row"
                data-row={i}
                data-sel={sel === i ? 'true' : undefined}
                onMouseEnter={() => setSel(i)}
                onClick={submit}
              >
                <span className="find__row-t">
                  {row.hit.snippet.before}
                  <mark>{row.hit.snippet.match}</mark>
                  {row.hit.snippet.after}
                </span>
                <span className="find__row-d">{formatDate(row.hit.entry.created_at)}</span>
              </button>
            ) : null,
          )}

          {empty && (
            <div className="find__hint">
              <p className="find__hint-h">No entry contains those words.</p>
              <p className="find__hint-s">
                {offersAsk ? (
                  <>
                    Press <b>Return</b> to ask instead — that searches meaning, not spelling.
                  </>
                ) : (
                  <>Try fewer words, or a different spelling.</>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="find__foot">
          <span>
            <kbd className="kbd">↑↓</kbd> move
          </span>
          <span>
            <kbd className="kbd">↵</kbd> {verb === 'ask' ? 'ask' : 'open'}
          </span>
          <span>
            <kbd className="kbd">tab</kbd> switch
          </span>
          <span>
            <kbd className="kbd">esc</kbd> close
          </span>
          {total > hits.length && (
            <span className="find__foot-count">{total} entries contain this</span>
          )}
        </div>
      </div>
    </div>
  )
}
