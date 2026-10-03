import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import {
  attachmentBlockNormalizeExtension,
  findAttachmentByKey,
  normalizeAttachmentBlocks,
  planAttachmentMove,
  splitInlineAttachments,
  wrapBlockAttachmentInsert,
  findAttachmentAtPos,
  insertBlockPendingAttachmentsAt,
  withPhotoPlacement,
} from './attachmentInsert'
import { formatAttachmentMarkdown } from '@/lib/attachments'

const IMG =
  '![sunset](attachment:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg)'

describe('wrapBlockAttachmentInsert', () => {
  it('wraps with blank lines when inserting mid-paragraph', () => {
    const before = 'Hello world'
    const after = ' more text'
    expect(wrapBlockAttachmentInsert(11, 21, before, after, IMG)).toBe(`\n\n${IMG}\n\n`)
  })

  it('does not double newlines when already separated', () => {
    const before = 'Hello\n\n'
    const after = '\n\nworld'
    expect(wrapBlockAttachmentInsert(7, 14, before, after, IMG)).toBe(IMG)
  })

  it('adds a trailing newline at end of document', () => {
    expect(wrapBlockAttachmentInsert(0, 0, '', '', IMG)).toBe(`${IMG}\n`)
  })
})

describe('splitInlineAttachments', () => {
  it('splits an inline image onto its own line', () => {
    const doc = `Some text ${IMG} after`
    expect(splitInlineAttachments(doc)).toBe(
      `Some text\n\n${IMG}\n\nafter`,
    )
  })

  it('leaves an image-only line unchanged', () => {
    const doc = `Before\n\n${IMG}\n\nAfter`
    expect(splitInlineAttachments(doc)).toBeNull()
  })
})

describe('normalizeAttachmentBlocks', () => {
  const IMG2 = `![two](attachment:${'b'.repeat(64)}.jpg)`

  it('pads an image-only line with blank lines', () => {
    const doc = `Before\n${IMG}\nAfter`
    expect(normalizeAttachmentBlocks(doc)).toBe(`Before\n\n${IMG}\n\nAfter`)
  })

  it('leaves photo lines that touch alone: that is a set', () => {
    expect(normalizeAttachmentBlocks(`Before\n\n${IMG}\n${IMG2}\n\nAfter`)).toBeNull()
  })

  it('pads a set away from the writing on either side without splitting it', () => {
    const doc = `Before\n${IMG}\n${IMG2}\nAfter`
    expect(normalizeAttachmentBlocks(doc)).toBe(`Before\n\n${IMG}\n${IMG2}\n\nAfter`)
  })

  it('keeps every set whole when a photo is inserted elsewhere in the entry', () => {
    // The normaliser runs over the whole entry on any photo insert. An app that
    // padded touching lines here would split a set it never touched.
    const IMG3 = `![three](attachment:${'c'.repeat(64)}.jpg)`
    const start = `${IMG}\n${IMG2}\n\nwords`
    const state = EditorState.create({ doc: start, extensions: [attachmentBlockNormalizeExtension()] })
    const next = state.update({ changes: { from: start.length, insert: `\n${IMG3}` } }).state
    expect(next.doc.toString()).toBe(`${IMG}\n${IMG2}\n\nwords\n\n${IMG3}`)
  })

  it('leaves a caret elsewhere in the entry where it was', () => {
    // The normaliser used to replace the whole document, which mapped every
    // position onto its edge and threw the caret to the start of the entry.
    const start = 'Hello world\n\nlater text'
    const state = EditorState.create({
      doc: start,
      selection: { anchor: 5 },
      extensions: [attachmentBlockNormalizeExtension()],
    })
    const next = state.update({ changes: { from: start.length, insert: IMG } }).state
    expect(next.doc.toString()).toBe(`Hello world\n\nlater text\n\n${IMG}`)
    expect(next.selection.main.head).toBe(5)
  })
})

describe('withPhotoPlacement', () => {
  const IMG2 = `![two](attachment:${'b'.repeat(64)}.jpg)`
  const target = (doc: string, ref: string) => findAttachmentAtPos(doc, doc.indexOf(ref))!

  it('says which place a photo holds in its set', () => {
    const doc = `${IMG}\n${IMG2}`
    expect(withPhotoPlacement(doc, target(doc, IMG2)).set).toEqual({ index: 1, count: 2 })
  })

  it('marks a photo that only blank lines keep from the photos above', () => {
    const doc = `${IMG}\n\n${IMG2}`
    const placed = withPhotoPlacement(doc, target(doc, IMG2))
    expect(placed.set).toBeUndefined()
    expect(placed.joinsAbove).toBe(true)
    expect(withPhotoPlacement(doc, target(doc, IMG)).joinsAbove).toBe(false)
  })
})

