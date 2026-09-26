// Mirror of src/lib/entryLabels.ts for server-side rollup generation.

import { writerWords } from './writerWords.js'

/** One title line, its markdown markers removed. */
function cleanTitleLine(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s*/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[*_`~]/g, '')
    .trim()
}

const RITUAL_NAME = /^<!--\s*(?:ritual|practice):name:(.+?)\s*-->$/

/**
 * The first line the writer wrote. Read from writerWords (Guardrail H3), so a
 * ritual token, a Scripture passage or a verse quoted into a SOAP/Lectio answer
 * can never become the page's name in rollup prose; every other ``` block
 * (prayer, sense) is passed over whole, and `>` lines are passed over like the
 * app's isNonTitleLine does. A ritual page with nothing written falls back to
 * the ritual's name; a page that is only an ordinary `> quote` keeps it.
 */
export function deriveTitle(markdown: string): string {
  const lines: string[] = []
  let inFence = false
  for (const raw of writerWords(markdown).split('\n')) {
    const line = raw.trim()
    if (line.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence || !line || line.startsWith('<!--')) continue
    lines.push(line)
  }
  const first = lines.find((l) => !l.startsWith('>'))
  if (first) return cleanTitleLine(first)
  for (const raw of (markdown ?? '').split('\n')) {
    const name = raw.trim().match(RITUAL_NAME)
    if (name) return name[1]!.trim()
  }
  return lines[0] ? cleanTitleLine(lines[0]) : ''
}

export function formatEntryLabel(title: string, dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  const when = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const name = title.trim() || 'Untitled'
  return `${name} (${when})`
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

export function humanizeObservationText(
  text: string,
  labels: Record<string, string>,
): string {
  return text.replace(UUID_RE, (uuid) => {
    const key = uuid.toLowerCase()
    return labels[key] ?? labels[uuid] ?? 'an entry'
  })
}

export function labelsFromEntries(
  entries: { id: string; created_at: string; body_markdown: string }[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of entries) {
    const title = deriveTitle(e.body_markdown) || 'Untitled'
    out[e.id] = formatEntryLabel(title, e.created_at.slice(0, 10))
  }
  return out
}
