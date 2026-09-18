import { useState } from 'react'
import { Composer } from '../components/Composer'
import { KIND_BY_ID, LECTIO } from '../kinds'
import { MARKED, PASSAGE, WORDS, bare } from '../data/sketch'

const LABELS = LECTIO.map((m) => m.label)
const CLOSE = LECTIO.length

/**
 * Lectio, walked.
 *
 * Four movements over one passage — which is the whole practice, and the thing
 * the current surface cannot do: it asks for the passage as typed prose at
 * movement one and has scrolled it away by movement two.
 */
export function Walk() {
  const [at, setAt] = useState(0)
  const [brought, setBrought] = useState<string | null>(null)
  const [word, setWord] = useState<string | null>(null)
  const [prayer, setPrayer] = useState('')

  const kind = LECTIO[at]?.kind
  const chosen = word ? word.replace(/-\d+$/, '') : null

  return (
    <section className="scene">
      <header className="scene__head">
        <p className="scene__eyebrow">
          Lectio Divina · movement {Math.min(at + 1, CLOSE)} of {CLOSE}
        </p>
        <h1 className="scene__title">The walk</h1>
        <p className="scene__gesture">
          {kind ? KIND_BY_ID.get(kind)?.gesture : 'One passage, read four times.'}
        </p>
      </header>

      <Composer
        movements={LABELS}
        at={at}
        onBack={at > 0 ? () => setAt(at - 1) : undefined}
        footer={
          at === CLOSE ? (
            <button type="button" className="rc__next" onClick={() => setAt(0)}>
              walk it again
            </button>
          ) : kind === 'dwell' ? (
            // No "next" on the movement whose content is stillness. The way out
            // is there, quietly, whenever the writer looks for it.
            <button type="button" className="rc__quiet" onClick={() => setAt(CLOSE)}>
              when you are ready
            </button>
          ) : (
            <button
              type="button"
              className="rc__next"
              disabled={at === 0 && !brought}
              onClick={() => setAt(at + 1)}
            >
              {at === 0 && !brought ? 'bring a passage first' : `Next: ${LABELS[at + 1]?.split(' — ')[0] ?? ''}`}
            </button>
          )
        }
      >
        {at === CLOSE ? (
          <div className="rc__inner rc__inner--still">
            <h2 className="close__name">Lectio Divina</h2>
            <p className="close__origin">Benedict of Nursia, 6th century</p>
            <p className="close__back">Back to your entry</p>
          </div>
        ) : (
          <div className="rc__inner">
            <span className="rc__label">{LECTIO[at].label}</span>

            {/* ── Bring ─────────────────────────────────────────────────── */}
            {kind === 'bring' ? (
              <>
                <p className="rc__q">{LECTIO[at].question}</p>
                {brought ? (
                  <div className="passage">
                    <p className="passage__ref">
                      {brought} <span className="passage__tr">{PASSAGE.translation}</span>
                    </p>
                    <p className="passage__text">{PASSAGE.text}</p>
                    <button type="button" className="passage__again" onClick={() => setBrought(null)}>
                      bring something else
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="field">A book, a chapter, a verse…</div>
                    <p className="or">or come back to one you marked</p>
                    <ul className="marked">
                      {MARKED.map((m) => (
                        <li key={m.ref}>
                          <button type="button" className="chipbtn" onClick={() => setBrought(m.ref)}>
                            <span>{m.ref}</span>
                            <span className="chipbtn__when">{m.when}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : null}

            {/* ── Mark ──────────────────────────────────────────────────── */}
            {kind === 'mark' ? (
              <>
                <p className="rc__q">{LECTIO[at].question}</p>
                <p className="passage__text passage__text--live">
                  {WORDS.map((w, n) => {
                    const key = `${bare(w)}-${n}`
                    return (
                      <button
                        key={key}
                        type="button"
                        className="word"
                        data-on={word === key ? 'true' : undefined}
                        onClick={() => setWord(word === key ? null : key)}
                      >
                        {w}
                      </button>
                    )
                  })}
                </p>
                {chosen ? (
                  <p className="record">— {chosen}</p>
                ) : (
                  <p className="hint">Touch a word. That is the whole movement.</p>
                )}
              </>
            ) : null}

            {/* ── Carry ─────────────────────────────────────────────────── */}
            {kind === 'carry' ? (
              <>
                {/* The passage stays, with the marked word still lit in it. The
                    third movement is prayed OUT of the second; two slides apart,
                    it is a change of subject. */}
                <div className="carried">
                  <span className="carried__label">{brought ?? PASSAGE.ref}</span>
                  <p className="carried__text">
                    {WORDS.map((w, n) => (
                      <span key={`${w}-${n}`} data-on={word === `${bare(w)}-${n}` ? 'true' : undefined}>
                        {w}{' '}
                      </span>
                    ))}
                  </p>
                </div>
                <p className="rc__q">
                  {chosen ? `“${chosen}” — what does it prompt you to say to God?` : LECTIO[at].question}
                </p>
                <textarea
                  className="write"
                  value={prayer}
                  onChange={(e) => setPrayer(e.target.value)}
                  placeholder="Speak it honestly, in your own words…"
                />
              </>
            ) : null}

            {/* ── Dwell ─────────────────────────────────────────────────── */}
            {kind === 'dwell' ? (
              <div className="still">
                {/* No timer, no ring closing, no count of minutes. A number on
                    this screen would be the one thing this movement is against. */}
                <div className="still__mark" aria-hidden />
                {chosen ? <p className="still__word">{chosen}</p> : null}
                <p className="still__line">Stay as long as you like.</p>
                <p className="still__small">Nothing to write here. Nothing is waiting.</p>
              </div>
            ) : null}
          </div>
        )}
      </Composer>
    </section>
  )
}
