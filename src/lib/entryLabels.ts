import { isSpiritualFenceLine, parseSpiritualBlocks, stripSpiritualBlocks } from './spiritualBlocks'
import { isPracticeTokenLine, practiceNameFromLine } from './practiceTokens'
import { ATTACHMENT_REF_RE } from './attachments'
import { stripMarkdownMarkers } from './inlineMarkers'
import { writerWords } from './writerWords'

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
    // The Summit's old year-naming marker (`<!-- summit:year:2026 -->`) — never
    // prose, and never a title. New naming pages don't write it.
    if (/^<!-- summit:year:\d{4} -->$/.test(trimmed)) continue
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
  // A title is the writer's own line (Guardrail H3): read writerWords, so a verse
  // quoted into a SOAP/Lectio answer can never become the page's name, and pass
  // over `>` lines the way isNonTitleLine does.
  const own = entryContentLines(writerWords(asEntryMarkdown(markdown)))
  const first = own.find((line) => !line.startsWith('>'))
  if (first) {
    return stripMarkdownMarkers(first).trim()
  }
  // No written content yet — a freshly-begun practice (or a scripture ritual
  // with nothing written but its quoted verses) should show its name.
  for (const raw of asEntryMarkdown(markdown).split('\n')) {
    const name = practiceNameFromLine(raw.trim())
    if (name) return name
  }
  // A page that is only an ordinary `> quote` keeps it as its title, as before;
  // a verse quote never reaches here (writerWords took it out).
  if (own[0]) return stripMarkdownMarkers(own[0]).trim()
  // Still nothing prose-like — surface a lone spiritual block (a /scripture
  // insert with no other writing) instead of falling through to "Untitled".
  return spiritualBlockLabel(markdown)?.title ?? ''
}

/** One-line body preview — verbatim prose, scaffolding-free. */
export function deriveEntryPreview(
  markdown: string | null | undefined,
  maxLength = 80,
): string | null {
  // Her words only (Guardrail H3): a verse quoted into a SOAP/Lectio answer
  // never previews as the page's prose.
  for (const line of entryContentLines(writerWords(asEntryMarkdown(markdown)))) {
    if (line.startsWith('/')) continue
    if (line.length < 4) continue
    // `>` used to be stripped by a character class here, which also deleted any
    // mid-sentence ">" from a preview. It's a line prefix, so it belongs with
    // the other line markers.
    const cleaned = stripMarkdownMarkers(line).replace(/\s+/g, ' ').trim()
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
