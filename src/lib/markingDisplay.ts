import { parseSpiritualBlocks, type ParsedSpiritualBlock } from './spiritualBlocks'

/**
 * How a marking block is read back, once the page is no longer being written.
 *
 * A ```` ```dayspring-* ```` fence is how a `/pray` or a `/scripture` is
 * stored, and to a markdown renderer it is a code block: a monospaced box with
 * a UUID on its first line. The reader used to avoid that by removing the fences
 * before rendering. Their words then turned up as a faint note in the side
 * column, without the verse reference and nowhere near where they were
 * written. On a ritual page the scripture in the After seemed to have gone
 * missing altogether.
 *
 * So each fence is drawn where it sits, following the editor's rule: **your
 * words get marked, borrowed words get set apart.**
 *
 * - Scripture becomes a `<figure>`: the verse, then its citation. The verse is
 *   borrowed text, so it is escaped and never parsed as markdown. A verse
 *   starting "1. In the beginning" must not turn into a list.
 * - Every other kind is the writer's own sentence. It stays prose, markdown
 *   and all, inside a `<div>` that names its kind. The reader hangs the kind's
 *   hand beside it (`drawMarkings`), just as it does for a marking found in
 *   the prose.
 *
 * Both carry `data-kind`, which is how the reader finds them again after
 * rendering.
 *
 * The blank lines around each block are required. A markdown HTML block runs
 * until the next blank line, so without the one after, the sentence written
 * below a verse would be swallowed into it as raw, unrendered text.
 */
export function revealMarkingsForDisplay(markdown: string): string {
  const blocks = parseSpiritualBlocks(markdown)
  if (blocks.length === 0) return markdown

  let out = ''
  let at = 0
  for (const block of blocks) {
    out += markdown.slice(at, block.from)
    const drawn = drawBlock(block)
    if (drawn) out += `\n${drawn}\n\n`
    at = block.to
  }
  return out + markdown.slice(at)
}

function drawBlock(block: ParsedSpiritualBlock): string | null {
  const content = block.content.replace(/\s+$/, '')
  if (!content.trim()) return null

  if (block.type === 'scripture') {
    // One line of HTML on purpose: a blank line inside a multi-paragraph
    // passage would otherwise end the HTML block halfway through the verse.
    const verse = content
      .split('\n')
      .map((line) => escapeHtml(line.trim()))
      .join('<br>')
    const cite = block.reference?.trim()
    return (
      `<figure class="read-scripture" data-kind="scripture"><p>${verse}</p>` +
      (cite ? `<figcaption class="read-scripture__cite spiritual-cite">${escapeHtml(cite)}</figcaption>` : '') +
      `</figure>`
    )
  }

  return `<div class="read-mark read-mark--${block.type}" data-kind="${block.type}">\n\n${content}\n\n</div>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
