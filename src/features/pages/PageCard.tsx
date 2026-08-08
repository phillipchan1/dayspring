import { memo } from 'react'
import type { PageExcerpt } from './pageExcerpt'
import { pageFill, splitOnMatch } from './pageExcerpt'
import { useWallPointer } from './useWallPointer'

export type PageClickResult = 'open' | 'toggle' | 'range'

interface Props {
  entryId: string
  dateIso: string
  excerpt: PageExcerpt
  /** Lines this zoom level has room for. The excerpt itself is built once, big. */
  maxLines: number
  /** Lit subjects, for painting the matched words. Null when nothing is lit. */
  match: RegExp | null
  /** Subject lighting is on and this page doesn't carry it. */
  dim: boolean
  /** The page currently open in the editor. */
  active: boolean
  /** Part of the current multi-selection. */
  selected: boolean
  /** The card a context menu is currently pointing at. */
  context: boolean
  /** Set when this page has risen out of another year. */
  echo?: string | undefined
  /**
   * Roving-focus wiring from the wall.
   *
   * The callbacks take the key rather than closing over it so the wall can keep
   * them referentially stable — a per-card arrow function would either defeat
   * the memo on every scroll frame or, if left out of `propsEqual`, leave a card
   * holding a closure over a stale `items` array.
   */
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * One page.
 *
 * Everything on it is the writer's: their sentences, their date, their emphases.
 * There is no title we invented, no summary, no tag, no count — a page in a
 * notebook doesn't carry metadata, and the moment this one does it stops reading
 * as a page and starts reading as a row.
 *
 * The right-hand hairline is the page's thickness — how much was written that
 * day. It deliberately has no track behind it, so there is nothing to be "full"
 * against and no number to score: it's the look of a thick day versus a thin one,
 * which is the thing paper gives you for free.
 *
 * This is also the wall's interaction target. It used to be wrapped in a
 * focusable `pg__cell` span, which made every card two tab stops with the focus
 * ring drawn on the child — survivable while a click was the only gesture, and
 * not once the card had to carry selection, a context menu and a long-press.
 */
export const PageCard = memo(function PageCard({
  entryId,
  dateIso,
  excerpt,
  maxLines,
  match,
  dim,
  active,
  selected,
  context,
  echo,
  wallKey,
  tabIndex,
  onFocus,
  onKeyDown,
  onOpen,
  onEdit,
  onClick,
  onOpenMenu,
}: Props) {
  const fill = pageFill(excerpt.chars)
  const shown = excerpt.lines.length > maxLines ? excerpt.lines.slice(0, maxLines) : excerpt.lines
  const truncated = excerpt.total > shown.length
  const empty = shown.length === 0
  const pointer = useWallPointer((x, y) => onOpenMenu(entryId, x, y))

  return (
    <button
      type="button"
      className="pgc"
      data-page-id={entryId}
      data-wall-key={wallKey}
      data-entry-row
      data-entry-id={entryId}
      data-dim={dim ? 'true' : undefined}
      data-active={active ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      data-context={context ? 'true' : undefined}
      data-echo={echo ? 'true' : undefined}
      aria-selected={selected || undefined}
      tabIndex={tabIndex}
      onFocus={() => onFocus(wallKey)}
      onKeyDown={(e) => onKeyDown(wallKey, e)}
      {...pointer.handlers}
      onClick={(e) => {
        // A long-press already opened the menu — swallow the trailing click.
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
      {echo ? <span className="pgc__echo">{echo}</span> : null}
      <time className="pgc__date" dateTime={dateIso}>
        {formatDate(dateIso)}
      </time>

      <div className="pgc__body">
        {empty ? (
          <p className="pgc__blank">Blank page</p>
        ) : (
          shown.map((line, i) => (
            <p
              key={i}
              className="pgc__line"
              data-set={line.set ? 'true' : undefined}
              data-hit={line.hit ? 'true' : undefined}
            >
              {/* Odd indices are the matched runs — see splitOnMatch. */}
              {line.hit
                ? splitOnMatch(line.text, match).map((run, j) =>
                    j % 2 === 1 ? (
                      <mark key={j} className="pgc__lit">
                        {run}
                      </mark>
                    ) : (
                      run
                    ),
                  )
                : line.text}
            </p>
          ))
        )}
      </div>

      {truncated ? <span className="pgc__fade" aria-hidden /> : null}
      <span className="pgc__thickness" aria-hidden style={{ inlineSize: `${fill * 100}%` }} />
    </button>
  )
}, propsEqual)

function propsEqual(prev: Props, next: Props): boolean {
  return (
    prev.entryId === next.entryId &&
    prev.dateIso === next.dateIso &&
    prev.excerpt === next.excerpt &&
    prev.maxLines === next.maxLines &&
    prev.match === next.match &&
    prev.dim === next.dim &&
    prev.active === next.active &&
    prev.selected === next.selected &&
    prev.context === next.context &&
    prev.echo === next.echo &&
    prev.wallKey === next.wallKey &&
    prev.tabIndex === next.tabIndex &&
    // Compared, not assumed stable. The wall keeps them stable with useCallback,
    // so this costs five reference checks; if one ever stops being stable the
    // memo quietly stops helping rather than quietly going wrong.
    prev.onFocus === next.onFocus &&
    prev.onKeyDown === next.onKeyDown &&
    prev.onOpen === next.onOpen &&
    prev.onEdit === next.onEdit &&
    prev.onClick === next.onClick &&
    prev.onOpenMenu === next.onOpenMenu
  )
}
