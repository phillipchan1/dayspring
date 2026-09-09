import { PRACTICE_SECTION_RE, practiceNameFromLine } from './practiceTokens'

/**
 * How a ritual is read back, once it is no longer being prayed.
 *
 * The tokens are HTML comments, so marked (and anything else that renders
 * the entry) drops them and leaves only the answers — a page that was an
 * Examen reads as four unmarked sentences. This puts the name and the
 * answered movements back, as the record the writer chose, without the
 * questions (those are the app's voice, and belong to the composer).
 *
 * An unanswered movement stays silent. Showing an empty label would be a
 * form left unfinished, which this surface has no business saying.
 */
export function revealRitualsForDisplay(markdown: string): string {
  const out: string[] = []
  let pendingLabel: string | null = null

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim()
    const name = practiceNameFromLine(trimmed)
    if (name) {
      pendingLabel = null
      out.push(`<p class="read-ritual-name">${escapeHtml(name)}</p>`)
      continue
    }
    const section = PRACTICE_SECTION_RE.exec(trimmed)
    if (section) {
      pendingLabel = (section[1] ?? '').trim() || null
      continue
    }
    if (pendingLabel && trimmed) {
      out.push(`<p class="read-ritual-label">${escapeHtml(pendingLabel)}</p>`)
      pendingLabel = null
    }
    out.push(line)
  }
  return out.join('\n')
}

/** Ritual names in document order — what a page card can show without inventing. */
export function ritualNamesIn(markdown: string | null | undefined): string[] {
  const names: string[] = []
  for (const line of (markdown ?? '').split('\n')) {
    const name = practiceNameFromLine(line.trim())
    if (name) names.push(name)
  }
  return names
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
