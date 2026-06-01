// The catalogue of journals Dayspring can import from. Each source carries its
// own export instructions and (when available) a browser-side parser. The
// Settings → Import UI is driven entirely by this list, so adding a competitor
// is a matter of appending one entry.

import type { EntrySource } from '../types'
import type { ImportParseResult } from './types'
import { parseDiarlyZip } from '../diarlyImport'
import { parseDayOneZip } from './dayOne'

export interface ImportSourceDef {
  /** Maps to `entries.source`; also the dedup namespace. */
  id: EntrySource | 'journey' | 'obsidian' | 'apple'
  name: string
  /** One-line positioning, shown on the card. */
  tagline: string
  /** A monogram rendered in the card's badge. */
  monogram: string
  /** Accent the badge uses (a CSS color or var). */
  tint: string
  status: 'available' | 'coming-soon'
  /** `<input accept>` value for the file picker. */
  accept?: string
  /** Short label for the expected file, e.g. "Markdown .zip". */
  fileLabel?: string
  /** Step-by-step export instructions, shown above the drop zone. */
  instructions?: string[]
  /** What gets imported vs. left behind — sets honest expectations. */
  note?: string
  /** Browser-side parser. Present iff status === 'available'. */
  parse?: (data: ArrayBuffer) => Promise<ImportParseResult>
}

/** Adapt the original Diarly parser (its own result shape) to ImportParseResult. */
async function parseDiarly(data: ArrayBuffer): Promise<ImportParseResult> {
  const r = await parseDiarlyZip(data)
  return {
    dated: r.dated,
    skipped: r.undated.map((u) => ({ path: u.path, reason: 'No date in the file path' })),
    dateRange: r.dateRange,
  }
}

export const IMPORT_SOURCES: ImportSourceDef[] = [
  {
    id: 'diarly',
    name: 'Diarly',
    tagline: 'Markdown export (.zip)',
    monogram: 'Di',
    tint: 'var(--accent)',
    status: 'available',
    accept: '.zip,application/zip',
    fileLabel: 'Diarly Markdown export (.zip)',
    instructions: [
      'Open Diarly on your Mac and choose Diarly → Preferences → Sync & Backup.',
      'Click “Export” and pick Markdown as the format.',
      'Choose “All journals” (or a single journal) and save the .zip file.',
      'Drop that .zip below — entries are read in your browser and added to your journal.',
    ],
    note: 'Dates come from each file’s folder. Photos and other attachments aren’t imported.',
    parse: parseDiarly,
  },
  {
    id: 'day_one',
    name: 'Day One',
    tagline: 'JSON export (.zip)',
    monogram: 'D1',
    tint: '#4c8dff',
    status: 'available',
    accept: '.zip,application/zip',
    fileLabel: 'Day One JSON export (.zip)',
    instructions: [
      'Open Day One and choose File → Export → Day One (or All Entries).',
      'Pick JSON as the export format (not PDF or plain text).',
      'Save the resulting .zip — it contains a JSON file per journal.',
      'Drop that .zip below. Every journal in the export is brought in at once.',
    ],
    note: 'Full timestamps, tags, and starred entries carry over. Photos, audio, and PDFs aren’t imported.',
    parse: parseDayOneZip,
  },
  {
    id: 'journey',
    name: 'Journey',
    tagline: 'Coming soon',
    monogram: 'Jo',
    tint: '#22b07d',
    status: 'coming-soon',
    instructions: [
      'In Journey, open Settings → Export and choose the JSON/ZIP export.',
      'Hang on to that file — Dayspring will read it directly once support ships.',
    ],
    note: 'Want this sooner? Let us know which export format you have.',
  },
  {
    id: 'apple',
    name: 'Apple Journal',
    tagline: 'Coming soon',
    monogram: '',
    tint: '#ff5b6e',
    status: 'coming-soon',
    instructions: [
      'On iOS, open Journal → Settings and use “Export Journal”.',
      'Apple’s archive format is on our roadmap — keep your export handy.',
    ],
  },
  {
    id: 'obsidian',
    name: 'Obsidian & Markdown',
    tagline: 'Coming soon',
    monogram: 'md',
    tint: '#a472ff',
    status: 'coming-soon',
    instructions: [
      'Zip a folder of dated Markdown notes (one daily note per day).',
      'Generic Markdown import with date-from-filename is on the way.',
    ],
    note: 'Already using Diarly-style YYYY/MM-DD.md files? The Diarly importer may work today.',
  },
]

export function findImportSource(id: string): ImportSourceDef | undefined {
  return IMPORT_SOURCES.find((s) => s.id === id)
}
