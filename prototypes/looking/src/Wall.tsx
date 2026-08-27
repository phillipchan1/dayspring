import { Fragment } from 'react'
import { ENTRIES, formatDateShort, yearOf, type Entry, type Marking, type MarkingKind } from './corpus'
import { faceOf, fillOf } from './page'
import { Glyph } from './Glyph'
import { KIND_META, kindRank } from './kinds'
import type { Hit } from './semantics'

/**
 * The wall, and one card.
 *
 * ── The card is the unit everywhere ─────────────────────────────────────────
 *
 * Earlier passes swapped the wall out for a column of sentences whenever you
 * asked a real question, which meant the moment the surface got interesting it
 * stopped looking like your journal. Everything is cards now: in date order, in
 * two spans, or grouped into stretches. You are always scanning pages.
 *
 * What keeps that honest against "the line is the unit of memory" is that the
 * card LEADS with the matching line. You get the sentence, and you get it in the
 * page it came from, with its date — which is the thing a bare list of lines
 * threw away.
 */

export type Why = {
  /** The paragraph that explains why this page is here. */
  para?: number
  /** The marking that matched, when a marking is what you asked for. */
  mark?: Marking
}

export type WallProps = {
  entries?: Entry[]
  lit?: Set<string> | null
  match?: RegExp | null
  near?: Map<string, Hit>
  /** Why each page is here, by entry id. Drives the face and the card's edge. */
  why?: Map<string, Why>
  only?: boolean
  cols?: number
  maxLines?: number
  glyphs?: boolean
  density?: boolean
  ratio?: string
  onOpen?: (id: string) => void
}

export function Wall({
  entries = ENTRIES,
  lit = null,
  match = null,
  near,
  why,
  only = false,
  cols = 6,
  maxLines = 7,
  glyphs = false,
  density = false,
  ratio,
  onOpen,
}: WallProps) {
  const shown = only && lit ? entries.filter((e) => lit.has(e.id)) : entries
  const face = ratio ?? (cols <= 4 ? '1 / 1' : '3 / 4')
  const groups: { year: number; entries: Entry[] }[] = []
  for (const e of shown) {
    const year = yearOf(e.date)
    const last = groups[groups.length - 1]
    if (last && last.year === year) last.entries.push(e)
    else groups.push({ year, entries: [e] })
  }

  return (
    <div className="wall" style={{ ['--cols' as string]: cols, ['--card-ratio' as string]: face }}>
      {groups.map((g) => (
        <Fragment key={g.year}>
          <div className="year-rule">
            <span>{g.year}</span>
          </div>
          {g.entries.map((e) => (
            <Card
              key={e.id}
              entry={e}
              dim={Boolean(lit) && !lit!.has(e.id)}
              match={match}
              hit={near?.get(e.id) ?? null}
              why={why?.get(e.id) ?? null}
              maxLines={maxLines}
              glyphs={glyphs}
              onOpen={onOpen}
            />
          ))}
          {density ? <Silhouettes year={g.year} lines={maxLines} /> : null}
        </Fragment>
      ))}
    </div>
  )
}

/**
 * One page.
 *
 * ── The margin ──────────────────────────────────────────────────────────────
 *
 * Markings run down the RIGHT of the card, in their own narrow column, the way
 * they do in a Bible. They used to float in the top corner over the text, which
 * put a glyph on top of her sentence — the one thing a page is not allowed to
 * carry anything on.
 *
 * A margin is also the honest shape: it is a strip beside the writing that
 * belongs to the reader rather than the writer, which is exactly what a marking
 * is. It costs the text about fourteen pixels and buys a card you can read the
 * hand of before you read a word.
 *
 * ── Two signals, two channels ───────────────────────────────────────────────
 *
 * When a subject and a marking are both on, the card has to say two things at
 * once — *this page is about Mom* and *this is the prayer you made on it* — and
 * saying them in the same channel means they compete.
 *
 * So they use different ones. The MARKING is colour and hand: its tone on the
 * card's inside edge, its glyph in the margin. The SUBJECT is the lit word
 * inside her sentence. Neither restates the other, and the pairing is legible
 * at a glance without a badge, a label or a count anywhere on the page.
 *
 * The marked line is pulled onto the face, because a card that lights up and
 * then shows you four paragraphs about something else has not shown its work.
 */
