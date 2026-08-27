import { useEffect, useMemo, useState } from 'react'
import { allMarkings, formatDate } from '../corpus'
import { Glyph } from '../Glyph'

/**
 * The sit-down.
 *
 * Judy does this twice a year — at six months and at the end — on a personal
 * retreat, uninterrupted, and the year-end one exists so she can cast vision
 * for the next year. She starts a new journal every January.
 *
 * So this is not a screen you check. It is a sitting: one thing at a time, at
 * reading pace, no controls, nothing to click except forward. It ends on a
 * blank page, because what she does at the end of the read is write.
 *
 * Everything shown is a sentence she typed and set apart herself. The app
 * chooses the order — which is chronology — and nothing else.
 */
export function SitDownView() {
  const items = useMemo(
    () =>
      allMarkings()
        .filter((m) => m.kind === 'story' || m.kind === 'learned')
        .sort((a, b) => a.date.localeCompare(b.date)),
    [],
  )

  const [i, setI] = useState(0)
  const done = i >= items.length

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        setI((v) => Math.min(items.length, v + 1))
      }
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length])

  const m = items[i]

  return (
    <div
      className="sit"
      onClick={() => setI((v) => Math.min(items.length, v + 1))}
      role="presentation"
      data-done={done ? 'true' : undefined}
    >
      {done ? (
        <div className="sit__blank">
          <span className="sit__caret" aria-hidden />
        </div>
      ) : (
        <figure className="sit__card" key={i}>
          <Glyph kind={m!.kind} hue={m!.hue} size={34} />
          <blockquote className="sit__quote said">{m!.quote}</blockquote>
          <figcaption className="stamp">{formatDate(m!.date)}</figcaption>
        </figure>
      )}

      <div className="sit__dots" aria-hidden>
        {items.map((_, j) => (
          <i key={j} data-on={j <= i ? 'true' : undefined} />
        ))}
      </div>
    </div>
  )
}
