import { memo } from 'react'
import { MARK_KIND } from '@/lib/markKinds'
import type { SpiritualItemType } from '@/lib/types'
import type { PageExcerpt } from './pageExcerpt'
import { splitOnMatch } from './pageExcerpt'
import { useWallPointer } from './useWallPointer'
import type { PageClickResult } from './PageCard'

interface Props {
  entryId: string
  dateIso: string
  excerpt: PageExcerpt
  match: RegExp | null
  dim: boolean
  active: boolean
  selected: boolean
  context: boolean
  /** The newest page — the way back to what you were writing. */
  today: boolean
  /** Declared kinds this page carries, in the vocabulary's own order. */
  markings: SpiritualItemType[]
  wallKey: string
  tabIndex: number
  onFocus: (wallKey: string) => void
  onKeyDown: (wallKey: string, e: React.KeyboardEvent) => void
  onOpen: (entryId: string) => void
  onEdit: (entryId: string) => void
  onClick: (
    entryId: string,
    e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  ) => PageClickResult
  onOpenMenu: (entryId: string, x: number, y: number) => void
}

/** Short and fixed-width-ish, because a column of dates is read down, not across. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * One page, standing very far back.
 *
 * ── What this has to beat ───────────────────────────────────────────────────
 *
 * The entries panel, at its own game: ~30 pages a screen, scannable by date,
 * fast for "I know it was around March 2019". D-018 deleted that panel and
 * D-022 put it back three days later for exactly one reason — browsing for a
 * half-remembered entry got slower. If this row is slower than the panel was,
 * the panel comes back and D-022 stands.
 *
 * ── What it keeps that the panel never had ──────────────────────────────────
 *
 * Everything else on the surface. Lighting DIMS rather than filters, so a
 * subject narrows the list without throwing away the shape of the years around
 * it — the panel could only ever hand back a search result. The markings show
 * in the margin. `look for` is the same control it is at every other distance,
 * and one push of the slider turns these rows back into pages.
 *
 * ── The one thing the panel did that this must not lose ─────────────────────
 *
 * It was how you got back to what you were writing. So today's page is marked,
 * and every row opens to write on a double-click — the same gesture the cards
 * take. If returning to your own draft costs a hunt, the editor got further
 * away, and the editor is why anyone opens the app (Principle 3).
 *
 * ── One DOM, two shapes ─────────────────────────────────────────────────────
 *
 * Beside a cursor this is a single line: date, sentence, markings, all across.
 * On a phone that line was 26 characters of prose after the date column and the
 * year rail had taken their fixed widths, which is not a preview of anything.
 *
 * So on a phone the same four children lay out as two rows instead — the facts
 * about the page (date, today, markings: mono, small, quiet) on a thin line of
 * their own, and the writer's words at FULL WIDTH underneath, two lines of
 * them. It is the surface's own typographic rule made into a layout: "serif is
 * her, sans is us", so her sentence gets the whole measure and everything we
 * added gets out of its way.
 *
 * Grid areas, not a second render path. A phone row and a desktop row differ in
 * where the same four things sit, and two JSX branches for that is two things to
 * keep in step for no gain — every behaviour on this element (selection, the
 * long-press menu, focus, the double-click to write) would have to be written
 * twice and would eventually be written differently.
 */
export const PageRow = memo(function PageRow({
  entryId,
  dateIso,
  excerpt,
  match,
  dim,
  active,
  selected,
  context,
  today,
  markings,
  wallKey,
  tabIndex,
  onFocus,
  onKeyDown,
  onOpen,
  onEdit,
  onClick,
  onOpenMenu,
}: Props) {
  const pointer = useWallPointer((x, y) => onOpenMenu(entryId, x, y))
  // The writer's own opening — not a title, because we do not invent titles
  // (`deriveTitle` exists for chrome; a page has none).
  const line = excerpt.lines[0]?.text ?? ''
  /*
   * And what comes after it, for the phone's second line.
   *
   * Also verbatim, also hers — a preview here is the next thing she wrote, never
   * a summary of what she wrote (Principle 4). It runs on from the opening in
   * the same block so ONE clamp decides the whole thing: a long opening fills
   * both lines and this never appears, a short one ("morning jesus") lets the
   * next sentence flow in behind it. Which is the behaviour that makes a list of
   * short openings readable at all.
   */
  const next = excerpt.lines[1]?.text ?? ''

  return (
    <button
      type="button"
      className="pgr"
      data-page-id={entryId}
      data-wall-key={wallKey}
      data-entry-row
      data-entry-id={entryId}
      data-dim={dim ? 'true' : undefined}
      data-active={active ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      data-context={context ? 'true' : undefined}
      data-today={today ? 'true' : undefined}
      aria-selected={selected || undefined}
      tabIndex={tabIndex}
      onFocus={() => onFocus(wallKey)}
      onKeyDown={(e) => onKeyDown(wallKey, e)}
      {...pointer.handlers}
      onClick={(e) => {
        if (pointer.consumeLongPress()) {
          e.preventDefault()
          return
        }
        const result = onClick(entryId, e)
        if (result === 'open') onOpen(entryId)
        else e.currentTarget.focus()
      }}
      onDoubleClick={(e) => {
        e.preventDefault()
        onEdit(entryId)
      }}
    >
      <time className="pgr__date" dateTime={dateIso}>
        {formatDate(dateIso)}
      </time>
      <span className="pgr__line">
        {match ? paint(line, match) : line}
        {next ? (
          <span className="pgr__next"> {match ? paint(next, match) : next}</span>
        ) : null}
      </span>
      <span className="pgr__margin" aria-hidden>
        {markings.map((kind) => (
          <span key={kind} className="pgr__mark" style={{ background: MARK_KIND[kind]?.tone }} />
        ))}
      </span>
      {today ? <span className="pgr__today">today</span> : null}
    </button>
  )
})

/** The lit words, painted in place — the same treatment the cards give them. */
function paint(text: string, match: RegExp): React.ReactNode {
  const runs = splitOnMatch(text, match)
  if (runs.length === 1) return text
  // Odd indices are the matched runs — see splitOnMatch.
  return runs.map((run, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="pgr__lit">
        {run}
      </mark>
    ) : (
      run
    ),
  )
}
