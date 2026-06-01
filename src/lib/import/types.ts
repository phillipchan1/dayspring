// A source-agnostic import result. Every importer (Diarly, Day One, …) parses
// its export format entirely in the browser and produces this shape, which the
// shared import UI renders and `upsertImportedEntries` writes.

import type { ImportedEntry } from '../entries'

/** A file we could not turn into a dated entry — surfaced, never silently dropped. */
export interface SkippedFile {
  /** A human-pointable location (a path inside the zip, or "<journal> · <id>"). */
  path: string
  /** Why it was skipped, shown verbatim to the writer. */
  reason: string
}

export interface ImportParseResult {
  /** Entries ready to upsert, sorted oldest → newest. */
  dated: ImportedEntry[]
  /** Files/records we deliberately did not import. */
  skipped: SkippedFile[]
  /** Earliest/latest created_at across `dated` (ISO), or null when empty. */
  dateRange: { earliest: string; latest: string } | null
}

export type { ImportedEntry }