export function Card({
  entry,
  dim,
  match,
  hit,
  why,
  maxLines,
  glyphs,
  onOpen,
}: {
  entry: Entry
  dim: boolean
  match: RegExp | null
  hit: Hit | null
  why: Why | null
  maxLines: number
  glyphs: boolean
  onOpen?: (id: string) => void
}) {
  const litPara = why?.para ?? (hit ? hit.para : null)
  const face = faceOf(entry, { maxLines, litPara })
  const mark = why?.mark ?? null
  /*
   * What goes in the margin.
   *
   * With a marking chosen, only that one — the card is answering a question and
   * a second hand beside it is noise. Otherwise every kind she declared on the
   * page, in the order of the act rather than by how many, because ordering a
   * margin by count would make the margin a ranking.
   */
  const margin = mark
    ? [mark]
    : [...(entry.markings ?? [])]
        .filter((m) => m.kind !== 'mark' && m.kind !== 'highlight' && m.kind !== 'underline' && m.kind !== 'quote')
        .sort((a, b) => kindRank(a.kind) - kindRank(b.kind))
        .slice(0, 4)

  return (
    <button
      type="button"
      className="card"
      data-dim={dim ? 'true' : undefined}
      data-marked={mark ? 'true' : undefined}
      style={mark ? ({ ['--card-tone' as string]: `var(--k-${KIND_META[mark.kind].tone})` } as React.CSSProperties) : undefined}
      onClick={() => onOpen?.(entry.id)}
    >
      <time className="card__date" dateTime={entry.date}>
        {formatDateShort(entry.date)} {entry.date.slice(0, 4)}
      </time>

      <div className="card__cols">
        <div className="card__body">
          {face.lines.map((line, i) => (
            <p
              key={i}
              className="card__line"
              data-set={line.set ? 'true' : undefined}
              data-lit={line.lit && !hit && !mark ? 'true' : undefined}
              data-near={line.lit && hit ? 'true' : undefined}
              data-mark={line.lit && mark ? 'true' : undefined}
            >
              {match ? paint(line.text, match) : line.text}
            </p>
          ))}
        </div>

        {/* The margin. Beside the writing, never on top of it. */}
        {(glyphs || mark) && margin.length > 0 ? (
          <div className="card__margin" aria-hidden>
            {margin.map((m, i) => (
              <Glyph key={i} kind={m.kind} hue={m.hue} size={13} />
            ))}
          </div>
        ) : null}
      </div>

      {face.total > face.lines.length ? <span className="card__fade" aria-hidden /> : null}
      <span
        className="card__thick"
        aria-hidden
        style={{ inlineSize: `${Math.max(6, fillOf(face.chars) * 100)}%` }}
      />
    </button>
  )
}

/** Pages with dates and no words, so the layout can be seen at real density. */
function Silhouettes({ year, lines }: { year: number; lines: number }) {
  return (
    <>
      {Array.from({ length: 14 }, (_, i) => (
        <div className="silhouette" key={`${year}-sil-${i}`} aria-hidden>
          {Array.from({ length: Math.max(3, lines - (i % 3)) }, (_, j) => (
            <span key={j} style={{ inlineSize: `${55 + ((i * 7 + j * 13) % 42)}%` }} />
          ))}
        </div>
      ))}
    </>
  )
}

/** Paint the literal runs. Odd indices are the matches. */
export function paint(text: string, match: RegExp | null) {
  if (!match) return text
  match.lastIndex = 0
  const out: string[] = []
  let at = 0
  let m: RegExpExecArray | null
  while ((m = match.exec(text))) {
    out.push(text.slice(at, m.index), m[0])
    at = m.index + m[0].length
    if (m[0].length === 0) match.lastIndex += 1
  }
  out.push(text.slice(at))
  return out.map((run, i) =>
    i % 2 === 1 ? (
      <mark className="lit" key={i}>
        {run}
      </mark>
    ) : (
      <Fragment key={i}>{run}</Fragment>
    ),
  )
}

export function matcherFor(terms: string[]): RegExp | null {
  if (!terms.length) return null
  const safe = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`\\b(?:${safe.join('|')})\\b`, 'gi')
}

export type { MarkingKind }
