import { describe, expect, it } from 'vitest'
import {
  chunkByTokenBudget,
  chunkSentences,
  mergeSpans,
  splitSentences,
  MAX_SENTENCES_PER_REQUEST,
} from './sentences.js'

describe('splitSentences', () => {
  it('returns exact substrings of the body', () => {
    const body = 'Lord, take the fear off me. Then I made coffee. Ada slept.'
    const sentences = splitSentences(body)
    expect(sentences.length).toBeGreaterThanOrEqual(2)
    for (const s of sentences) {
      expect(body.includes(s.text)).toBe(true)
      expect(s.text.length).toBeGreaterThan(0)
      expect(s.text).toBe(s.text.trim())
    }
  })

  it('preserves a prayer sentence verbatim so harvest can slice it back', () => {
    const body = 'Hospital again.\n\nPlease just let her be okay tonight.\n\nI sat in the car.'
    const sentences = splitSentences(body)
    expect(sentences.some((s) => s.text.includes('Please just let her be okay tonight'))).toBe(true)
  })
})

describe('mergeSpans', () => {
  it('joins adjacent same-label sentences using original offsets', () => {
    const source = 'Lord, I am tired. Take the fear off me. Then I made coffee.'
    const sentences = splitSentences(source)
    const labels = sentences.map((s) =>
      /Lord|Take the fear/.test(s.text) ? ('prayer' as const) : ('neither' as const),
    )
    const spans = mergeSpans(sentences, labels, source)
    expect(spans).toHaveLength(1)
    expect(spans[0]!.type).toBe('prayer')
    expect(source.includes(spans[0]!.text)).toBe(true)
    expect(spans[0]!.text).toContain('Lord, I am tired')
    expect(spans[0]!.text).toContain('Take the fear off me')
    expect(spans[0]!.text).not.toContain('coffee')
  })
})

describe('chunkSentences', () => {
  it('chunks past the 255-option / long-entry cap', () => {
    const items = Array.from({ length: 260 }, (_, i) => i)
    const chunks = chunkSentences(items, MAX_SENTENCES_PER_REQUEST)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[0]).toHaveLength(MAX_SENTENCES_PER_REQUEST)
    expect(chunks.flat()).toHaveLength(260)
    expect(chunks.at(-1)).toHaveLength(260 % MAX_SENTENCES_PER_REQUEST)
  })
})

describe('chunkByTokenBudget', () => {
  it('shrinks a pack that would overflow the token budget', () => {
    const items = Array.from({ length: 40 }, (_, i) => i)
    const chunks = chunkByTokenBudget(items, (slice) => slice.length * 1000, {
      maxItems: 80,
      maxTokens: 5000,
    })
    expect(chunks.every((c) => c.length * 1000 <= 5000 || c.length === 1)).toBe(true)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.flat()).toEqual(items)
  })
})
