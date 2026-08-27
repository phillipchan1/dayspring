import { useEffect, useMemo, useState } from 'react'
import { ENTRIES, formatDate, type Entry, type Marking } from '../corpus'
import { Glyph } from '../Glyph'
import { KIND_META } from '../kinds'
import { MarkedSpan, splitParagraph } from '../render'

/**
 * The open page.
 *
 * A page in a book with its markings down the side, the way someone works
 * through a Bible. Everything in the margin is the writer's own sentence —
 * nothing here is written by the app, and there is no title, no summary and no
 * count, because a page in a notebook carries no metadata.
 *
 * The alignment is done with a grid row per paragraph rather than by measuring,
 * so a marking sits beside the words it was made on at every width.
 */
export function MarginView({ initialId }: { initialId?: string }) {
  const start = Math.max(
    0,
    initialId ? ENTRIES.findIndex((e) => e.id === initialId) : ENTRIES.findIndex((e) => e.id === 'e-2025-07-08'),
  )
  const [i, setI] = useState(start)
  const [hot, setHot] = useState<string | null>(null)
  const entry = ENTRIES[i] as Entry

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
      if (e.key === 'ArrowRight') setI((v) => Math.min(ENTRIES.length - 1, v + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const rows = useMemo(
    () =>
      entry.paragraphs.map((text, p) => {
        const mine = (entry.markings ?? []).filter((m) => m.para === p)
        return { text, p, mine, runs: splitParagraph(text, mine, `${entry.id}-${p}`) }
      }),
    [entry],
  )

  const total = (entry.markings ?? []).length

  return (
    <div className="desk">
      <div className="leaf">
        <header className="leaf__head">
          <time className="leaf__date" dateTime={entry.date}>
            {formatDate(entry.date)}
          </time>
          <span className="leaf__year">{entry.date.slice(0, 4)}</span>
          <div className="leaf__flips">
            <button className="leaf__flip" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} aria-label="Previous page">
              ‹
            </button>
            <button
              className="leaf__flip"
              onClick={() => setI(Math.min(ENTRIES.length - 1, i + 1))}
              disabled={i === ENTRIES.length - 1}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </header>

        <div className="leaf__grid">
          {rows.map((row) => (
            <div className="leaf__row" key={row.p}>
              <p className="leaf__para said">
                {row.runs.map((run, j) =>
                  run.kind === 'plain' ? (
                    <span key={j}>{run.text}</span>
                  ) : (
                    <MarkedSpan key={j} run={run} active={hot === run.id} onHover={setHot} />
                  ),
                )}
              </p>
              <aside className="leaf__margin">
                {row.mine.map((m, j) => (
                  <MarginNote
                    key={j}
                    marking={m}
                    active={hot === `${entry.id}-${row.p}-${j}`}
                    onHover={(on) => setHot(on ? `${entry.id}-${row.p}-${j}` : null)}
                  />
                ))}
              </aside>
            </div>
          ))}
        </div>

        {total === 0 ? <p className="leaf__none">Nothing marked on this page.</p> : null}
      </div>
    </div>
  )
}

/**
 * One thing in the margin.
 *
 * No kind label. The hand is the label — if you cannot tell a verse from a
 * prayer from a story without being told, the drawing has failed and a caption
 * would only be hiding it. The name is available to a screen reader and on
 * hover, and nowhere else.
 */
function MarginNote({
  marking,
  active,
  onHover,
}: {
  marking: Marking
  active: boolean
  onHover: (on: boolean) => void
}) {
  const meta = KIND_META[marking.kind]
  return (
    <div
      className="note"
      data-kind={marking.kind}
      data-on={active ? 'true' : undefined}
      title={meta.label}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <Glyph kind={marking.kind} hue={marking.hue} size={24} />
      <div className="note__body">
        {marking.ref ? <div className="ref">{marking.ref}</div> : null}
        <p className="note__quote">{marking.quote}</p>
        <span className="note__name">{meta.label}</span>
      </div>
    </div>
  )
}
