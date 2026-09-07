/**
 * What is on, as chips.
 *
 * Pulled out of `LookFor` because it is now rendered in two places, and those
 * two places are the whole point: the bar above the wall, and the bar above an
 * OPEN page. Opening a page used to throw the filter away — the header emptied,
 * and the way back said "All entries" while a filter was still on, which is a
 * lie the reader has no way to catch. The filter is the through line; it is the
 * only reason you are looking at this page rather than another one.
 *
 * Removable in both places, and that is deliberate. A chip you can see but not
 * take off is a status light, and this surface does not have any: everything
 * that is on is visible, and every one of them comes off the same way.
 */

import { MarkGlyph } from '@/components/MarkGlyph'
import type { SpiritualItemType } from '@/lib/types'

export interface LookChip {
  key: string
  label: string
  kind: 'subject' | 'marking'
  tone?: string
  /** For a marking chip: which of the six, so it can wear its own hand. */
  mark?: SpiritualItemType
}

export function LitChips({
  chips,
  onRemove,
}: {
  chips: LookChip[]
  onRemove: (key: string) => void
}) {
  return (
    <>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="pg-held"
          data-kind={c.kind}
          style={c.tone ? ({ ['--tone']: c.tone } as React.CSSProperties) : undefined}
          onClick={() => onRemove(c.key)}
          aria-label={`Stop looking for ${c.label}`}
        >
          {c.mark ? <MarkGlyph kind={c.mark} className="pg-held__glyph" /> : null}
          {c.label}
          <svg viewBox="0 0 8 8" width="7" height="7" fill="none" aria-hidden>
            <path
              d="M1.5 1.5 6.5 6.5M6.5 1.5 1.5 6.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ))}
    </>
  )
}
