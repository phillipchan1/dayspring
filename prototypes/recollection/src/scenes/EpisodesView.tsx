import { useMemo, useState } from 'react'
import { SUBJECTS, formatDate, formatDateShort } from '../corpus'
import { Glyph } from '../Glyph'
import { burstsFor, plural, quietSpell } from '../lib'

/**
 * The things you would call stories, found without inventing any.
 *
 * A story in a journal is not a theme, it is an EPISODE — and an episode has a
 * detectable shape: a burst of entries on one subject, bounded by silence.
 * That is arithmetic. Code finds the burst and states it as a count; the way in
 * is a sentence the writer typed.
 *
 * The app never calls these stories. It says how many entries, in how many
 * days, after how long a silence. The writer supplies the word.
 *
 * Where the burst contains something declared, the way in is that declaration —
 * the writer already told us which sentence mattered. Only where nothing was
 * declared would a model be asked to pick a line, and even then it may only
 * point at a sentence, never write one.
 */
export function EpisodesView({ onOpen }: { onOpen?: (id: string) => void }) {
  const [key, setKey] = useState<string | null>(null)

  // Every subject at once, in date order. You do not arrive knowing which name
  // to ask about — that is the whole complaint about search.
  const bursts = useMemo(() => {
    const subs = key ? SUBJECTS.filter((s) => s.key === key) : SUBJECTS
    return subs
      .flatMap((s) => burstsFor(s).map((b) => ({ ...b, subject: s })))
      .sort((a, b) => a.entries[0]!.date.localeCompare(b.entries[0]!.date))
  }, [key])

  return (
    <div className="desk">
      <div className="eps">
        <div className="after__pick">
          <button type="button" className="chip" data-on={key === null ? 'true' : undefined} onClick={() => setKey(null)}>
            everything
          </button>
          {SUBJECTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className="chip"
              data-on={s.key === key ? 'true' : undefined}
              onClick={() => setKey(key === s.key ? null : s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {bursts.length === 0 ? (
          <p className="after__silence">Nothing gathered like this.</p>
        ) : (
          <div className="eps__list">
            {bursts.map((b, i) => {
              const wayIn = b.wayIn
              const first = b.entries[0]!
              const last = b.entries[b.entries.length - 1]!
              return (
                <article className="ep" key={i}>
                  <p className="ep__facts">
                    <span className="ep__who">{b.subject.label}</span>
                    {plural(b.entries.length, 'entry', 'entries')} · {plural(b.days, 'day', 'days')}
                    {b.quietDaysBefore > 45 ? ` · after ${quietSpell(b.quietDaysBefore)}` : ''}
                  </p>

                  {wayIn ? (
                    <button type="button" className="ep__wayin" onClick={() => onOpen?.(wayIn.entry.id)}>
                      <Glyph kind={wayIn.marking.kind} hue={wayIn.marking.hue} size={26} />
                      <p className="said">{wayIn.marking.quote}</p>
                    </button>
                  ) : (
                    <button type="button" className="ep__wayin ep__wayin--plain" onClick={() => onOpen?.(first.id)}>
                      <p className="said">{first.paragraphs[0]}</p>
                    </button>
                  )}

                  <div className="ep__days">
                    {b.entries.map((e) => (
                      <button key={e.id} type="button" className="ep__day" onClick={() => onOpen?.(e.id)}>
                        {formatDateShort(e.date)}
                      </button>
                    ))}
                  </div>

                  <p className="ep__span">
                    {formatDate(first.date)} — {formatDate(last.date)}
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
