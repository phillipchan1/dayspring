import { useMemo, useState } from 'react'
import { SPAN_PAIRS, vocabularyDiff } from '../lib'

/**
 * The words she uses now, and the words she used then.
 *
 * This is the growth question answered without an axis. Kristi's sentence was
 * "growth is slow and it's tedious — I'm doing the same thing this year that I
 * was last year", and nothing else in the product can contradict that without
 * rendering a verdict. Two lists of her own vocabulary can, or can confirm it,
 * and either way every word in them is hers.
 *
 * It is legal because GUARDRAILS says it is: the sanctioned construction there
 * is "'Angry' appears in 7 entries this month" — a count over the writer's own
 * words, which is a fact about the text rather than a read on the person.
 *
 * Three rules hold it:
 *
 *   · No number next to any word. A frequency ranking would put whatever she
 *     said most at the top of a list titled with her own life, and order would
 *     become significance. These are ordered by when each word first appears.
 *   · The entry count for each span is on screen, always. Measured against this
 *     fixture, "the last two years against the two before" gives 59 words
 *     started and 9 stopped — which is not a change in how she writes, it is 36
 *     entries against 11. An uneven comparison reads as a verdict on the
 *     thinner side, and the only honest fix is to show the unevenness.
 *   · Archive-scoped, never person-scoped. The same two lists computed over the
 *     entries naming her husband would be a portrait of the marriage, and one
 *     bad month would put a bad word at the top of it.
 *
 * Falsified if the lists come out as circumstance — place names, school terms,
 * whatever season it was. Then the answer is a better list of common words, not
 * a model.
 */
export function WordsView() {
  const [pairId, setPairId] = useState(SPAN_PAIRS[0]!.id)
  const pair = SPAN_PAIRS.find((p) => p.id === pairId)!
  const diff = useMemo(() => vocabularyDiff(pair), [pair])

  return (
    <div className="desk">
      <div className="voc">
        <div className="voc__cols">
          <Column
            label={diff.now.span.label}
            entries={diff.now.entries}
            note="not there before"
            words={diff.started}
          />
          <Column
            label={diff.then.span.label}
            entries={diff.then.entries}
            note="not there now"
            words={diff.stopped}
          />
        </div>

        <div className="voc__bar">
          <div className="seg" role="group">
            {SPAN_PAIRS.map((p) => (
              <button
                key={p.id}
                type="button"
                data-on={p.id === pairId ? 'true' : undefined}
                onClick={() => setPairId(p.id)}
              >
                {p.now.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Column({
  label,
  entries,
  note,
  words,
}: {
  label: string
  entries: number
  note: string
  words: string[]
}) {
  return (
    <section className="voc__col">
      <header className="voc__head">
        <h2 className="voc__label">{label}</h2>
        {/* A count of pages, so an uneven comparison is visibly uneven. */}
        <p className="voc__n">
          {entries} entries · {note}
        </p>
      </header>
      {words.length ? (
        <ul className="voc__list">
          {words.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="voc__none">Nothing.</p>
      )}
    </section>
  )
}
