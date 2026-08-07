import { useEffect, useMemo, useRef, useState } from 'react'
import { ask, type AskResult } from '@/lib/ask'
import type { Passage, PassageSource } from '@/lib/remember'
import { PassageList } from './PassageList'
import { SourceChips } from './SourceChips'
import { WeatherGrid } from './WeatherGrid'
import { buildFacts, buildWeather } from './weather'
import './Remember.css'

interface Props {
  /** The question asked. Null = at rest, showing what's already been set apart. */
  question: string | null
  /** Everything the writer has set apart, newest first. */
  passages: Passage[]
  /** False while the local corpus is still being read out of IndexedDB. */
  ready: boolean
  onOpenEntry: (entryId: string) => void
  /** Reopen ⌘K, seeded with the question on screen. */
  onAskAgain: (seed: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * The way in. Looks like a field, behaves like a button: tapping it opens the
 * ⌘K palette, which owns the actual Find/Ask logic.
 *
 * It is not a real input on purpose — two search boxes that behave differently
 * is how you end up with the sidebar filter problem. This one is a door to the
 * single palette, and it is the ONLY way to reach Ask on touch, where there is
 * no keyboard shortcut to fall back on.
 */
function SearchDoor({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="rem__door" onClick={onOpen}>
      <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" aria-hidden>
        <circle cx="9" cy="9" r="5.5" />
        <path d="M13 13l4 4" />
      </svg>
      <span className="rem__door-t">a word, or a question</span>
      <kbd className="kbd rem__door-k">⌘K</kbd>
    </button>
  )
}

/** The facts row. Every number here is counted in code — nothing is inferred. */
function Facts({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="rem__facts">
      {items.map((f) => (
        <div className="rem__fact" key={f.label}>
          <div className="rem__fact-n">{f.value}</div>
          <div className="rem__fact-k">{f.label}</div>
        </div>
      ))}
    </div>
  )
}

/**
 * REMEMBER — the only surface the writer initiates.
 *
 * At rest it shows what they already set apart: marks, blockquotes, emphasis,
 * declared prayers. That resting state is the reason this can be a destination
 * at all — the old Well opened blank and demanded a query you didn't have,
 * which is why it stayed behind a flag.
 *
 * Asked a question, it answers with the same shape: facts, then the weather,
 * then the writer's own sentences in TIME order, never relevance order —
 * relevance ordering destroys the arc, and the arc is the point.
 *
 * The app writes no prose here. It counts, and it gets out of the way.
 */
export function RememberView({ question, passages, ready, onOpenEntry, onAskAgain }: Props) {
  const [result, setResult] = useState<AskResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drawn, setDrawn] = useState(0)
  const [source, setSource] = useState<PassageSource | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!question) {
      setResult(null)
      setError(null)
      return
    }
    let alive = true
    setResult(null)
    setError(null)
    setDrawn(0)

    const started = Date.now()
    timerRef.current = window.setInterval(() => {
      setDrawn(Math.min(0.94, (Date.now() - started) / 4000))
    }, 60)

    ask(question).then(
      (r) => {
        if (alive) setResult(r)
      },
      (e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Could not reach your journal.')
      },
    )

    return () => {
      alive = false
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [question])

