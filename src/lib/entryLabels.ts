import { isSpiritualFenceLine } from './spiritualBlocks'

/** Coerce nullable entry bodies to a string safe for editors and labels. */
export function asEntryMarkdown(markdown: string | null | undefined): string {
  return markdown ?? ''
}

/** Derive a short display title from markdown (first non-empty line). */
export function deriveTitle(markdown: string | null | undefined): string {
  const line = asEntryMarkdown(markdown)
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !isSpiritualFenceLine(l))
  if (!line) return ''
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[*_`~]/g, '')
    .trim()
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
