// Detect a Bible-app paste (verse body + citation) so we can wrap it as a
// scripture fence. Conservative on purpose: a missed wrap stays prose; a wrong
// wrap is shown as "your verse."

import { parseReferences, type ParsedRef } from './parse'

const MIN_BODY = 20
const MAX_BODY = 2000

/** Trailing chrome Bible apps append after the citation. */
const FOOTER_RE =
  /^(©|copyright|\(esv\)|esv®?$|niv®?$|nlt$|csb$|kjv$|nasb$|amp$|nkjv$|english standard version|new international version|new living translation|youversion|bible\.com|crossway|good news publishers|all rights reserved|holy bible)/i

export interface DetectedScripturePaste {
  body: string
  reference: string
}

function stripFooters(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  while (lines.length > 0) {
    const last = lines[lines.length - 1]!.trim()
    if (!last || FOOTER_RE.test(last)) lines.pop()
    else break
  }
  return lines.join('\n').trim()
}

function formatReference(r: ParsedRef): string {
  if (r.verse_start == null) return `${r.book_name} ${r.chapter}`
  if (r.verse_end == null) return `${r.book_name} ${r.chapter}:${r.verse_start}`
  return `${r.book_name} ${r.chapter}:${r.verse_start}-${r.verse_end}`
}

/** A line that is mostly one high-confidence verse citation, not a chapter dump. */
function citationFromLine(line: string): ParsedRef | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/\b([a-z])/g, (c) => c.toUpperCase())
  const refs = parseReferences(normalized).filter((r) => r.confidence >= 1)
  if (refs.length !== 1) return null
  const r = refs[0]!
  if (r.verse_start == null) return null
  const span = r.char_end - r.char_start
  if (span / trimmed.length < 0.45) return null
  return r
}

/**
 * If `text` looks like a Bible-app paste, return the verse body and a clean
 * citation. Otherwise null — the caller must paste as plain text.
 */
export function detectScripturePaste(text: string): DetectedScripturePaste | null {
  const cleaned = stripFooters(text)
  if (!cleaned) return null

  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return null

  const last = lines[lines.length - 1]!
  const first = lines[0]!
  let ref = citationFromLine(last)
  let bodyLines = lines.slice(0, -1)
  if (!ref) {
    ref = citationFromLine(first)
    bodyLines = lines.slice(1)
  }
  if (!ref) return null

  const body = bodyLines.join('\n').trim()
  if (body.length < MIN_BODY || body.length > MAX_BODY) return null

  return { body, reference: formatReference(ref) }
}