  useEffect(() => {
    if ((result || error) && timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [result, error])

  // Filters are client-side over an already-loaded set: picking a source or
  // folding a month must never cost a round trip.
  const shown = useMemo(() => {
    let out = source ? passages.filter((p) => p.source === source) : passages
    if (month != null) out = out.filter((p) => new Date(p.date).getUTCMonth() === month)
    return out
  }, [passages, source, month])

  // The grid is drawn over the SOURCE-filtered set but not the month-filtered
  // one — folding a month must not erase the other months you're comparing it to.
  const gridSet = useMemo(
    () => (source ? passages.filter((p) => p.source === source) : passages),
    [passages, source],
  )
  const weather = useMemo(() => buildWeather(gridSet.map((p) => p.date)), [gridSet])
  const facts = useMemo(() => buildFacts(shown.map((p) => p.date)), [shown])

  // ── at rest ───────────────────────────────────────────────────────────────
  if (!question) {
    if (!ready) return <div className="rem" aria-busy="true" />

    if (passages.length === 0) {
      return (
        <div className="rem">
          <div className="rem__inner">
            <SearchDoor onOpen={() => onAskAgain('')} />
            <div className="rem__empty">
              <p className="rem__empty-h">Nothing set apart yet.</p>
              <p className="rem__empty-s">
                Select a line in something you wrote and mark it. Anything you emphasise or
                quote lands here too.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="rem">
        <div className="rem__inner">
          <SearchDoor onOpen={() => onAskAgain('')} />
          <Facts
            items={[
              { value: String(facts.count), label: facts.count === 1 ? 'passage' : 'passages' },
              ...(facts.first ? [{ value: facts.first, label: 'first' }] : []),
              ...(facts.latest ? [{ value: facts.latest, label: 'most recent' }] : []),
              ...(facts.longestSilence >= 2
                ? [{ value: `${facts.longestSilence} mo`, label: 'longest silence' }]
                : []),
            ]}
          />
          <WeatherGrid weather={weather} month={month} onMonth={setMonth} />
          {/* Counts come from the UNFILTERED set: a chip has to keep showing what
              it would give you, or picking one makes the others read as empty. */}
          <SourceChips
            passages={passages}
            active={source}
            onPick={(s) => {
              setSource(s)
              setMonth(null)
            }}
          />
          {shown.length === 0 ? (
            <div className="rem__empty">
              <p className="rem__empty-h">Nothing in that stretch.</p>
            </div>
          ) : (
            <PassageList passages={shown} onOpenEntry={onOpenEntry} />
          )}
        </div>
      </div>
    )
  }

  // ── an answer ─────────────────────────────────────────────────────────────
  const loading = !result && !error

  return (
    <div className="rem">
      <div className="rem__inner">
        <SearchDoor onOpen={() => onAskAgain('')} />
        <div className="rem__q">
          <h1 className="rem__question">{question}</h1>
          <button className="rem__again" onClick={() => onAskAgain(question)}>
            Ask again
          </button>
        </div>

        {loading && (
          <div className="rem__draw" aria-live="polite">
            <p className="rem__draw-l">Reading your journal…</p>
            <div className="rem__draw-bar" aria-hidden>
              <div className="rem__draw-fill" style={{ width: `${drawn * 100}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="rem__empty">
            <p className="rem__empty-h">{error}</p>
            <p className="rem__empty-s">
              Ask needs a connection — it searches meaning, which happens on the server. Find
              still works offline.
            </p>
          </div>
        )}

        {result && result.total === 0 && (
          <div className="rem__empty">
            <p className="rem__empty-h">Nothing in your journal answers that.</p>
            <p className="rem__empty-s">
              Better to return nothing than a forced match. Try saying it a different way.
            </p>
          </div>
        )}

        {result && result.total > 0 && (
          <>
            {result.facts.length > 0 && <Facts items={result.facts} />}

            {result.months && result.span && (
              <WeatherGrid
                weather={weatherFromMonths(result.months, result.span.from)}
                month={month}
                onMonth={setMonth}
                noun="entry"
                nounPlural="entries"
              />
            )}

            {result.beats.length > 0 && (
              <section className="rem__sect">
                <p className="rem__label">
                  <span>In your words</span>
                  <span>oldest first</span>
                </p>
                {result.beats.map((b) => (
                  <button
                    key={`${b.entry_id}-${b.tag}`}
                    className="rem__beat"
                    onClick={() => onOpenEntry(b.entry_id)}
                  >
                    <span className="rem__beat-w">
                      <b>{b.tag}</b>
                      {formatDate(b.date)}
                    </span>
                    <span className="rem__beat-q">{b.text}</span>
                  </button>
                ))}
              </section>
            )}

            <details className="rem__how">
              <summary>How it found this</summary>
              <div className="rem__how-b">
                {result.expansion && (
                  <div className="rem__leg">
                    <span className="rem__leg-n">{result.legs.lexical}</span>
                    <div>
                      <p className="rem__leg-t">
                        <b>Your words for it.</b> The Concordance expanded{' '}
                        <i>{result.expansion.canonical}</i> into the vocabulary you actually use,
                        so entries that never say the word still came back.
                      </p>
                      <div className="rem__chips2">
                        {result.expansion.forms.slice(0, 8).map((f) => (
                          <span className="rem__chip2" key={f}>
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="rem__leg">
                  <span className="rem__leg-n">{result.legs.vector}</span>
                  <p className="rem__leg-t">
                    <b>Meaning, not spelling.</b>{' '}
                    {result.legs.lexical === 0
                      ? 'No keywords fired — every one of these came from what you meant, not what you typed.'
                      : 'Cosine search over your entries caught the ones that circle this without naming it.'}
                  </p>
                </div>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * The server sends month counts from the corpus start; the grid wants a
 * year × month matrix. Rebuild it here rather than shipping a second shape.
 */
function weatherFromMonths(months: number[], from: string): ReturnType<typeof buildWeather> {
  const start = new Date(from)
  const dates: string[] = []
  for (let i = 0; i < months.length; i++) {
    const n = months[i] ?? 0
    if (n === 0) continue
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 15))
    for (let k = 0; k < n; k++) dates.push(d.toISOString())
  }
  return buildWeather(dates)
}
