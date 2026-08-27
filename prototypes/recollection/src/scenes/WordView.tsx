import { useEffect, useMemo, useState } from 'react'
import { allMarkings, formatDate } from '../corpus'
import { Glyph } from '../Glyph'

/**
 * One line, and the whole screen.
 *
 * The desert's own unit of memory is a single saying — a monk asks an elder for
 * a word and carries the answer for years. Not a shorter result: one sentence,
 * and nothing else to look at.
 *
 * Every other arrangement here is a list, and a list is the product's instinct
 * rather than the tradition's. Kristi's constraint was not "make the results
 * shorter", it was that a review must not hand back more volume to read. This
 * is that constraint taken all the way down.
 *
 * The delay is the point. A next control available immediately turns this into
 * a slideshow, and the one thing lectio and the Exercises agree on is that the
 * time spent is doing the work. Nothing appears for a few seconds, and what
 * appears is a hairline, not a button that looks like one.
 *
 * Falsified if the first thing they do is hunt for more.
 */
export function WordView({ onOpen }: { onOpen?: (id: string) => void }) {
  const marks = useMemo(() => allMarkings().slice().reverse(), [])
  const [at, setAt] = useState(0)
  const [ready, setReady] = useState(false)
  const m = marks[at % marks.length]!

  useEffect(() => {
    setReady(false)
    const t = setTimeout(() => setReady(true), 4200)
    return () => clearTimeout(t)
  }, [at])

  return (
    <div className="desk desk--still">
      <div className="one">
        <Glyph kind={m.kind} hue={m.hue} size={30} />
        <p className="said one__said">{m.quote}</p>
        <time className="stamp one__when">{formatDate(m.date)}</time>

        {/*
          Opening the whole entry is a deliberate second act, always. That is
          the answer to the vulnerability of a stream of consciousness: she
          meets the sentence she chose, and the pour behind it is hers to ask
          for.
        */}
        <div className="one__foot" data-on={ready ? 'true' : undefined}>
          <button type="button" className="one__quiet" onClick={() => onOpen?.(m.entryId)}>
            the page it came from
          </button>
          <button type="button" className="one__quiet" onClick={() => setAt((v) => v + 1)}>
            another
          </button>
        </div>
      </div>
    </div>
  )
}
