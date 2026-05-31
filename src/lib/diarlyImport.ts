// Diarly Markdown export → `entries` rows.
//
// Diarly's Markdown export lays files out as:
//   Export/<Journal>/<Year>/MM-DD.md   -> a dated daily entry
//   Export/<Journal>/<Year>/Data/...   -> attachments (skipped this phase)
//   Export/<Journal>/<file>.md         -> an undated note (no Year folder)
// There is no frontmatter — the entry date comes ONLY from <Year> + MM-DD in
// the path, pinned to noon UTC so a timezone can never flip the calendar day.

import JSZip from 'jszip'
import { wordCount } from './entries'

/** A dated file we can import, already mapped to `entries` columns. */
export interface ParsedDiarlyEntry {
  external_id: string // '<Journal>/<Year>/MM-DD' — the dedup key
  created_at: string // '<Year>-MM-DDT12:00:00.000Z'
  body_markdown: string
  title: string | null
  tags: string[]
  word_count: number
}

/** A .md file with no resolvable date — never guessed, surfaced for manual handling. */
export interface UndatedDiarlyFile {
  path: string // full path inside the zip
  journal: string | null
}

export interface DiarlyParseResult {
  dated: ParsedDiarlyEntry[]
  undated: UndatedDiarlyFile[]
  /** Earliest/latest created_at across dated entries (ISO), or null when none. */
  dateRange: { earliest: string; latest: string } | null
}

const MD_EXT = /\.md$/i
// MM-DD, optionally with Diarly's _N suffix for a 2nd+ entry on the same day
// (01-03.md, 01-03_1.md, 01-03_2.md …). The date is the same; the full basename
// keeps each entry's external_id distinct.
const MM_DD = /^(\d{2})-(\d{2})(?:_\d+)?$/
const YEAR = /^\d{4}$/

/** Strip a leading UTF-8 BOM that some exporters prepend. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** Clean a candidate title line: drop leading block markers + inline emphasis. */
function cleanTitleLine(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '') // headings
    .replace(/^>\s+/, '') // quotes
    .replace(/^[-*+]\s+/, '') // bullets
    .replace(/^\d+\.\s+/, '') // ordered list
    .replace(/[*_`~]/g, '') // inline emphasis marks
    .trim()
}

/**
 * Title = first H1 line, else the first short (<=80 char) non-empty line,
 * else null. Mirrors the editor's deriveTitle heuristic.
 */
export function deriveImportTitle(body: string): string | null {
  const lines = body.split('\n')

  for (const raw of lines) {
    const t = raw.trim()
    const h1 = t.match(/^#\s+(.+)$/)
    if (h1) {
      const cleaned = cleanTitleLine(h1[1]!)
      if (cleaned) return cleaned
    }
  }

  for (const raw of lines) {
    const t = raw.trim()
    if (!t) continue
    if (t.length <= 80) {
      const cleaned = cleanTitleLine(t)
      if (cleaned) return cleaned
    }
  }

  return null
}

/**
 * Tags = inline #hashtags + [[wikilinks]] + the journal folder name,
 * lowercased and deduped. Headings (`# `, `## `) are not hashtags because a
 * hashtag's first character is alphanumeric, never whitespace.
 */
export function extractTags(body: string, journal: string | null): string[] {
  const tags = new Set<string>()

  const hashtag = /(?:^|\s)#([A-Za-z0-9_][A-Za-z0-9_-]*)/g
  for (const m of body.matchAll(hashtag)) {
    tags.add(m[1]!.toLowerCase())
  }

  const wikilink = /\[\[([^\]]+)\]\]/g
  for (const m of body.matchAll(wikilink)) {
    // Support `[[Page|alias]]` — the link target is the part before the pipe.
    const target = m[1]!.split('|')[0]!.trim()
    if (target) tags.add(target.toLowerCase())
  }

  if (journal) tags.add(journal.toLowerCase())

  return [...tags]
}

/** True only for a real calendar date (rejects 02-30, 13-01, etc.). */
function isValidDate(year: string, mm: string, dd: string): boolean {
  const d = new Date(`${year}-${mm}-${dd}T12:00:00.000Z`)
  return (
    !Number.isNaN(d.getTime()) &&
    d.getUTCFullYear() === Number(year) &&
    d.getUTCMonth() + 1 === Number(mm) &&
    d.getUTCDate() === Number(dd)
  )
}

/**
 * Classify a single .md file by its path. Returns a parsed dated entry when the
 * path ends in <Year>/MM-DD.md with a valid calendar date, otherwise null
 * (the caller records it as undated — we never guess a date).
 */
export function parseDiarlyFile(path: string, body: string): ParsedDiarlyEntry | null {
  const parts = path.split('/').filter(Boolean)
  const filename = parts[parts.length - 1] ?? ''
  const base = filename.replace(MD_EXT, '')
  const parent = parts[parts.length - 2]

  const md = base.match(MM_DD)
  if (!md || !parent || !YEAR.test(parent)) return null

  const [, mm, dd] = md
  const year = parent
  if (!isValidDate(year, mm!, dd!)) return null

  const journal = parts[parts.length - 3] ?? null
  const externalId = journal ? `${journal}/${year}/${base}` : `${year}/${base}`
  const clean = stripBom(body)

  return {
    external_id: externalId,
    created_at: `${year}-${mm}-${dd}T12:00:00.000Z`,
    body_markdown: clean,
    title: deriveImportTitle(clean),
    tags: extractTags(clean, journal),
    word_count: wordCount(clean),
  }
}

/** The journal folder of an undated note: the segment directly above the file. */
function undatedJournal(path: string): string | null {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 2] ?? null
}

/** True for any path inside a Diarly attachments folder (`data/` — any case). */
function isAttachment(path: string): boolean {
  return path.split('/').some((seg) => seg.toLowerCase() === 'data')
}

/**
 * Parse a Diarly Markdown export zip. Walks every .md file, skips attachments,
 * and dedupes dated entries by external_id (last file wins) so a single zip can
 * never produce two rows that would collide on upsert.
 */
export async function parseDiarlyZip(data: ArrayBuffer | Blob): Promise<DiarlyParseResult> {
  const zip = await JSZip.loadAsync(data)

  const datedByExternalId = new Map<string, ParsedDiarlyEntry>()
  const undated: UndatedDiarlyFile[] = []

  const files = Object.values(zip.files).filter(
    (f) => !f.dir && MD_EXT.test(f.name) && !isAttachment(f.name),
  )

  for (const file of files) {
    const body = await file.async('string')
    const parsed = parseDiarlyFile(file.name, body)
    if (parsed) {
      datedByExternalId.set(parsed.external_id, parsed)
    } else {
      undated.push({ path: file.name, journal: undatedJournal(file.name) })
    }
  }

  const dated = [...datedByExternalId.values()].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )

  const dateRange =
    dated.length > 0
      ? { earliest: dated[0]!.created_at, latest: dated[dated.length - 1]!.created_at }
      : null

  undated.sort((a, b) => a.path.localeCompare(b.path))

  return { dated, undated, dateRange }
}
