import { describe, expect, it } from 'vitest'
import {
  normalizeAttachmentBlocks,
  splitInlineAttachments,
  wrapBlockAttachmentInsert,
  findAttachmentAtPos,
} from './attachmentInsert'

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

describe('findAttachmentAtPos', () => {
  it('returns the ref when pos is inside it', () => {
    const doc = `Hello\n\n${IMG}\n\nworld`
    const from = doc.indexOf('![')
    const found = findAttachmentAtPos(doc, from + 2)
    expect(found?.hash).toBe('a'.repeat(64))
    expect(found?.ext).toBe('jpg')
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
