import { ENTRIES } from '../corpus'
import { REFUSED, RHYME, formatDate } from '../lib'

/**
 * The model's only job.
 *
 * It picked two of his own sentences from the same domain, four years apart,
 * and put them next to each other. It wrote nothing. The entire explanation
 * under each is metadata — the domain and the date — because anything more is
 * the app narrating a man's life back at him.
 *
 * What it returned is a POINTER: an entry id and a paragraph index. The text is
 * validated as a verbatim substring before it is allowed on screen, the same
 * check the real pipeline runs before it will persist model output.
 *
 * Underneath is what we will not render, struck through, so the boundary is
 * something you can look at rather than a claim in a doc.
 */
export function RhymeView() {
  const entryById = new Map(ENTRIES.map((e) => [e.id, e]))
  const sides = [RHYME.then, RHYME.now].map((s) => ({
    ...s,
    date: entryById.get(s.entryId)!.date,
  }))

  return (
    <div className="paper">
      <div className="wrap wrap--narrow">
        <p className="eyebrow">you wrote this, and then you wrote this</p>
        <h1 className="title">{RHYME.domain}</h1>
        <p className="lede">
          Two sentences from the same heading, four years apart. The model chose which two. It did
          not write a word.
        </p>

        <div className="pair">
          {sides.map((s) => (
            <figure className="pane" key={s.entryId} style={{ margin: 0 }}>
              <blockquote className="pane__quote said" style={{ margin: 0 }}>
                {s.text}
              </blockquote>
              <figcaption className="pane__why">
                {RHYME.domain} · {formatDate(s.date)}
              </figcaption>
            </figure>
          ))}
        </div>

        <hr className="rule" />

        <div className="refusal">
          <div className="refusal__head">what it is not allowed to say</div>
          <p className="refusal__text">{REFUSED}</p>
        </div>
      </div>
    </div>
  )
}
