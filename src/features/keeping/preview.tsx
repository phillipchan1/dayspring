// `?__preview=keeping` — private engine playground over authenticated entries.
//
// There are deliberately no journal fixtures in this file. The point is to
// judge the read against writing the reviewer knows, without ever committing
// that writing or the model's output to git. The route is dev-only in main.tsx.

import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { apiPost } from '@/lib/api'
import { deriveTitle } from '@/lib/entryLabels'
import { listEntries } from '@/lib/entries'
import type { Entry } from '@/lib/types'
import type {
  KeepingEntryReading,
  KeepingIngredient,
  KeepingMovement,
  KeepingSentiment,
} from './types'
import './preview.css'

type Dimension = 'boundary' | 'subjects' | 'sentiment' | 'story' | 'learning' | 'change'
type Verdict = 'right' | 'wrong'
type Verdicts = Record<string, Verdict>

const DIMENSIONS: Dimension[] = ['boundary', 'subjects', 'sentiment', 'story', 'learning', 'change']
const STORAGE_KEY = 'dayspring:keeping-playground-verdicts'

function loadVerdicts(): Verdicts {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Verdicts
  } catch {
    return {}
  }
}

function spreadSelection(entries: Entry[], count = 10): Set<string> {
  if (entries.length <= count) return new Set(entries.map((entry) => entry.id))
  const selected = new Set<string>()
  for (let i = 0; i < count; i++) {
    const index = Math.round((i * (entries.length - 1)) / (count - 1))
    const entry = entries[index]
    if (entry) selected.add(entry.id)
  }
  return selected
}

