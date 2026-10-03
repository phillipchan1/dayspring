import { memo, useLayoutEffect, useRef, useState } from 'react'
import { MARK_KIND } from '@/lib/markKinds'
import type { SpiritualItemType } from '@/lib/types'
import type { PageExcerpt } from './pageExcerpt'
import { pageFill, splitOnMatch } from './pageExcerpt'
import { useWallPointer } from './useWallPointer'
import { NO_PHOTOS, ROW_PRINTS, type PagePhoto } from './pagePhotos'
import { PhotoStrip } from './PhotoStrip'

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
  /** The page you just came back from — warm for a moment, then not. */
  here?: boolean | undefined
  /** Part of the current multi-selection. */
  selected: boolean
  /** The card a context menu is currently pointing at. */
  context: boolean
  /** Set when this page has risen out of another year. */
  echo?: string | undefined
  /**
   * The declared kinds this page carries, for the margin.
   *
   * Down the RIGHT of the card, the way a Bible does it. They used to have
   * nowhere to go on a card at all: rule 1 says nothing goes on a page except
   * her words, her date and her markings — and "on" is doing real work in that
   * sentence. A hand printed over a sentence is not a margin, it is a stamp.
   */
  markings?: readonly SpiritualItemType[] | undefined
  /**
   * The photos on the page (D-034). A card stands closer than a row, so where a
   * row draws a print in the photo's colour, a card shows the photo: the set as
   * one row at the foot of the page, every photo whole, under her words. A page
   * that is only photos gives the card to them.
   */
  photos?: readonly PagePhoto[] | undefined
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
 * Everything on it is the writer's: their sentences, their date, their emphases,
 * the photos they put there (D-034).
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
  here = false,
  selected,
  context,
  echo,
  markings,
  photos = NO_PHOTOS,
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
  const empty = shown.length === 0 && excerpt.rituals.length === 0
  const pictured = photos.length > 0 ? (photos.length > ROW_PRINTS ? photos.slice(0, ROW_PRINTS) : photos) : null
  const photoOnly = pictured !== null && excerpt.photoOnly === true
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
      data-here={here ? 'true' : undefined}
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

      <div className="pgc__cols">
      <div className="pgc__body">
        {photoOnly ? (
          <CardPhotos photos={pictured} whole caption={pictured.find((p) => p.caption)?.caption ?? null} />
        ) : empty ? (
          <p className="pgc__blank">Blank page</p>
        ) : (
          <>
          {excerpt.rituals.map((name, i) => (
            <p className="pgc__ritual" key={`${name}-${i}`}>
              {name}
              {i === 0 && excerpt.passage ? <span className="pgc__passage"> · {excerpt.passage}</span> : null}
            </p>
          ))}
          {shown.map((line, i) => (
            <p
              key={i}
              className="pgc__line"
              data-quote={line.verse !== undefined ? 'true' : undefined}
              data-set={line.set ? 'true' : undefined}
              data-hit={line.hit ? 'true' : undefined}
            >
              {line.label ? <span className="pgc__movement">{line.label}</span> : null}
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
              {line.verse ? <span className="pgc__verse">{line.verse}</span> : null}
            </p>
          ))}
          </>
        )}
      </div>
      {markings && markings.length > 0 ? (
        <span className="pgc__margin" aria-hidden>
          {markings.slice(0, 4).map((kind) => (
            <span
              key={kind}
              className="pgc__mark"
              style={{ background: MARK_KIND[kind]?.tone }}
            />
          ))}
        </span>
      ) : null}
      {/* Above the photos, not over them: the words end mid-sentence and the
          photos start whole. */}
      {truncated && pictured ? <span className="pgc__fade pgc__fade--cols" aria-hidden /> : null}
      </div>

      {pictured && !photoOnly ? <CardPhotos photos={pictured} whole={false} caption={null} /> : null}
      {truncated && !pictured ? <span className="pgc__fade" aria-hidden /> : null}
      <span className="pgc__thickness" aria-hidden style={{ inlineSize: `${fill * 100}%` }} />
    </button>
  )
}, propsEqual)

/** Of the card's height, what the photos under her words may take. */
const PHOTO_SHARE = 0.36

/**
 * The photos, sized to the card they are on.
 *
 * Measured rather than computed from the zoom, because the card's width is the
 * grid's to decide and the photos must fit it exactly: a row of them too wide
 * gets shorter, never cropped.
 */
function CardPhotos({
  photos,
  whole,
  caption,
}: {
  photos: readonly PagePhoto[]
  /** The page is only photos: they take the card, her caption under them. */
  whole: boolean
  caption: string | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const card = el?.closest('.pgc')
    if (!el || !card) return
    const measure = () => {
      const w = el.clientWidth
      const h = whole ? el.clientHeight : card.clientHeight * PHOTO_SHARE
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(card)
    return () => ro.disconnect()
  }, [whole])

  return (
    <div ref={ref} className={whole ? 'pgc__photos pgc__photos--whole' : 'pgc__photos'}>
      {box && box.w > 0 && box.h > 0 ? (
        <PhotoStrip
          photos={photos}
          maxWidth={box.w}
          maxHeight={whole && caption ? box.h - CAPTION_PX : box.h}
          className="pgc__strip"
        />
      ) : null}
      {whole && caption ? <p className="pgc__caption">{caption}</p> : null}
    </div>
  )
}

/** Room kept under a whole-card photo for her caption. */
const CAPTION_PX = 26

function propsEqual(prev: Props, next: Props): boolean {
  return (
    prev.entryId === next.entryId &&
    prev.dateIso === next.dateIso &&
    prev.excerpt === next.excerpt &&
    prev.maxLines === next.maxLines &&
    prev.match === next.match &&
    prev.dim === next.dim &&
    prev.active === next.active &&
    prev.here === next.here &&
    prev.selected === next.selected &&
    prev.context === next.context &&
    prev.echo === next.echo &&
    prev.markings === next.markings &&
    prev.photos === next.photos &&
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
