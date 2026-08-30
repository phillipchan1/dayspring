// The bench — what the engine is producing, on the real archive.
//
// Internal, flag-gated, and never shipped to a reader. It exists because four
// defects sat in the live data for months with nowhere to become visible: a
// weather footer parsed as scripture, a pronoun sitting in a subject's
// spellings, one name filed under two kinds, and the marking kind fused into a
// subject's identity. None of them was hidden. None of them had a face.
//
// Two rules it inherits and must keep. Every number is a count of a mechanical
// defect in our own derived tables, never a quality score of anyone's journal
// (Principle 1). And distance is a filter, never a sort — the histogram exists
// so NEAR_LINES can be an argued number, not so anything gets ranked by
// closeness (D-016).

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { NEAR_LINES } from '@/lib/subjectJoin'
import { benchSubjects, loadBench, type BenchData } from './data'
import { measureJoin, measureMarkings, measureVocabulary, subjectMatcher } from './measure'
import './Bench.css'

interface Props {
  onClose: () => void
}

export function BenchDrawer({ onClose }: Props) {
  const [data, setData] = useState<BenchData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [within, setWithin] = useState(NEAR_LINES)

  useEffect(() => {
    let cancelled = false
    loadBench()
      .then((d) => {
        if (cancelled) return
        setData(d)
        setSubject(benchSubjects(d)[0]?.label ?? '')
      })
      .catch(() => {
        if (!cancelled) setError('Couldn’t read the archive just now.')
      })
    return () => {
      cancelled = true
    }
  }, [])

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

  const marks = useMemo(() => (data ? measureMarkings(data.markings, data.bodies) : null), [data])
  const vocab = useMemo(
    () => (data ? measureVocabulary(data.concordance, data.matters) : null),
    [data],
  )
  const join = useMemo(
    () =>
      data && subject.trim()
        ? measureJoin(data.bodies, data.byEntry, subjectMatcher(subject), within)
        : null,
    [data, subject, within],
  )
  const subjects = useMemo(() => (data ? benchSubjects(data) : []), [data])
  const origin = useMemo(
    () => subjects.find((s) => s.label.toLowerCase() === subject.trim().toLowerCase())?.origin,
    [subjects, subject],
  )

  return createPortal(
    <div className="scrim glass-scrim bench-scrim" onClick={onClose}>
      <aside
        className="bench glass-surface"
        role="dialog"
        aria-modal="true"
        aria-label="The bench"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="bench__head">
          <div>
            <h2 className="bench__title">The bench</h2>
            <p className="bench__subtitle">
              What the engine is producing, counted. Internal — never a reading of anyone’s
              journal.
            </p>
          </div>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close">
            Done
          </button>
        </header>

        {error && <p className="bench__empty">{error}</p>}
        {!data && !error && <p className="bench__empty">Reading the archive…</p>}

        {data && marks && vocab && (
          <>
            {!data.positionsMigrated && (
              <p className="bench__notice">
                <code>spiritual_items.char_start</code> is not there yet — migration{' '}
                <code>20260829120000_marking_positions</code> has not been applied. Everything below
                falls back to searching each marking’s text back into its page.
              </p>
            )}

            {/* ── markings ─────────────────────────────────────────────── */}
            <section className="bench__section">
              <h3 className="bench__h">Markings — {marks.total.toLocaleString()}</h3>
              <table className="bench__table">
                <tbody>
                  {marks.byKind.map((k) => (
                    <tr key={k.kind}>
                      <td>{k.kind}</td>
                      <td className="bench__n">{k.count.toLocaleString()}</td>
                      <td className="bench__note">
                        {k.count === 0 ? 'never once used' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="bench__stats">
                <div>
                  <dt>the writer typed</dt>
                  <dd>{marks.declared.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>the journal noticed</dt>
                  <dd>{marks.scanned.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>placed by stored offset</dt>
                  <dd>{marks.located.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>found by searching</dt>
                  <dd>{marks.findable.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>no honest position</dt>
                  <dd>{marks.unplaceable.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>no entry left</dt>
                  <dd>{marks.orphaned.toLocaleString()}</dd>
                </div>
              </dl>
            </section>

            {/* ── the two vocabularies ─────────────────────────────────── */}
            <section className="bench__section">
              <h3 className="bench__h">Subjects</h3>
              <dl className="bench__stats">
                <div>
                  <dt>names (Concordance)</dt>
                  <dd>{vocab.names.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>matters (Altar)</dt>
                  <dd>{vocab.matters.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>known to both</dt>
                  <dd>{vocab.shared.length.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>matters no name-finder reaches</dt>
                  <dd>{vocab.mattersOnly.toLocaleString()}</dd>
                </div>
              </dl>

              <h4 className="bench__h4">
                One name, two kinds — {vocab.kindSplits.length}
              </h4>
              <p className="bench__note">Two half-lit piles of the same subject.</p>
              <ul className="bench__list">
                {vocab.kindSplits.slice(0, 12).map((s) => (
                  <li key={s.canonical}>
                    <strong>{s.canonical}</strong> — {s.kinds.join(' · ')}
                  </li>
                ))}
                {vocab.kindSplits.length === 0 && <li className="bench__note">none</li>}
              </ul>

              <h4 className="bench__h4">
                A pronoun used as a spelling — {vocab.pronounForms.length}
              </h4>
              <p className="bench__note">
                Lights every page in the archive; costs precision on every other subject.
              </p>
              <ul className="bench__list">
                {vocab.pronounForms.slice(0, 12).map((s) => (
                  <li key={s.canonical}>
                    <strong>{s.canonical}</strong> — {s.forms.map((f) => `“${f}”`).join(', ')}
                  </li>
                ))}
                {vocab.pronounForms.length === 0 && <li className="bench__note">none</li>}
              </ul>
            </section>

            {/* ── the join ─────────────────────────────────────────────── */}
            <section className="bench__section">
              <h3 className="bench__h">Subject × marking</h3>
              <div className="bench__controls">
                <label>
                  <span>subject</span>
                  <input
                    list="bench-subjects"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Esther"
                  />
                  <datalist id="bench-subjects">
                    {subjects.slice(0, 400).map((s) => (
                      <option key={`${s.origin}:${s.label}`} value={s.label}>
                        {s.origin}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label>
                  <span>within {within} lines</span>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    value={within}
                    onChange={(e) => setWithin(Number(e.target.value))}
                  />
                </label>
              </div>

              {join && origin === 'matter' && join.pages === 0 && (
                <p className="bench__notice">
                  <strong>A matter cannot be found by looking for its name.</strong> “{subject}” is
                  a label the model gave a group of prayer and sense lines — nobody wrote the words
                  “{subject}” on a page, so a literal search finds nothing. Names (Esther, Chicago)
                  join by matching the prose; matters have to join through the lines they were
                  derived from. Two vocabularies, two join paths — this panel currently only walks
                  the first.
                </p>
              )}

              {join && (
                <>
                  <dl className="bench__stats">
                    <div>
                      <dt>pages naming it</dt>
                      <dd>{join.pages.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>markings on those pages</dt>
                      <dd>{join.onPage.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>markings beside a mention</dt>
                      <dd>{join.near.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>survives the join</dt>
                      <dd>
                        {join.onPage === 0
                          ? '—'
                          : `${Math.round((100 * join.near) / join.onPage)}%`}
                      </dd>
                    </div>
                  </dl>

                  <h4 className="bench__h4">By distance</h4>
                  <p className="bench__note">
                    What widening would admit. Distance is a filter here and never a sort.
                  </p>
                  <ul className="bench__bars">
                    {join.histogram.map((n, d) => (
                      <li key={d}>
                        <span className="bench__bar-label">
                          {d === 0 ? 'same line' : `${d} away`}
                        </span>
                        <span
                          className="bench__bar"
                          style={{
                            inlineSize: `${Math.round(
                              (100 * n) / Math.max(1, Math.max(...join.histogram)),
                            )}%`,
                          }}
                        />
                        <span className="bench__n">{n}</span>
                      </li>
                    ))}
                  </ul>

                  {join.byKind.length > 0 && (
                    <p className="bench__note">
                      {join.byKind.map((k) => `${k.count} ${k.kind}`).join(' · ')}
                    </p>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </aside>
    </div>,
    document.body,
  )
}
