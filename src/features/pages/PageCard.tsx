import { memo } from 'react'
import type { PageExcerpt } from './pageExcerpt'
import { pageFill } from './pageExcerpt'

interface Props {
  entryId: string
  dateIso: string
  excerpt: PageExcerpt
  /** Subject lighting is on and this page doesn't carry it. */
  dim: boolean
  /** The page currently open in the editor. */
  active: boolean
  /** Set when this page has risen out of another year. */
  echo?: string | undefined
  onOpen: (entryId: string) => void
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
 */
export const PageCard = memo(function PageCard({
  entryId,
  dateIso,
  excerpt,
  dim,
  active,
  echo,
  onOpen,
}: Props) {
  const fill = pageFill(excerpt.chars)
  const empty = excerpt.lines.length === 0

  return (
    <button
      type="button"
      className="pgc"
      data-page-id={entryId}
      data-dim={dim ? 'true' : undefined}
      data-active={active ? 'true' : undefined}
      data-echo={echo ? 'true' : undefined}
      onClick={() => onOpen(entryId)}
    >
      {echo ? <span className="pgc__echo">{echo}</span> : null}
      <time className="pgc__date" dateTime={dateIso}>
        {formatDate(dateIso)}
      </time>

      <div className="pgc__body">
        {empty ? (
          <p className="pgc__blank">Blank page</p>
        ) : (
          excerpt.lines.map((line, i) => (
            <p key={i} className="pgc__line" data-set={line.set ? 'true' : undefined}>
              {line.text}
            </p>
          ))
        )}
      </div>

      {excerpt.truncated ? <span className="pgc__fade" aria-hidden /> : null}
      <span className="pgc__thickness" aria-hidden style={{ blockSize: `${fill * 100}%` }} />
    </button>
  )
}, propsEqual)

function propsEqual(prev: Props, next: Props): boolean {
  return (
    prev.entryId === next.entryId &&
    prev.dateIso === next.dateIso &&
    prev.excerpt === next.excerpt &&
    prev.dim === next.dim &&
    prev.active === next.active &&
    prev.echo === next.echo
  )
}
