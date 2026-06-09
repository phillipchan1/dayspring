import { findByName, type ImportArchive } from './archive'
import type { ImportParseResult } from './types'
import type { ImportedEntry } from '../entries'

interface BackupEntry {
  id: string
  created_at: string
  body_markdown: string
  title: string | null
  mood: string | null
  tags: string[]
  word_count: number
  source: string
  external_id: string | null
}

interface BackupManifest {
  version: number
  exported_at: string
  entry_count: number
  entries: BackupEntry[]
}

export async function parseDayspring(archive: ImportArchive): Promise<ImportParseResult> {
  const jsonFile = findByName(archive, 'entries.json')
  if (!jsonFile) throw new Error('Not a Dayspring backup — entries.json not found.')

  const text = await jsonFile.text()
  let manifest: BackupManifest
  try {
    manifest = JSON.parse(text) as BackupManifest
  } catch {
    throw new Error('Could not parse entries.json — the file may be corrupt.')
  }

  if (manifest.version !== 1 || !Array.isArray(manifest.entries)) {
    throw new Error('Unrecognized Dayspring backup format (expected version 1).')
  }

  const dated: ImportedEntry[] = []
  const skipped: ImportParseResult['skipped'] = []

  for (const e of manifest.entries) {
    if (!e.id || !e.created_at) {
      skipped.push({ path: e.id ?? '(unknown)', reason: 'Missing id or created_at' })
      continue
    }
    dated.push({
      created_at: e.created_at,
      body_markdown: e.body_markdown ?? '',
      title: e.title ?? null,
      tags: Array.isArray(e.tags) ? e.tags : [],
      word_count: typeof e.word_count === 'number' ? e.word_count : 0,
      external_id: e.id, // original UUID as dedup key — safe to reimport repeatedly
    })
  }

  dated.sort((a, b) => a.created_at.localeCompare(b.created_at))

  const dates = dated.map((e) => e.created_at)
  const dateRange = dates.length > 0 ? { earliest: dates[0]!, latest: dates[dates.length - 1]! } : null

  return { dated, skipped, dateRange }
}
