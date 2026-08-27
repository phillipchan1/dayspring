import { useMemo } from 'react'
import { entryContentLines } from '@/lib/entryLabels'
import type { Entry } from '@/lib/types'
import {
  bursts,
  thenAndNow,
  wordsUsed,
  yearsIn,
  type Reading,
} from './readings'

/**
 * The arrangements, rendered.
 *
 * The results stay in the page view. Earlier passes swapped the wall for a
 * column of sentences the moment you asked a real question, which meant the
 * surface stopped looking like a journal exactly when it got interesting. So
 * every arrangement here is still pages, with their dates, in the writer's own
 * words — grouped differently, never summarised.
 *
 * `in order` is not here: it is the wall itself, oldest first, because that is
 * what the wall already does.
 */
export function ReadingView({
  reading,
  entries,
  terms,
  split,
  onSplit,
  onOpen,
}: {
  reading: Exclude<Reading, 'order'>
  entries: Entry[]
  /** The lit subject's spellings — a subject is not a finding about itself. */
  terms: string[]
  split: number
  onSplit: (year: number) => void
  onOpen: (entryId: string) => void
}) {
  const years = useMemo(() => yearsIn(entries), [entries])

  if (entries.length === 0) {
    return (
      <div className="pg-read">
        <p className="pg-read__none">Nothing lit to arrange.</p>
      </div>
    )
  }

  return (
    <div className="pg-read">
      {reading !== 'bursts' ? (
        <SplitPick split={split} years={years} onSplit={onSplit} />
      ) : null}
      {reading === 'thennow' ? (
        <ThenAndNow entries={entries} split={split} onOpen={onOpen} />
      ) : reading === 'words' ? (
        <TheWordsYouUsed entries={entries} split={split} terms={terms} />
      ) : (
        <CloseTogether entries={entries} onOpen={onOpen} />
      )}
    </div>
  )
}

/** Where the two spans meet. A control, not a finding — so it is plain. */
function SplitPick({
  split,
  years,
  onSplit,
}: {
  split: number
  years: number[]
  onSplit: (y: number) => void
}) {
  if (years.length < 2) return null
  return (
    <div className="pg-read__split">
      <span>split at</span>
      {years.slice(1).map((y) => (
        <button
          key={y}
          type="button"
          className="pg-read__year"
          data-on={y === split ? 'true' : undefined}
          onClick={() => onSplit(y)}
        >
          {y}
        </button>
      ))}
    </div>
  )
}

/**
 * Two spans of pages, and NO ARROW BETWEEN THEM.
 *
 * An arrow is a vertical axis laid on its side — it says the second span is
 * where the first was heading. The page count for each span is always on
 * screen, because an uneven comparison reads as a verdict on the thinner side.
 */
function ThenAndNow({
  entries,
  split,
  onOpen,
}: {
  entries: Entry[]
  split: number
  onOpen: (id: string) => void
}) {
  const { before, after } = useMemo(() => thenAndNow(entries, split), [entries, split])
  return (
    <div className="pg-read__two">
      <Span head={`before ${split}`} pages={before} onOpen={onOpen} />
      <Span head={`since ${split}`} pages={after} onOpen={onOpen} />
    </div>
  )
}

function Span({
  head,
  pages,
  onOpen,
}: {
  head: string
  pages: Entry[]
  onOpen: (id: string) => void
}) {
  return (
    <section className="pg-read__span">
      <h3 className="pg-read__head">
        {head}
        <span>{pages.length === 1 ? '1 page' : `${pages.length} pages`}</span>
      </h3>
      {pages.length === 0 ? (
        <p className="pg-read__none">Nothing here.</p>
      ) : (
        <ol className="pg-read__pages">
          {pages.map((e) => (
            <PageLine key={e.id} entry={e} onOpen={onOpen} />
          ))}
        </ol>
      )}
    </section>
  )
}

/**
 * Stretches bounded by silence.
 *
 * EVERY HEADING IS A COUNT. A title would be a claim about what the stretch
 * was, and the writer is the only one who gets to say that — they supply the
 * word "story", not us.
 */
function CloseTogether({ entries, onOpen }: { entries: Entry[]; onOpen: (id: string) => void }) {
  const found = useMemo(() => bursts(entries), [entries])
  if (found.length === 0) {
    return <p className="pg-read__none">Nothing here came close together.</p>
  }
  return (
    <div className="pg-read__bursts">
      {found.map((b, i) => (
        <section className="pg-read__span" key={i}>
          <h3 className="pg-read__head">
            {b.entries.length} pages in {b.days === 1 ? 'a day' : `${b.days} days`}
            {b.quietDaysBefore > 0 ? <span>after {quiet(b.quietDaysBefore)}</span> : null}
          </h3>
          <ol className="pg-read__pages">
            {b.entries.map((e) => (
              <PageLine key={e.id} entry={e} onOpen={onOpen} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

/** Silence, in the largest unit that stays honest. */
function quiet(days: number): string {
  if (days < 60) return `${days} quiet days`
  const months = Math.round(days / 30)
  if (months < 24) return `${months} quiet months`
  return `${Math.round(months / 12)} quiet years`
}

/**
 * The sentiment question, in its only legal form.
 *
 * No number beside any word. Ordered by first appearance, never by frequency.
 * Never sorted into good and bad. The page count for each span on screen, and
 * the floor stated where the reader can see it — because "appears in at least
 * two pages" is arithmetic, where "the most significant thirty" is selection,
 * and selection is significance, and significance is a verdict.
 */
function TheWordsYouUsed({
  entries,
  split,
  terms,
}: {
  entries: Entry[]
  split: number
  terms: string[]
}) {
  const out = useMemo(() => wordsUsed(entries, split, terms), [entries, split, terms])
  return (
    <>
      <div className="pg-read__two">
        <WordColumn
          head={`you were saying, before ${split}`}
          pages={out.beforePages}
          words={out.stopped}
          none="Nothing you stopped saying."
        />
        <WordColumn
          head={`you are saying, since ${split}`}
          pages={out.afterPages}
          words={out.started}
          none="Nothing new."
        />
      </div>
      {/* The floor, stated where the reader can see it — the only legal way to
          shorten this list, and it has to be visible to be legal. */}
      <p className="pg-read__floor">
        Words appearing in at least {out.floor} {out.floor === 1 ? 'page' : 'pages'} of their
        span, in the order they first appeared. Nothing here is counted or ranked.
      </p>
    </>
  )
}

function WordColumn({
  head,
  pages,
  words,
  none,
}: {
  head: string
  pages: number
  words: string[]
  none: string
}) {
  return (
    <section className="pg-read__span">
      <h3 className="pg-read__head">
        {head}
        <span>{pages === 1 ? '1 page' : `${pages} pages`}</span>
      </h3>
      {words.length === 0 ? (
        <p className="pg-read__none">{none}</p>
      ) : (
        <p className="pg-read__words">
          {words.map((w, i) => (
            <span key={w}>
              {w}
              {i < words.length - 1 ? <i aria-hidden> · </i> : null}
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

/** One page: its date, and the line it opens with. Nothing we invented. */
function PageLine({ entry, onOpen }: { entry: Entry; onOpen: (id: string) => void }) {
  const line = entryContentLines(entry.body_markdown)[0] ?? ''
  return (
    <li>
      <button type="button" className="pg-read__page" onClick={() => onOpen(entry.id)}>
        <time className="pg-read__date" dateTime={entry.created_at}>
          {new Date(entry.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </time>
        <span className="pg-read__line">{line}</span>
      </button>
    </li>
  )
}
