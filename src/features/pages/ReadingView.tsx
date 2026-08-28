import { useMemo } from 'react'
import { entryContentLines } from '@/lib/entryLabels'
import { MarkGlyph } from '@/components/MarkGlyph'
import { MARK_KIND } from '@/lib/markKinds'
import type { PageMarking } from '@/lib/spiritual'
import type { Entry } from '@/lib/types'
import { pageExcerpt } from './pageExcerpt'
import { distanceText, markingsNear } from './nearby'
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
  match,
  narrowed,
  markings,
  markingsLoading,
  split,
  onSplit,
  onOpen,
}: {
  reading: Exclude<Reading, 'order'>
  entries: Entry[]
  /** The lit subject's spellings — a subject is not a finding about itself. */
  terms: string[]
  /** The lit subjects as a matcher, for finding the mentions to be near. */
  match: RegExp | null
  /**
   * Something has narrowed the set — a subject, a marking, a question, a
   * bracketed stretch. Any of them will do; what matters is that these
   * arrangements are of a HANDFUL of pages rather than of the archive.
   */
  narrowed: boolean
  /** Markings with their text, for the pages on screen. Empty until fetched. */
  markings: readonly PageMarking[]
  markingsLoading: boolean
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

  /*
   * ── Why these ask for a narrowing, and do not simply run ────────────────
   *
   * Each of them technically works on the whole archive, and each of them is
   * useless there. `then & now` over eleven years is two columns of fifteen
   * hundred pages. `close together` on a near-daily journal returns ONE stretch
   * containing everything — its own module says so. `the words you used` over
   * the whole vocabulary is a word cloud, which is the thing the floor exists
   * to prevent. They are arrangements OF something, and with nothing chosen the
   * something is "your entire life", which no arrangement makes legible.
   *
   * An instruction, though — never a dimmed pill. Greying these out is exactly
   * what made "the words you used" impossible to find: you open the sheet, see
   * a dead group, and never learn what was in it. So the option stays pressable
   * and says what it wants, and pressing it teaches you what it does.
   *
   * A BRACKET counts as a narrowing as much as a subject does. "Then & now"
   * across one year you bracketed is a real question.
   */
  if (!narrowed && reading !== 'near') {
    return (
      <div className="pg-read">
        <Ask reading={reading} />
      </div>
    )
  }

  return (
    <div className="pg-read">
      {reading !== 'bursts' && reading !== 'near' ? (
        <SplitPick split={split} years={years} onSplit={onSplit} />
      ) : null}
      {reading === 'thennow' ? (
        <ThenAndNow entries={entries} split={split} onOpen={onOpen} />
      ) : reading === 'words' ? (
        <TheWordsYouUsed entries={entries} split={split} terms={terms} />
      ) : reading === 'near' ? (
        <MarkedNearIt
          entries={entries}
          markings={markings}
          match={match}
          loading={markingsLoading}
          onOpen={onOpen}
        />
      ) : (
        <CloseTogether entries={entries} match={match} onOpen={onOpen} />
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
function CloseTogether({
  entries,
  match,
  onOpen,
}: {
  entries: Entry[]
  match: RegExp | null
  onOpen: (id: string) => void
}) {
  const found = useMemo(() => bursts(entries), [entries])
  if (found.length === 0) {
    return <p className="pg-read__none">Nothing here came close together.</p>
  }
  return (
    <div className="pg-read__bursts">
      {found.map((b, i) => (
        <section className="pg-read__burst" key={i}>
          <h3 className="pg-read__head">
            {b.entries.length} pages in {b.days === 1 ? 'a day' : `${b.days} days`}
            {b.quietDaysBefore > 0 ? <span>after {quiet(b.quietDaysBefore)}</span> : null}
          </h3>
          {/*
            PAGES, not rows.
            
            A stretch rendered as a run of one-line rows reads as a list that
            happens to have a heading — twenty-three things, not one thing that
            took 387 days. As cards they read as a pile, which is what a burst
            of writing actually is, and the shape of the pile carries the count
            before you read it.
          */}
          <div className="pg-read__pile">
            {b.entries.map((e) => (
              <StretchCard key={e.id} entry={e} match={match} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/**
 * One page in a stretch, as a page.
 *
 * Deliberately NOT the wall's `PageCard`: that card is wired to the wall's
 * roving focus, multi-selection, range-select and context menu, none of which
 * exist here, and threading them through a reading would make the reading own
 * state it has no use for. What it shares is the part that matters — the same
 * `pageExcerpt`, so the lines shown are the lines that MADE the page light up,
 * and the same date format.
 */
function StretchCard({
  entry,
  match,
  onOpen,
}: {
  entry: Entry
  match: RegExp | null
  onOpen: (id: string) => void
}) {
  const excerpt = useMemo(() => pageExcerpt(entry, [], PILE_LINES, match), [entry, match])
  return (
    <button type="button" className="pg-read__card" onClick={() => onOpen(entry.id)}>
      <time className="pg-read__card-date" dateTime={entry.created_at}>
        {new Date(entry.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </time>
      {excerpt.lines.map((line, i) => (
        <span className="pg-read__card-line" key={i}>
          {line.text}
        </span>
      ))}
    </button>
  )
}

/** Lines a card in a pile shows. Enough to recognise a page, too few to read it. */
const PILE_LINES = 5

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

/**
 * MARKED NEAR IT — the join that never existed.
 *
 * Every other reading arranges PAGES. This one arranges LINES, because the
 * question it answers is not "which pages carry both" — that was the answer
 * that felt like nothing — but "what did I reach for while I was writing about
 * her". A page-level intersection cannot say that; two located things in the
 * same prose can (see `nearby.ts`).
 *
 * Order is the order she wrote them, never by distance. Sorting by closeness
 * would be the app deciding which of her verses matter most about a person,
 * which is selection, and selection is significance, and significance is a
 * verdict (D-016). The distance is PRINTED — "on the same line" — so the reader
 * can weigh it themselves, which is the whole difference.
 */
function MarkedNearIt({
  entries,
  markings,
  match,
  loading,
  onOpen,
}: {
  entries: Entry[]
  markings: readonly PageMarking[]
  match: RegExp | null
  loading: boolean
  onOpen: (id: string) => void
}) {
  const near = useMemo(
    () => (match ? markingsNear(entries, markings, match) : []),
    [entries, markings, match],
  )

  /*
   * An instruction, not a dimmed pill.
   *
   * This reading needs something to be NEAR, and greying it out until there is
   * one is exactly what made "the words you used" impossible to find: you open
   * the sheet, see a dead option, and never learn what was in it. So it stays
   * pressable and says what it wants.
   */
  // This one wants a SUBJECT specifically, not merely a narrowing: there has to
  // be a mention on the page for a marking to be near.
  if (!match) return <Ask reading="near" />

  if (loading) return <p className="pg-read__none">Reading what you marked…</p>

  if (near.length === 0) {
    return (
      <p className="pg-read__none">
        Nothing marked near it. Better to return nothing than a forced match.
      </p>
    )
  }

  return (
    <div className="pg-near">
      {/* A count, and the rule that produced it. Both facts; neither a claim. */}
      <p className="pg-near__facts">
        {near.length} {near.length === 1 ? 'marking' : 'markings'} within three lines of a mention
      </p>
      <ol className="pg-near__list">
        {near.map(({ entry, marking, distance }) => (
          <li className="pg-near__one" key={marking.id}>
            <button type="button" className="pg-near__hit" onClick={() => onOpen(entry.id)}>
              <span
                className="pg-near__kind"
                style={{ ['--tone']: MARK_KIND[marking.type]?.tone } as React.CSSProperties}
              >
                <MarkGlyph kind={marking.type} className="pg-near__hand" />
                {MARK_KIND[marking.type]?.label ?? marking.type}
              </span>
              {/* Her sentence, verbatim. The only thing here she did not write
                  is the kind above it and the two facts below it. */}
              <span className="pg-near__text">{marking.content}</span>
              <span className="pg-near__where">
                <time dateTime={entry.created_at}>
                  {new Date(entry.created_at).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </time>
                <span aria-hidden>·</span>
                <span>{distanceText(distance)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * What an arrangement needs before it can be one.
 *
 * One shape for all of them, and a second line that says what THIS one will
 * show — a generic "choose something first" teaches nothing, and the whole
 * reason these stay pressable rather than dimmed is so that pressing one is how
 * you find out what it is.
 */
function Ask({ reading }: { reading: Exclude<Reading, 'order'> }) {
  const says: Record<Exclude<Reading, 'order'>, string> = {
    thennow:
      'Then this splits the pages that carry it into two spans — before a year, and since — with the page count for each, so an uneven comparison cannot pass for a verdict.',
    bursts:
      'Then this shows the stretches where it gathers: runs of pages with quiet on both sides, measured against how often you usually write.',
    words:
      'Then this shows the words on those pages in one span and not the other. Yours, in the order they first appeared, and never scored.',
    near:
      'Then this shows what you marked beside the pages that carry it — the verses, the prayers, the lines you set apart, in the order you wrote them.',
  }
  return (
    <div className="pg-read__ask">
      <p className="pg-read__ask-h">Look for a name, a word, or a marking first.</p>
      <p className="pg-read__ask-s">{says[reading]}</p>
    </div>
  )
}
