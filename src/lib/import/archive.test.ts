import { describe, it, expect } from 'vitest'
import { baseName, findByName, folderArchive, zipArchive, type ImportArchive } from './archive'
import { parseDayOne } from './dayOne'
import { parseDayspring } from './dayspringImport'
import { parseDiarly } from '../diarlyImport'

/** Build a folder-backed archive from a map of path → text content. */
function folderFrom(files: Record<string, string>): ImportArchive {
  return folderArchive(
    Object.entries(files).map(([path, content]) => ({
      path,
      file: new File([content], baseName(path)),
    })),
  )
}

/** Build a zip-backed archive from a map of path → text content. */
async function zipFrom(files: Record<string, string>): Promise<ImportArchive> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) zip.file(path, content)
  return zipArchive(await zip.generateAsync({ type: 'arraybuffer' }))
}

describe('archive helpers', () => {
  it('baseName returns the final path segment', () => {
    expect(baseName('a/b/c.json')).toBe('c.json')
    expect(baseName('Journal.json')).toBe('Journal.json')
    expect(baseName('a/b/')).toBe('b')
  })

  it('findByName matches basename case-insensitively, ignoring folder prefix', () => {
    const arc = folderFrom({ 'MyExport/Entries.JSON': '{}', 'MyExport/photos/x.jpg': 'x' })
    expect(findByName(arc, 'entries.json')?.path).toBe('MyExport/Entries.JSON')
    expect(findByName(arc, 'missing.json')).toBeUndefined()
  })
})

const DAY_ONE_JSON = JSON.stringify({
  metadata: { version: '1.0' },
  entries: [
    { uuid: 'AAAA1111BBBB2222CCCC3333DDDD4444', creationDate: '2024-03-02T08:00:00Z', text: 'Hello #joy', tags: ['Gratitude'] },
    { uuid: 'EEEE5555FFFF6666AAAA7777BBBB8888', creationDate: '2024-01-15T20:30:00Z', text: 'Earlier entry' },
  ],
})

describe('parseDayOne from a folder (Day One folder-view export)', () => {
  it('imports every entry from a dropped folder', async () => {
    const arc = folderFrom({
      'Journal Export/Journal.json': DAY_ONE_JSON,
      'Journal Export/photos/ABC.jpeg': 'fake-bytes',
    })
    const result = await parseDayOne(arc)
    expect(result.dated).toHaveLength(2)
    // Sorted oldest → newest.
    expect(result.dated[0]!.created_at).toBe('2024-01-15T20:30:00.000Z')
    expect(result.dated[1]!.body_markdown).toBe('Hello #joy')
    expect(result.dated[1]!.external_id).toBe('AAAA1111BBBB2222CCCC3333DDDD4444')
    expect(result.skipped).toHaveLength(0)
  })

  it('produces identical entries whether the source is a zip or a folder', async () => {
    const files = { 'Journal.json': DAY_ONE_JSON }
    const fromFolder = await parseDayOne(folderFrom(files))
    const fromZip = await parseDayOne(await zipFrom(files))
    expect(fromZip.dated).toEqual(fromFolder.dated)
  })

  it('skips media-folder JSON sidecars', async () => {
    const arc = folderFrom({
      'Export/Journal.json': DAY_ONE_JSON,
      'Export/photos/metadata.json': '{"not":"a journal"}',
    })
    const result = await parseDayOne(arc)
    expect(result.dated).toHaveLength(2)
    expect(result.skipped).toHaveLength(0)
  })
})

describe('parseDiarly from a folder', () => {
  it('reads dated Markdown out of a dropped folder', async () => {
    const arc = folderFrom({
      'Export/Personal/2024/03-02.md': '# A good day\n\nWrote some words.',
      'Export/Personal/notes.md': 'undated note',
    })
    const result = await parseDiarly(arc)
    expect(result.dated).toHaveLength(1)
    expect(result.dated[0]!.created_at).toBe('2024-03-02T12:00:00.000Z')
    expect(result.dated[0]!.external_id).toBe('Personal/2024/03-02')
    expect(result.undated).toHaveLength(1)
  })
})

describe('parseDayspring from a folder', () => {
  it('restores from an unzipped backup folder', async () => {
    const arc = folderFrom({
      'dayspring-backup/entries.json': JSON.stringify({
        version: 1,
        exported_at: '2024-06-01T00:00:00Z',
        entry_count: 1,
        entries: [
          { id: 'uuid-1', created_at: '2024-05-01T10:00:00Z', body_markdown: 'restored', title: null, mood: null, tags: [], word_count: 1, source: 'native', external_id: null },
        ],
      }),
    })
    const result = await parseDayspring(arc)
    expect(result.dated).toHaveLength(1)
    expect(result.dated[0]!.external_id).toBe('uuid-1')
  })

  it('throws a clear error when entries.json is absent', async () => {
    await expect(parseDayspring(folderFrom({ 'x/readme.txt': 'hi' }))).rejects.toThrow(/entries\.json/)
  })
})
