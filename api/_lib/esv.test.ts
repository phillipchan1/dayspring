import { describe, expect, it } from 'vitest'
import { chapterCacheKey } from './esv.js'

// The chapter parser itself is esvHtml.ts — see esvHtml.test.ts.

describe('chapterCacheKey', () => {
  it('is distinct from a quote-blob key', () => {
    expect(chapterCacheKey('James', 4)).toBe('james 4#chapter-html')
    expect(chapterCacheKey('  Psalms  ', 119)).toBe('psalms 119#chapter-html')
  })
})
