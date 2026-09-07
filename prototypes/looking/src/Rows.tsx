import { Fragment } from 'react'
import { ENTRIES, formatDate, yearOf, type Entry } from './corpus'
import { Glyph } from './Glyph'
import { kindRank } from './kinds'
import { paint } from './Wall'
import type { Why } from './Wall'

/**
 * The list, as the far end of the zoom.
 *
 * ── What this has to beat ───────────────────────────────────────────────────
 *
 * The entries panel, at its own game: ~25 entries a screen, scannable by date,
 * fast for "I know it was around March 2019". If this is slower than the panel
 * was, the panel comes back and D-022 stands.
 *
 * ── What it keeps that the panel never had ──────────────────────────────────
 *
 * Everything else on the surface. Lighting dims rather than filters, so a
 * subject narrows the list without throwing away the shape of the years around
 * it. The markings still show in the margin. `look for` is the same control it
 * is at every other distance, and one push of the slider turns these rows back
 * into pages.
 *
 * ── The one thing the panel did that this must not lose ─────────────────────
 *
 * It was how you got back to what you were writing. So today's page is marked,
 * and every row opens to write on a double-click, the same gesture the cards
 * take. If returning to your own draft costs a hunt, the editor got further
 * away — and the editor is why anyone opens the app (Principle 3).
 */
export function Rows({
  entries = ENTRIES,
  lit = null,
  match = null,
  why,
  onOpen,
  onWrite,
}: {
  entries?: Entry[]
  lit?: Set<string> | null
  match?: RegExp | null
  why?: Map<string, Why>
  onOpen?: (id: string) => void
  onWrite?: (id: string) => void
}) {
  const newest = ENTRIES[ENTRIES.length - 1]?.id
  const groups: { year: number; entries: Entry[] }[] = []
  for (const e of entries) {
    const year = yearOf(e.date)
    const last = groups[groups.length - 1]
    if (last && last.year === year) last.entries.push(e)
    else groups.push({ year, entries: [e] })
  }

  return (
    <div className="rows">
      {groups.map((g) => (
        <Fragment key={g.year}>
          <div className="rows__year">
            <span>{g.year}</span>
          </div>
          {g.entries.map((e) => {
            const w = why?.get(e.id)
            /*
             * The line that explains why this row is here — the marked quote,
             * or the paragraph carrying the word. Falls back to the opening,
             * which is what a title would have been if we invented titles.
             */
            const line = w?.mark ? w.mark.quote : (e.paragraphs[w?.para ?? 0] ?? '')
            const declared = [...(e.markings ?? [])]
              .filter((m) => m.kind !== 'mark' && m.kind !== 'highlight' && m.kind !== 'underline' && m.kind !== 'quote')
              .sort((a, b) => kindRank(a.kind) - kindRank(b.kind))
              .slice(0, 3)

            return (
              <button
                type="button"
                className="rows__row"
                key={e.id}
                data-dim={lit && !lit.has(e.id) ? 'true' : undefined}
                data-today={e.id === newest ? 'true' : undefined}
                onClick={() => onOpen?.(e.id)}
                onDoubleClick={(ev) => {
                  ev.preventDefault()
                  onWrite?.(e.id)
                }}
              >
                <time className="rows__date" dateTime={e.date}>
                  {formatDate(e.date)}
                </time>
                <span className="rows__line">{match ? paint(line, match) : line}</span>
                <span className="rows__margin" aria-hidden>
                  {declared.map((m, i) => (
                    <Glyph key={i} kind={m.kind} hue={m.hue} size={11} />
                  ))}
                </span>
                {/* The way back to what you were writing, never more than a glance away. */}
                {e.id === newest ? <span className="rows__today">today</span> : null}
              </button>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