describe('image size hint', () => {
  const HASH = 'a'.repeat(64)
  const KEY = `${HASH}.jpg`

  it('omits the param for the default medium size', () => {
    expect(formatAttachmentMarkdown(HASH, 'jpg', 'sunset', 'm')).toBe(IMG)
  })

  it('round-trips small and full through format + parse', () => {
    for (const size of ['s', 'f'] as const) {
      const md = formatAttachmentMarkdown(HASH, 'jpg', 'sunset', size)
      expect(md).toContain(`?size=${size})`)
      expect(findAttachmentByKey(md, KEY)?.size).toBe(size)
    }
  })

  it('defaults to medium when no param is present', () => {
    expect(findAttachmentByKey(IMG, KEY)?.size).toBe('m')
  })

  it('preserves the size when a sized photo is moved', () => {
    const sized = formatAttachmentMarkdown(HASH, 'jpg', 'sunset', 'f')
    const doc = `${sized}\n\nfirst\n\nsecond`
    const changes = planAttachmentMove(doc, KEY, doc.indexOf('second'))
    const out = EditorState.create({
      doc,
      extensions: [attachmentBlockNormalizeExtension()],
    })
      .update({ changes: changes! })
      .newDoc.toString()
    expect(out).toBe(`first\n\n${sized}\n\nsecond`)
    expect(out).toContain('?size=f)')
  })
})

describe('findAttachmentAtPos', () => {
  it('returns the ref when pos is inside it', () => {
    const doc = `Hello\n\n${IMG}\n\nworld`
    const from = doc.indexOf('![')
    const found = findAttachmentAtPos(doc, from + 2)
    expect(found?.hash).toBe('a'.repeat(64))
    expect(found?.ext).toBe('jpg')
  })
})

describe('planAttachmentMove', () => {
  const KEY = `${'a'.repeat(64)}.jpg`

  // Apply the planned changes through the same normalize filter the editor uses,
  // so the test reflects the real on-screen result.
  function applyMove(doc: string, toPos: number): string | null {
    const changes = planAttachmentMove(doc, KEY, toPos)
    if (!changes) return null
    const state = EditorState.create({
      doc,
      extensions: [attachmentBlockNormalizeExtension()],
    })
    return state.update({ changes }).newDoc.toString()
  }

  it('moves a photo from the top to between two later paragraphs', () => {
    const doc = `${IMG}\n\nfirst\n\nsecond`
    const toPos = doc.indexOf('second') // drop right before "second"
    expect(applyMove(doc, toPos)).toBe(`first\n\n${IMG}\n\nsecond`)
  })

  it('moves a photo from the bottom up to the start', () => {
    const doc = `first\n\nsecond\n\n${IMG}`
    expect(applyMove(doc, 0)).toBe(`${IMG}\n\nfirst\n\nsecond`)
  })

  it('is a no-op when dropped inside its own range', () => {
    const doc = `before\n\n${IMG}\n\nafter`
    const inside = doc.indexOf('![') + 4
    expect(planAttachmentMove(doc, KEY, inside)).toBeNull()
  })

  it('returns null when the key is absent', () => {
    expect(planAttachmentMove('just text', KEY, 0)).toBeNull()
  })

  it('does nothing when a photo is dropped back onto its own set', () => {
    const IMG2 = `![two](attachment:${'b'.repeat(64)}.jpg)`
    const doc = `first\n\n${IMG2}\n${IMG}\n\nsecond`
    // The set block resolves to one of its edges, whichever photo was dropped on.
    expect(planAttachmentMove(doc, KEY, doc.indexOf(IMG2))).toBeNull()
    expect(planAttachmentMove(doc, KEY, doc.indexOf(IMG) + IMG.length)).toBeNull()
  })

  it('carries a photo out of its set and leaves the rest of the set whole', () => {
    const IMG2 = `![two](attachment:${'b'.repeat(64)}.jpg)`
    const IMG3 = `![three](attachment:${'c'.repeat(64)}.jpg)`
    const doc = `first\n\n${IMG2}\n${IMG}\n${IMG3}\n\nsecond`
    expect(applyMove(doc, doc.length)).toBe(`first\n\n${IMG2}\n${IMG3}\n\nsecond\n\n${IMG}\n`)
  })
})

describe('several photos arriving at once', () => {
  it('lands them on touching lines, as one set', () => {
    const view = { state: EditorState.create({ doc: 'Hello world' }), focus() {} } as unknown as EditorView
    let next = ''
    ;(view as unknown as { dispatch: (tr: { changes: { from: number; to: number; insert: string } }) => void }).dispatch =
      ({ changes }) => {
        next = 'Hello world'.slice(0, changes.from) + changes.insert + 'Hello world'.slice(changes.to)
      }
    insertBlockPendingAttachmentsAt(view, 5, [
      { id: '11111111-2222-3333-4444-555555555555', alt: '' },
      { id: '66666666-7777-8888-9999-000000000000', alt: 'two' },
    ])
    expect(next).toBe(
      'Hello\n\n![](attachment-pending:11111111-2222-3333-4444-555555555555)\n' +
        '![two](attachment-pending:66666666-7777-8888-9999-000000000000)\n\n world',
    )
  })
})

describe('insertBlockAttachmentsAt', () => {
  it('combines multiple images into one wrapped insert string', () => {
    const IMG2 =
      '![two](attachment:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg)'
    const combined = [IMG, IMG2].join('\n\n')
    const insert = wrapBlockAttachmentInsert(5, 11, 'Hello', ' world', combined)
    expect(insert).toBe(`\n\n${combined}\n\n`)
  })
})
