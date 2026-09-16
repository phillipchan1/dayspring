import { useMemo, useState } from 'react'
import { AnswerColumn } from '../components/AnswerColumn'
import { Masthead } from '../components/Masthead'
import { livingMovements, shelfOrder, totalAnswers } from '../data/model'
import { archiveFor, type Source } from '../lib/source'

/**
 * One practice, one movement at a time — which is how the composer hands the
 * ritual out in the first place. Showing all four movements' histories stacked
 * would flatten exactly the property the composer works to protect.
 */
export function Thread({
  source,
  onSource,
  practice,
  onPractice,
  onBack,
  onFocus,
}: {
  source: Source
  onSource: (s: Source) => void
  practice: string | null
  onPractice: (p: string) => void
  onBack: () => void
  onFocus: (practice: string, label: string) => void
}) {
  const archive = archiveFor(source)
  const threads = useMemo(
    () => shelfOrder(archive.threads).filter((t) => totalAnswers(t) > 0),
    [archive],
  )
  const thread = threads.find((t) => t.practice === practice) ?? threads[0]
  const movements = thread ? livingMovements(thread) : []
  const [labelState, setLabel] = useState<string | null>(null)
  const movement = movements.find((m) => m.label === labelState) ?? movements[0]

  if (!thread || !movement) {
    return (
      <div className="shell">
        <Masthead label="Rituals" source={source} onSource={onSource} onBack={onBack} />
        <h1 className="title">Nothing to thread</h1>
        <div className="empty">
          <strong>This archive has no answered movements.</strong>
          <br />
          Switch the source at the top to see the surface with writing in it.
        </div>
      </div>
    )
  }

  return (
    <div className="shell">
      <Masthead label="Rituals" source={source} onSource={onSource} onBack={onBack} />

      <h1 className="title">{thread.practice}</h1>

      {threads.length > 1 ? (
        <div className="rail" style={{ marginTop: '0.5rem' }}>
          {threads.map((t) => (
            <button
              key={t.practice}
              type="button"
              className="rail__btn"
              aria-pressed={t.practice === thread.practice}
              onClick={() => {
                onPractice(t.practice)
                setLabel(null)
              }}
            >
              {t.practice}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rail">
        {movements.map((m) => (
          <button
            key={m.label}
            type="button"
            className="rail__btn"
            aria-pressed={m.label === movement.label}
            onClick={() => setLabel(m.label)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className="question__label">{movement.label}</p>
      <h2 className="question">{movement.question || movement.label}</h2>
      <p className="question__sub">
        Your answers, newest first.{' '}
        <button
          type="button"
          className="masthead__back"
          style={{ textDecoration: 'underline' }}
          onClick={() => onFocus(thread.practice, movement.label)}
        >
          Open this one on its own
        </button>
      </p>

      <AnswerColumn answers={movement.answers} />
    </div>
  )
}
