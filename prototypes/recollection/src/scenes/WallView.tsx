import { Fragment, useMemo, useState } from 'react'
import { ENTRIES, formatDateShort, heftOf, type Entry } from '../corpus'
import { Glyph } from '../Glyph'
import { kindRank } from '../kinds'

type Lead = 'marked' | 'opening'

/**
 * The archive, many pages at once.
 *
 * The only change from a wall of pages is what a card leads with. Today it
 * previews the first lines of the day, which is whatever you happened to type
 * first. Here it leads with what you set apart — and falls back to the opening
 * lines when nothing was.
 *
 * Pages carrying nothing marked go quiet rather than disappear. The days you
 * did not mark are what give the ones you did their shape, and hiding them
 * would turn a wall into a result set.
 *
 * The toggle is here on purpose. Half of this scene's job is to be beaten by
 * the other half — if leading with the first lines reads better, that is a
 * real and very cheap finding.
 */
export function WallView({ onOpen }: { onOpen?: (id: string) => void }) {
  const [lead, setLead] = useState<Lead>('marked')

  const maxHeft = useMemo(() => Math.max(...ENTRIES.map(heftOf)), [])

  const groups = useMemo(() => {
    const out: { label: string; entries: Entry[] }[] = []
    for (const e of ENTRIES) {
      const label = e.date.slice(0, 4)
      const last = out[out.length - 1]
      if (last && last.label === label) last.entries.push(e)
      else out.push({ label, entries: [e] })
    }
    return out
  }, [])

  return (
    <div className="desk">
      <div className="wall">
        <div className="wall__bar">
          <div className="seg" role="group">
            <button type="button" data-on={lead === 'marked' ? 'true' : undefined} onClick={() => setLead('marked')}>
              what you marked
            </button>
            <button type="button" data-on={lead === 'opening' ? 'true' : undefined} onClick={() => setLead('opening')}>
              how the day starts
            </button>
          </div>
        </div>

        {groups.map((g) => (
          <Fragment key={g.label}>
            <div className="wall__rule">
              <span>{g.label}</span>
            </div>
            <div className="wall__grid">
              {g.entries.map((e) => (
                <Card key={e.id} entry={e} lead={lead} fill={heftOf(e) / maxHeft} onOpen={onOpen} />
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function Card({
  entry,
  lead,
  fill,
  onOpen,
}: {
  entry: Entry
  lead: Lead
  fill: number
  onOpen?: (id: string) => void
}) {
  const marks = [...(entry.markings ?? [])].sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || a.para - b.para)
  const showMarks = lead === 'marked' && marks.length > 0

  return (
    <button type="button" className="card" data-quiet={showMarks ? undefined : 'true'} onClick={() => onOpen?.(entry.id)}>
      <time className="card__date" dateTime={entry.date}>
        {formatDateShort(entry.date)}
      </time>

      {showMarks ? (
        <div className="card__marks">
          {marks.slice(0, 4).map((m, i) => (
            <div className="cmark" key={i} data-kind={m.kind}>
              <Glyph kind={m.kind} hue={m.hue} size={18} />
              <p className="cmark__quote">
                {m.ref ? <span className="ref">{m.ref} </span> : null}
                {m.quote}
              </p>
            </div>
          ))}
          {marks.length > 4 ? <span className="card__more">{marks.length - 4} more</span> : null}
        </div>
      ) : (
        <div className="card__prose">
          {entry.paragraphs.slice(0, 4).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {/*
        The thickness of the day. No track behind it, so there is nothing to be
        full against and no number to score — just the look of a thick day
        beside a thin one, which is what paper gives for free.
      */}
      <span className="card__thick" aria-hidden style={{ inlineSize: `${Math.max(6, fill * 100)}%` }} />
    </button>
  )
}
