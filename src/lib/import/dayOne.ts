// Day One JSON export → `entries` rows.
//
// Day One exports a .zip containing one JSON file per journal at the root
// (`Journal.json`, plus `<Name>.json` for additional journals) alongside media
// folders (photos/, videos/, …) that we don't import. Each JSON looks like:
//   { "metadata": { "version": "1.0" },
//     "entries": [ { "uuid", "creationDate", "text", "tags", "starred", … } ] }
//
// Unlike Diarly, Day One records a true timestamp per entry, so we keep the full
// `creationDate`. `text` is escaped Markdown with `dayone-moment://` embeds for
// attachments; we unescape it and drop the embeds (attachments aren't imported).

import { wordCount } from '../entries'
import { deriveImportTitle, extractTags } from '../diarlyImport'
import type { ImportedEntry, ImportParseResult, SkippedFile } from './types'

/** Media/asset folders that may also contain JSON sidecars we must ignore. */
const MEDIA_DIRS = new Set(['photos', 'videos', 'audios', 'audio', 'video', 'pdfs', 'attachments'])

interface DayOneEntry {
  uuid?: string
  creationDate?: string
  text?: string
  tags?: unknown
  starred?: boolean
}

interface DayOneJournal {
  metadata?: { version?: string }
  entries?: DayOneEntry[]
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** The journal name = the JSON file's basename without extension. */
function journalName(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return (parts[parts.length - 1] ?? path).replace(/\.json$/i, '')
}

/** A .json that lives in a media folder is a sidecar, not a journal export. */
function isMediaSidecar(path: string): boolean {
  return path.split('/').some((seg) => MEDIA_DIRS.has(seg.toLowerCase()))
}

/**
 * Day One's `text` is escaped Markdown: punctuation is backslash-escaped and
 * attachments appear as `![](dayone-moment://UUID)`. Unescape the punctuation
 * and convert attachment embeds to `attachment-pending:UUID` — a stable,
 * source-agnostic placeholder that importImages.ts later resolves to a real
 * `attachment:<sha256>.<ext>` ref after uploading the file.
 */
export function cleanDayOneText(text: string): string {
  return stripBom(text)
    .replace(
      /!\[([^\]]*)\]\(dayone-moment:\/\/([^)]+)\)/g,
      '![$1](attachment-pending:$2)',
    )
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/g, '$1') // unescape ASCII punctuation
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Merge inline-derived tags with Day One's explicit tag array (lowercased, deduped). */
function mergeTags(base: string[], explicit: unknown): string[] {
  const set = new Set(base)
  if (Array.isArray(explicit)) {
    for (const t of explicit) {
      if (typeof t !== 'string') continue
      const v = t.trim().toLowerCase()
      if (v) set.add(v)
    }
  }
  return [...set]
}

/** Map one Day One entry to an `ImportedEntry`, or record why it was skipped. */
function parseEntry(
  raw: DayOneEntry,
  journal: string,
  skipped: SkippedFile[],
): ImportedEntry | null {
  const id = typeof raw.uuid === 'string' && raw.uuid ? raw.uuid : null
  const created = typeof raw.creationDate === 'string' ? raw.creationDate : null
  const where = `${journal} · ${id ?? 'entry'}`

  if (!created || Number.isNaN(Date.parse(created))) {
    skipped.push({ path: where, reason: 'Missing or invalid creationDate' })
    return null
  }

  const body = cleanDayOneText(typeof raw.text === 'string' ? raw.text : '')
  // Prefer the stable uuid as the dedup key; fall back to journal + timestamp.
  const externalId = id ?? `${journal}/${created}`

  return {
    external_id: externalId,
    created_at: new Date(created).toISOString(),
    body_markdown: body,
    title: deriveImportTitle(body),
    tags: mergeTags(extractTags(body, journal), raw.tags),
    word_count: wordCount(body),
  }
}

/**
 * Parse a Day One JSON export zip. Walks every root-level .json, skips media
 * sidecars, and dedupes by external_id (last wins) so a single zip can never
 * produce two rows that collide on upsert.
 */
export async function parseDayOneZip(data: ArrayBuffer | Blob): Promise<ImportParseResult> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(data)

  const jsonFiles = Object.values(zip.files).filter(
    (f) => !f.dir && /\.json$/i.test(f.name) && !isMediaSidecar(f.name),
  )

  const byExternalId = new Map<string, ImportedEntry>()
  const skipped: SkippedFile[] = []

  for (const file of jsonFiles) {
    const journal = journalName(file.name)
    let parsed: DayOneJournal
    try {
      parsed = JSON.parse(stripBom(await file.async('string'))) as DayOneJournal
    } catch {
      skipped.push({ path: file.name, reason: 'Not valid JSON' })
      continue
    }

    if (!Array.isArray(parsed.entries)) {
      skipped.push({ path: file.name, reason: 'No "entries" array — not a Day One export?' })
      continue
    }

    for (const raw of parsed.entries) {
      const entry = parseEntry(raw, journal, skipped)
      if (entry) byExternalId.set(entry.external_id, entry)
    }
  }

  const dated = [...byExternalId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))

  const dateRange =
    dated.length > 0
      ? { earliest: dated[0]!.created_at, latest: dated[dated.length - 1]!.created_at }
      : null

  skipped.sort((a, b) => a.path.localeCompare(b.path))

  return { dated, skipped, dateRange }
}
