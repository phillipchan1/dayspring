import { useMemo, useRef, useState } from 'react'
import { ENTRIES, TODAY } from '../corpus'
import { formatDate, headingLabel, headingsUsed } from '../lib'

/**
 * The gesture.
 *
 * He types `##` and the words he has used before are there, most recently used
 * first. It is a completion, not a picker: he can ignore it and type anything,
 * and whatever he types becomes a domain because he typed it.
 *
 * Its real job is spelling. Without it `frontier` becomes frontier / Frontier /
 * Front, and everything downstream quietly splits in half. Same problem the
 * Concordance solves for names, same answer — fidelity, never meaning.
 */
export function HeadingView() {
  const today = ENTRIES[ENTRIES.length - 1]!
  const written = today.paragraphs.slice(0, 2)
  const alreadyHere = new Set(
    written.map(headingLabel).filter((x): x is string => x !== null),
  )

  const [typed, setTyped] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [raw, setRaw] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const offered = useMemo(
    () =>
      headingsUsed(TODAY)
        .filter((d) => !alreadyHere.has(d))
        .filter((d) => d.startsWith(typed.toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [typed],
  )

  const commit = (label: string) => {
    const clean = label.trim().toLowerCase()
    if (clean) setPicked(clean)
  }

  const rawText = [
    ...written,
    picked ? `## ${picked}` : `## ${typed}`,
  ].join('\n\n')

  return (
    <div className="desk">
      <div className="toggles" style={{ maxWidth: '52rem', margin: '0 auto 1rem' }}>
        <button className="toggle" data-on={raw ? 'true' : undefined} onClick={() => setRaw((v) => !v)}>
          what is in the file
        </button>
        {picked && (
          <button
            className="toggle"
            onClick={() => {
              setPicked(null)
              setTyped('')
              inputRef.current?.focus()
            }}
          >
            again
          </button>
        )}
      </div>

      <article className="leaf">
        <div className="leaf__date">{formatDate(TODAY)}</div>

        {raw ? (
          <div className="doc doc--raw">{rawText}</div>
        ) : (
          <div className="doc">
            {written.map((p, i) => {
              const label = headingLabel(p)
              return label ? <h2 key={i}>{label}</h2> : <p key={i}>{p}</p>
            })}

            {picked ? (
              <>
                <h2>{picked}</h2>
                <p>
                  <span className="caret" />
                </p>
              </>
            ) : (
              <div>
                <h2 style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: '0.8em' }}>
                    ##&nbsp;
                  </span>
                  <input
                    ref={inputRef}
                    className="doc__input"
                    autoFocus
                    value={typed}
                    placeholder=""
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commit(offered[0] ?? typed)
                      }
                      if (e.key === 'Tab' && offered[0]) {
                        e.preventDefault()
                        setTyped(offered[0])
                      }
                    }}
                  />
                </h2>

                {offered.length > 0 && (
                  <div className="complete">
                    <div className="complete__hint">you have written under</div>
                    {offered.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        data-on={i === 0 ? 'true' : undefined}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => commit(d)}
                      >
                        <span>{d}</span>
                        <span className="stamp">{i === 0 ? 'enter' : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </article>
    </div>
  )
}
