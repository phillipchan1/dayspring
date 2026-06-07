import { isSpiritualFenceLine, stripSpiritualBlocks } from './spiritualBlocks'
import { isPracticeTokenLine, practiceNameFromLine } from './practiceTokens'
import { ATTACHMENT_REF_RE } from './attachments'

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
  return ''
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
