import { isSpiritualFenceLine, parseSpiritualBlocks, stripSpiritualBlocks } from './spiritualBlocks'
import { isPracticeTokenLine, practiceNameFromLine } from './practiceTokens'
import { ATTACHMENT_REF_RE } from './attachments'

/**
 * Label fallback for an entry with no prose — just a spiritual block (e.g. a
 * `/scripture` insert and nothing else). Surfaces something meaningful instead
 * of "Untitled": a scripture's reference as the title and its verse as the
 * preview; a prayer/sense's own words as the title.
 */
function spiritualBlockLabel(
  markdown: string | null | undefined,
): { title: string; preview: string | null } | null {
  const [block] = parseSpiritualBlocks(asEntryMarkdown(markdown))
  if (!block) return null
  const content = block.content.replace(/\s+/g, ' ').trim()
  if (block.type === 'scripture') {
    // Reference is stored as "Psalm 121:7-8 · ESV" — drop the translation so the
    // title reads as a clean citation; the verse becomes the preview.
    const reference = (block.reference ?? '').split('·')[0]!.trim()
    return { title: reference || content || 'Scripture', preview: content || null }
  }
  // Prayer / sense: the user's own words are the most meaningful label.
  const fallbackName = block.type === 'prayer' ? 'Prayer' : 'Reflection'
  return { title: content || fallbackName, preview: null }
}

/** Coerce nullable entry bodies to a string safe for editors and labels. */
export function asEntryMarkdown(markdown: string | null | undefined): string {
  return markdown ?? ''
}

/**
 * Human-readable content lines from an entry body, with every slash-snippet
 * scaffold removed so titles, previews, and search never surface raw markup:
 * spiritual blocks (prayer/sense/scripture fences) are dropped whole, practice
 * tokens are skipped, and inline photo refs are stripped. Order is preserved.
 */
export function entryContentLines(markdown: string | null | undefined): string[] {
  const stripped = stripSpiritualBlocks(asEntryMarkdown(markdown))
  const out: string[] = []
  for (const raw of stripped.split('\n')) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    if (isPracticeTokenLine(trimmed)) continue
    // Defensive: stripSpiritualBlocks removes well-formed fences, but skip any
    // stray opener (e.g. an unclosed block) so the `dayspring-*` token can't leak.
    if (isSpiritualFenceLine(trimmed)) continue
    const line = trimmed.replace(ATTACHMENT_REF_RE, '').trim()
    if (!line) continue
    out.push(line)
  }
  return out
}

/** Derive a short display title from markdown (first meaningful content line). */
export function deriveTitle(markdown: string | null | undefined): string {
  const [first] = entryContentLines(markdown)
  if (first) {
    return first
      .replace(/^#{1,6}\s+/, '')
      .replace(/^>\s+/, '')
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/[*_`~]/g, '')
      .trim()
  }
  // No written content yet — a freshly-begun practice should show its name
  // rather than nothing.
  for (const raw of asEntryMarkdown(markdown).split('\n')) {
    const name = practiceNameFromLine(raw.trim())
    if (name) return name
  }
  // Still nothing prose-like — surface a lone spiritual block (a /scripture
  // insert with no other writing) instead of falling through to "Untitled".
  return spiritualBlockLabel(markdown)?.title ?? ''
}

/** One-line body preview for the entry list — verbatim prose, scaffolding-free. */
export function deriveEntryPreview(
  markdown: string | null | undefined,
  maxLength = 80,
): string | null {
  for (const line of entryContentLines(markdown)) {
    if (line.startsWith('/')) continue
    if (line.length < 4) continue
    const cleaned = line
      .replace(/^#{1,6}\s+/, '')
      .replace(/[*_~`>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleaned) continue
    return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trimEnd() + '…' : cleaned
  }
  // No prose — preview the verse of a lone scripture block (its reference is
  // already the title), so a scripture-only entry reads as ref + verse.
  const blockPreview = spiritualBlockLabel(markdown)?.preview
  if (blockPreview) {
    return blockPreview.length > maxLength
      ? blockPreview.slice(0, maxLength).trimEnd() + '…'
      : blockPreview
  }
  return null
}

/** Human-readable cite for an entry in rollup prose, e.g. "Trading notes (Apr 7)". */
export function formatEntryLabel(title: string, dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  const when = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const name = title.trim() || 'Untitled'
  return `${name} (${when})`
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Replace raw entry UUIDs in observation copy with readable labels. */
export function humanizeObservationText(
  text: string,
  labels: Record<string, string>,
): string {
  return text.replace(UUID_RE, (uuid) => {
    const key = uuid.toLowerCase()
    return labels[key] ?? labels[uuid] ?? 'an entry'
  })
}