const pct = (value: number): string => `${Math.round(value * 100)}%`
const signed = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`

function Sentiment({ value }: { value: KeepingSentiment }) {
  if (!value.present) {
    return <span className="keeping-sentiment keeping-sentiment--none">no expressed emotion · {pct(value.confidence)} sure</span>
  }
  return (
    <div className="keeping-sentiment">
      <div className="keeping-sentiment__numbers">
        <span>valence {signed(value.valence)}</span>
        <span>activation {value.activation.toFixed(2)}</span>
        <span>confidence {pct(value.confidence)}</span>
      </div>
      <div className="keeping-valence" aria-label={`valence ${value.valence.toFixed(2)}`}>
        <i style={{ left: `${((value.valence + 1) / 2) * 100}%` }} />
      </div>
      <div className="keeping-emotions">
        {value.emotions.map((emotion) => (
          <span key={emotion.emotion}>
            {emotion.emotion} <small>{pct(emotion.intensity)}</small>
          </span>
        ))}
      </div>
    </div>
  )
}

function IngredientList({
  ingredients,
  kind,
}: {
  ingredients: KeepingIngredient[]
  kind: KeepingIngredient['kind']
}) {
  const rows = ingredients.filter((ingredient) => ingredient.kind === kind)
  return (
    <div className="keeping-ingredient">
      <b>{kind === 'change' ? 'change evidence' : kind}</b>
      {rows.length === 0 ? (
        <span className="keeping-empty">none</span>
      ) : (
        rows.map((row, index) => (
          <q key={`${row.quote}:${index}`}>
            {row.quote} <small>{pct(row.confidence)}</small>
          </q>
        ))
      )}
    </div>
  )
}

function VerdictControl({
  dimension,
  value,
  onChange,
}: {
  dimension: Dimension
  value?: Verdict
  onChange: (verdict: Verdict | null) => void
}) {
  return (
    <div className="keeping-verdict">
      <span>{dimension}</span>
      <button
        className={value === 'right' ? 'is-active' : ''}
        onClick={() => onChange(value === 'right' ? null : 'right')}
        title={`${dimension} is right`}
      >
        right
      </button>
      <button
        className={value === 'wrong' ? 'is-active is-wrong' : ''}
        onClick={() => onChange(value === 'wrong' ? null : 'wrong')}
        title={`${dimension} is wrong`}
      >
        wrong
      </button>
    </div>
  )
}

function MovementCard({
  movement,
  readingVersion,
  verdicts,
  setVerdict,
}: {
  movement: KeepingMovement
  readingVersion: string
  verdicts: Verdicts
  setVerdict: (key: string, verdict: Verdict | null) => void
}) {
  const verdictKey = (dimension: Dimension) => `${readingVersion}:${movement.id}:${dimension}`
  return (
    <article className="keeping-movement">
      <blockquote>{movement.quote}</blockquote>
      <div className="keeping-subjects">
        {movement.subjects.length === 0 ? (
          <span className="keeping-empty">no subjects joined</span>
        ) : (
          movement.subjects.map((subject) => (
            <span key={subject.key} data-kind={subject.kind}>
              {subject.label} <small>{subject.kind}</small>
            </span>
          ))
        )}
      </div>
      <Sentiment value={movement.sentiment} />
      <div className="keeping-ingredients">
        <IngredientList ingredients={movement.ingredients} kind="story" />
        <IngredientList ingredients={movement.ingredients} kind="learning" />
        <IngredientList ingredients={movement.ingredients} kind="change" />
      </div>
      <div className="keeping-verdicts">
        {DIMENSIONS.map((dimension) => (
          <VerdictControl
            key={dimension}
            dimension={dimension}
            value={verdicts[verdictKey(dimension)]}
            onChange={(verdict) => setVerdict(verdictKey(dimension), verdict)}
          />
        ))}
      </div>
    </article>
  )
}

function EntryResult({
  entry,
  reading,
  verdicts,
  setVerdict,
}: {
  entry: Entry
  reading: KeepingEntryReading
  verdicts: Verdicts
  setVerdict: (key: string, verdict: Verdict | null) => void
}) {
  const [sourceOpen, setSourceOpen] = useState(false)
  return (
    <section className="keeping-result">
      <header>
        <div>
          <time>{new Date(entry.created_at).toLocaleDateString()}</time>
          <h2>{entry.title || deriveTitle(entry.body_markdown)}</h2>
        </div>
        <button onClick={() => setSourceOpen((open) => !open)}>
          {sourceOpen ? 'hide source' : 'compare source'}
        </button>
      </header>
      {reading.truncated && <p className="keeping-warning">Only the first 20,000 characters were read.</p>}
      {sourceOpen && <pre className="keeping-source">{entry.body_markdown}</pre>}
      <div className="keeping-entry-score">
        <b>entry aggregate</b>
        <Sentiment value={reading.sentiment} />
      </div>
      {reading.movements.length === 0 ? (
        <p className="keeping-zero">The engine returned no meaningful movements.</p>
      ) : (
        reading.movements.map((movement) => (
          <MovementCard
            key={movement.id}
            movement={movement}
            readingVersion={reading.version}
            verdicts={verdicts}
            setVerdict={setVerdict}
          />
        ))
      )}
    </section>
  )
}

function KeepingPlayground() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [readings, setReadings] = useState<Record<string, KeepingEntryReading>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [running, setRunning] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [verdicts, setVerdicts] = useState<Verdicts>(loadVerdicts)

  useEffect(() => {
    void listEntries(60)
      .then((rows) => {
        const usable = rows.filter((entry) => entry.body_markdown.trim().length >= 40)
        setEntries(usable)
        setSelected(spreadSelection(usable))
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Could not load entries')
      })
      .finally(() => setLoading(false))
  }, [])

  const picked = useMemo(
    () => entries.filter((entry) => selected.has(entry.id)),
    [entries, selected],
  )
  const judged = Object.values(verdicts)
  const right = judged.filter((verdict) => verdict === 'right').length
  const wrong = judged.filter((verdict) => verdict === 'wrong').length

  const setVerdict = (key: string, verdict: Verdict | null) => {
    setVerdicts((current) => {
      const next = { ...current }
      if (verdict) next[key] = verdict
      else delete next[key]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else if (next.size < 10) next.add(id)
      return next
    })
  }

  const analyze = async () => {
    const queue = picked.filter((entry) => !running.has(entry.id))
    let cursor = 0
    const worker = async () => {
      for (;;) {
        const entry = queue[cursor++]
        if (!entry) return
        setRunning((current) => new Set(current).add(entry.id))
        setErrors((current) => {
          const next = { ...current }
          delete next[entry.id]
          return next
        })
        try {
          const result = await apiPost<KeepingEntryReading>('/api/keeping/read', {
            entryId: entry.id,
          })
          setReadings((current) => ({ ...current, [entry.id]: result }))
        } catch (error) {
          setErrors((current) => ({
            ...current,
            [entry.id]: error instanceof Error ? error.message : 'Read failed',
          }))
        } finally {
          setRunning((current) => {
            const next = new Set(current)
            next.delete(entry.id)
            return next
          })
        }
      }
    }
    await Promise.all([worker(), worker()])
  }

  return (
    <main className="keeping-playground">
      <header className="keeping-hero">
        <div>
          <p className="keeping-kicker">The Keeping · engine playground</p>
          <h1>Can it read one page correctly?</h1>
          <p>
            Your entries load from your authenticated account and are never stored by this
            playground. Results and verdicts remain in this browser.
          </p>
        </div>
        <div className="keeping-score">
          <strong>{judged.length ? pct(right / judged.length) : '—'}</strong>
          <span>{right} right · {wrong} wrong · {judged.length} judged</span>
        </div>
      </header>

      {loading && <p>Loading your entries…</p>}
      {loadError && (
        <p className="keeping-error">
          {loadError}. Open Dayspring normally and sign in on this origin before using the
          playground.
        </p>
      )}

      {!loading && !loadError && (
        <>
          <section className="keeping-picker">
            <div className="keeping-picker__bar">
              <div>
                <b>Choose up to ten entries</b>
                <span>{selected.size} selected from {entries.length}</span>
              </div>
              <button onClick={() => setSelected(spreadSelection(entries))}>spread across time</button>
              <button onClick={() => setSelected(new Set(entries.slice(0, 10).map((entry) => entry.id)))}>
                latest ten
              </button>
              <button className="keeping-run" disabled={!picked.length || running.size > 0} onClick={() => void analyze()}>
                {running.size ? `reading ${running.size}…` : `read ${picked.length}`}
              </button>
            </div>
            <div className="keeping-entry-list">
              {entries.map((entry) => (
                <label key={entry.id} className={selected.has(entry.id) ? 'is-selected' : ''}>
                  <input
                    type="checkbox"
                    checked={selected.has(entry.id)}
                    disabled={!selected.has(entry.id) && selected.size >= 10}
                    onChange={() => toggle(entry.id)}
                  />
                  <time>{new Date(entry.created_at).toLocaleDateString()}</time>
                  <span>{entry.title || deriveTitle(entry.body_markdown)}</span>
                  <small>{entry.word_count} words</small>
                  {running.has(entry.id) && <i>reading</i>}
                  {readings[entry.id] && <i>ready</i>}
                  {errors[entry.id] && <i className="is-error">failed</i>}
                </label>
              ))}
            </div>
          </section>

          {picked.map((entry) =>
            errors[entry.id] ? (
              <p className="keeping-error" key={entry.id}>{errors[entry.id]}</p>
            ) : readings[entry.id] ? (
              <EntryResult
                key={entry.id}
                entry={entry}
                reading={readings[entry.id]!}
                verdicts={verdicts}
                setVerdict={setVerdict}
              />
            ) : null,
          )}
        </>
      )}
    </main>
  )
}

export function renderKeepingPreview(): void {
  const host = document.getElementById('root')
  if (!host) return
  document.documentElement.dataset['theme'] = 'dawn'
  document.body.style.margin = '0'
  createRoot(host).render(<KeepingPlayground />)
}
