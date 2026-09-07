import type { ReactNode } from 'react'
import { formatDate, type MarkingKind } from '../corpus'
import { KIND_META } from '../kinds'
import { Glyph } from '../Glyph'

export type Line = { entryId: string; date: string; text: string; kind?: MarkingKind }

/**
 * A column of her own sentences, oldest first.
 *
 * EVERY matching line is shown, and the count in the header equals what is on
 * screen. The moment it shows the best eight of forty, something selected them,
 * and selection is significance, and significance is a verdict (D-016). So
 * there is no "top results" here and there never can be.
 */
export function Lines({
  lines,
  head,
  onOpen,
}: {
  lines: Line[]
  head: ReactNode
  onOpen?: (id: string) => void
}) {
  return (
    <>
      <p className="meta">{head}</p>
      <div className="thread">
        {lines.map((l, i) => (
          <button
            type="button"
            className="strand"
            key={`${l.entryId}-${i}`}
            style={
              l.kind
                ? ({ ['--strand-tone' as string]: `var(--k-${KIND_META[l.kind].tone})` } as React.CSSProperties)
                : undefined
            }
            onClick={() => onOpen?.(l.entryId)}
          >
            <span className="strand__date">{formatDate(l.date)}</span>
            {l.kind ? (
              <span className="strand__glyph">
                <Glyph kind={l.kind} size={16} />
              </span>
            ) : null}
            <p className="strand__text">{l.text}</p>
          </button>
        ))}
      </div>
    </>
  )
}
