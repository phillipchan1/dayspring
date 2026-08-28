import { markGlyphClass, markGlyphHtml } from '@/editor/markGlyph'
import type { SpiritualItemType } from '@/lib/types'

/**
 * A marking's hand, as a component.
 *
 * The shapes live in `editor/markGlyph.ts` and are drawn rather than iconified
 * — a rule, an ember, a bracket left open, the brace people actually draw
 * beside a paragraph they want to keep. They already appear in the editor's
 * margin and in the picker; this is the same drawing for everywhere else, so a
 * prayer reads as a prayer whether you meet it while writing or while reading
 * back.
 *
 * That reuse is the point. A fresh icon set for the read surface would be a
 * second vocabulary for the same six things, and stock glyphs would read as
 * somebody else's software sitting two inches from her own sentences.
 *
 * `dangerouslySetInnerHTML` is safe here and everywhere else this is used:
 * every string `markGlyphHtml` returns is a module constant, and nothing
 * user-supplied reaches it.
 */
export function MarkGlyph({
  kind,
  className,
}: {
  kind: SpiritualItemType
  className?: string
}) {
  /*
   * `markGlyphHtml` switches on a closed union, so TypeScript guarantees a
   * string — but `kind` reaches here from `spiritual_items.type`, and a row
   * carrying a value the client does not know about would arrive as `undefined`
   * and hand `dangerouslySetInnerHTML` nothing. A missing hand is a marking
   * without its drawing; a thrown render is a page the writer cannot read.
   */
  const html = markGlyphHtml(kind) as string | undefined
  if (!html) return null

  return (
    <span
      className={`${markGlyphClass(kind)}${className ? ` ${className}` : ''}`}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
