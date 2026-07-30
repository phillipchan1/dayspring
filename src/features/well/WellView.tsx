import { useEffect, useRef, useState } from 'react'
import { ask, type AskResult } from '@/lib/ask'
import './Well.css'

interface Props {
  /** The question asked. Null = arrived with nothing to answer. */
  question: string | null
  onOpenEntry: (entryId: string) => void
  /** Reopen ⌘K, seeded with the question that's on screen. */
  onAskAgain: (seed: string) => void
}

/** Years marked under the shape strip. */
function axisYears(from: string, to: string): string[] {
  const a = new Date(from).getUTCFullYear()
  const b = new Date(to).getUTCFullYear()
  if (b <= a) return [String(a)]
  const span = b - a
  const step = Math.max(1, Math.round(span / 3))
  const out: string[] = []
  for (let y = a; y <= b; y += step) out.push(String(y))
  if (out[out.length - 1] !== String(b)) out.push(String(b))
  return out
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * THE WELL — Return's fourth destination, and the only surface in the app the
 * writer initiates. Ascent, Lamp, and Altar all decide what to show you; here
 * you ask.
 *
 * The answer opens with a SHAPE, not rows. Rows would be retrieval — the thing
 * the sidebar already does. The density strip says "loud for three years, then
 * nothing" before a single word is read, and the beats beneath it are the
 * writer's own sentences in TIME order, never relevance order: relevance
 * ordering destroys the arc, and the arc is the whole point.
 *
 * The app speaks exactly one line here (the shape line, about distribution only)
 * and otherwise gets out of the way — the same rule as the Ascent's summit.
 */
export function WellView({ question, onOpenEntry, onAskAgain }: Props) {
  const [result, setResult] = useState<AskResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drawn, setDrawn] = useState(0)
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

    // The wait is the feature: reading thousands of entries should look like it,
    // not like a spinner. The counter climbs while the request is in flight and
    // is capped short of 100% so it never claims to be done before it is.
    const started = Date.now()
    timerRef.current = window.setInterval(() => {
      const pct = Math.min(0.94, (Date.now() - started) / 4000)
      setDrawn(pct)
    }, 60)

    ask(question).then(
      (r) => {
        if (!alive) return
        setResult(r)
      },
      (e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Could not reach your journal.')
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

  if (!question) {
    return (
      <div className="well">
        <div className="well__inner">
          <header className="well__head">
            <p className="well__eyebrow">Return · The Well</p>
            <h1 className="well__title">Ask what you&rsquo;ve written.</h1>
            <p className="well__sub">Not keywords — the way you&rsquo;d say it out loud.</p>
          </header>
          <button className="btn well__open" onClick={() => onAskAgain('')}>
            Ask a question
          </button>
        </div>
      </div>
    )
  }

  const loading = !result && !error

  return (
    <div className="well">
      <div className="well__inner">
        <div className="well__q">
          <div className="well__q-l">
            <p className="well__eyebrow">Return · The Well</p>
            <h1 className="well__question">{question}</h1>
          </div>
          <button className="well__again" onClick={() => onAskAgain(question)}>
            Ask again
          </button>
        </div>

        {loading && (
          <div className="well__draw" aria-live="polite">
            <p className="well__draw-l">Reading your journal…</p>
            <div className="well__draw-bar" aria-hidden>
              <div className="well__draw-fill" style={{ width: `${drawn * 100}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="well__empty">
            <p className="well__empty-h">{error}</p>
            <p className="well__empty-s">
              Ask needs a connection — it searches meaning, which happens on the server. Find still
              works offline.
            </p>
          </div>
        )}

        {result && result.total === 0 && (
          <div className="well__empty">
            <p className="well__empty-h">Nothing in your journal answers that.</p>
            <p className="well__empty-s">
              Better to return nothing than a forced match. Try saying it a different way.
            </p>
          </div>
        )}

        {result && result.total > 0 && (
          <div className="well__answer">
            {result.span && (
              <section className="well__sect">
                <p className="well__label">
                  <span>The shape</span>
                  <span>
                    {new Date(result.span.from).getUTCFullYear()}–
                    {new Date(result.span.to).getUTCFullYear()}
                  </span>
                </p>
                <ShapeStrip buckets={result.buckets} />
                <div className="well__years">
                  {axisYears(result.span.from, result.span.to).map((y) => (
                    <span key={y}>{y}</span>
                  ))}
                </div>
                {result.shapeLine && <p className="well__read">{result.shapeLine}</p>}
              </section>
            )}

            {result.facts.length > 0 && (
              <section className="well__sect">
                <div className="well__facts">
                  {result.facts.map((f) => (
                    <div className="well__fact" key={f.label}>
                      <div className="well__fact-n">{f.value}</div>
                      <div className="well__fact-k">{f.label}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {result.beats.length > 0 && (
              <section className="well__sect">
                <p className="well__label">
                  <span>In your words</span>
                  <span>oldest first</span>
                </p>
                {result.beats.map((b) => (
                  <button
                    key={`${b.entry_id}-${b.tag}`}
                    className="well__beat"
                    onClick={() => onOpenEntry(b.entry_id)}
                  >
                    <span className="well__beat-w">
                      <b>{b.tag}</b>
                      {formatDate(b.date)}
                    </span>
                    <span className="well__beat-q">{b.text}</span>
                  </button>
                ))}
              </section>
            )}

            <section className="well__sect">
              <details className="well__how">
                <summary>How it found this</summary>
                <div className="well__how-b">
                  {result.expansion && (
                    <div className="well__leg">
                      <span className="well__leg-n">{result.legs.lexical}</span>
                      <div>
                        <p className="well__leg-t">
                          <b>Your words for it.</b> The Concordance expanded{' '}
                          <i>{result.expansion.canonical}</i> into the vocabulary you actually use,
                          so entries that never say the word still came back.
                        </p>
                        <div className="well__chips">
                          {result.expansion.forms.slice(0, 8).map((f) => (
                            <span className="well__chip" key={f}>
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="well__leg">
                    <span className="well__leg-n">{result.legs.vector}</span>
                    <div>
                      <p className="well__leg-t">
                        <b>Meaning, not spelling.</b>{' '}
                        {result.legs.lexical === 0
                          ? 'No keywords fired — every one of these came from what you meant, not what you typed.'
                          : 'Cosine search over your entries caught the ones that circle this without naming it.'}
                      </p>
                    </div>
                  </div>
                </div>
              </details>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

/** Match density across the corpus span. No axis, no score — you read your own weather. */
function ShapeStrip({ buckets }: { buckets: number[] }) {
  const max = Math.max(1, ...buckets)
  return (
    <div className="well__shape" aria-hidden>
      {buckets.map((n, i) => (
        <div
          key={i}
          className="well__tick"
          data-hit={n > 0 ? 'true' : undefined}
          style={{ height: `${n > 0 ? 14 + (n / max) * 86 : 6}%` }}
        />
      ))}
    </div>
  )
}
