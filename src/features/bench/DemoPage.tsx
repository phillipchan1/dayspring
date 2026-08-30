// The sandbox — demo entries, and what the engine makes of them.
//
// Dev-only, reachable at `?__preview=noticing`, so it needs no login, no
// Supabase and no account. Everything on it is synthetic: the 130-entry
// recognition corpus, hand-authored with hand-labelled expected output. Edit
// any of it freely — the engine re-runs on every keystroke, which is the whole
// point. You cannot learn how something behaves by reading its output once.
//
// What is honest about this page: it runs the REAL functions, not a mock of
// them. `parseReferences`, `parseSpiritualBlocks` and `markingsNearSubject` are
// the same code the save path calls. What it cannot run is the model half — the
// harvest and the subject tagger cost money and need a server — so those are
// shown as the corpus's expectation, labelled as such, never dressed up as a
// live result.

import { useMemo, useState } from 'react'
import { CORPUS, DEFECTS, type LoadedEntry } from '@/lib/recognition/corpus'
import { NEAR_LINES } from '@/lib/subjectJoin'
import { runDemo } from './demo'
import './Bench.css'

const CATEGORY_ORDER = (a: LoadedEntry, b: LoadedEntry) =>
  a.category.localeCompare(b.category) || a.id.localeCompare(b.id)

export function DemoPage() {
  const entries = useMemo(() => [...CORPUS].sort(CATEGORY_ORDER), [])
  const [id, setId] = useState(entries[0]?.id ?? '')
  const entry = useMemo(() => entries.find((e) => e.id === id) ?? null, [entries, id])
  const [body, setBody] = useState(entry?.body ?? '')
  const [within, setWithin] = useState(NEAR_LINES)
  const [treatAsPerson, setTreatAsPerson] = useState(false)

  // Selecting a different entry replaces the text; editing keeps it.
  const [lastId, setLastId] = useState(id)
  if (lastId !== id) {
    setLastId(id)
    setBody(entry?.body ?? '')
  }

  const personForms = useMemo(
    () =>
      treatAsPerson && entry
        ? (entry.entities ?? []).filter((e) => e.kind === 'person').map((e) => e.canonical)
        : [],
    [treatAsPerson, entry],
  )

  const run = useMemo(
    () => runDemo(body, entry, within, personForms),
    [body, entry, within, personForms],
  )

  const byCategory = useMemo(() => {
    const m = new Map<string, LoadedEntry[]>()
    for (const e of entries) {
      const held = m.get(e.category)
      if (held) held.push(e)
      else m.set(e.category, [e])
    }
    return [...m.entries()]
  }, [entries])

  return (
    <div className="demo">
      <header className="demo__head">
        <div>
          <h1 className="demo__title">The Noticing — sandbox</h1>
          <p className="demo__subtitle">
            {CORPUS.length} synthetic entries with known right answers. Nothing here came from a
            real journal. Edit the text and the engine re-runs.
          </p>
        </div>
      </header>

      <div className="demo__grid">
        {/* ── input ─────────────────────────────────────────────────── */}
        <section className="demo__col">
          <label className="demo__field">
            <span>demo entry</span>
            <select value={id} onChange={(e) => setId(e.target.value)}>
              {byCategory.map(([cat, list]) => (
                <optgroup key={cat} label={cat}>
                  {list.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.id}
                      {e.defect ? '  ⚠ known defect' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <textarea
            className="demo__body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
            rows={18}
          />

          <div className="demo__controls">
            <label>
              <span>near = {within} lines</span>
              <input
                type="range"
                min={0}
                max={10}
                value={within}
                onChange={(e) => setWithin(Number(e.target.value))}
              />
            </label>
            <label className="demo__check">
              <input
                type="checkbox"
                checked={treatAsPerson}
                onChange={(e) => setTreatAsPerson(e.target.checked)}
              />
              <span>
                treat this page’s people as people
                <em>
                  {' '}
                  — the `personForms` guard: a book name you use for a person needs a verse
                </em>
              </span>
            </label>
          </div>

          {entry?.defect && (
            <p className="bench__notice">
              <strong>Known defect — {entry.defect}.</strong> {DEFECTS[entry.defect]?.summary}
              {entry.note ? ` ${entry.note}` : ''}
            </p>
          )}
        </section>

        {/* ── output ────────────────────────────────────────────────── */}
        <section className="demo__col">
          <h2 className="bench__h">Scripture — {run.refs.length} found</h2>
          <p className="bench__note">
            Live. This is <code>parseReferences</code>, the same function the save path runs.
          </p>
          <ul className="demo__rows">
            {run.refs.map((r, i) => (
              <li key={`${r.osis}-${i}`} className={r.expected ? 'is-good' : 'is-unexpected'}>
                <code>{r.osis}</code>
                <span className="bench__note">
                  chars {r.charStart}–{r.charEnd}
                  {r.confidence < 1 ? ` · confidence ${r.confidence}` : ''}
                  {entry?.refs ? (r.expected ? ' · expected' : ' · NOT expected') : ''}
                </span>
              </li>
            ))}
            {run.refs.length === 0 && <li className="bench__note">nothing</li>}
            {run.missedRefs.map((o) => (
              <li key={`miss-${o}`} className="is-missed">
                <code>{o}</code>
                <span className="bench__note">expected · not found</span>
              </li>
            ))}
          </ul>

          <h2 className="bench__h">Markings — {run.markings.length}</h2>
          <ul className="demo__rows">
            {run.markings.map((m) => (
              <li key={m.id} className={m.origin === 'fence' ? 'is-good' : ''}>
                <code>{m.type}</code>
                <span className="demo__quote">{m.content.slice(0, 90)}</span>
                <span className="bench__note">
                  {m.origin === 'fence' ? 'typed · exact offset' : 'the model should find this'}
                  {m.charStart == null ? ' · UNPLACEABLE' : ''}
                </span>
              </li>
            ))}
            {run.markings.length === 0 && <li className="bench__note">nothing</li>}
          </ul>

          <h2 className="bench__h">Subject × marking</h2>
          <p className="bench__note">
            The join, live. Distance is a filter and never a sort — order is the order it was
            written.
          </p>
          {run.joined.length === 0 && <p className="bench__note">no subjects on this entry</p>}
          {run.joined.map((j) => (
            <div key={j.subject} className="demo__join">
              <h3 className="bench__h4">{j.subject}</h3>
              {j.markings.length === 0 && j.refs.length === 0 && (
                <p className="bench__note">nothing within {within} lines</p>
              )}
              <ul className="demo__rows">
                {j.refs.map((r, i) => (
                  <li key={`r${i}`}>
                    <code>{r.osis}</code>
                    <span className="bench__note">
                      {r.distance === 0 ? 'same line' : `${r.distance} away`}
                    </span>
                  </li>
                ))}
                {j.markings.map((m, i) => (
                  <li key={`m${i}`}>
                    <code>{m.type}</code>
                    <span className="demo__quote">{m.text.slice(0, 70)}</span>
                    <span className="bench__note">
                      {m.distance === 0 ? 'same line' : `${m.distance} away`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
