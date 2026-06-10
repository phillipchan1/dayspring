import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import {
  attachmentBlockNormalizeExtension,
  findAttachmentByKey,
  normalizeAttachmentBlocks,
  planAttachmentMove,
  splitInlineAttachments,
  wrapBlockAttachmentInsert,
  findAttachmentAtPos,
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
  it('pads an image-only line with blank lines', () => {
    const doc = `Before\n${IMG}\nAfter`
    expect(normalizeAttachmentBlocks(doc)).toBe(`Before\n\n${IMG}\n\nAfter`)
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
