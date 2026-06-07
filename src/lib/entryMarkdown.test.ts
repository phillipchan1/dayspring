import { describe, expect, it } from 'vitest'
import { deriveTitle, deriveEntryPreview } from './entryLabels'
import {
  firstContentLineNumber,
  firstLineIsTitle,
  isExplicitHeading,
  isNonTitleLine,
  markdownForDisplay,
} from './entryMarkdown'

describe('isExplicitHeading', () => {
  it('matches ATX headings only', () => {
    expect(isExplicitHeading('# Title')).toBe(true)
    expect(isExplicitHeading('### Deep')).toBe(true)
    expect(isExplicitHeading('#nospace')).toBe(false)
    expect(isExplicitHeading('plain')).toBe(false)
  })
})

describe('firstLineIsTitle / isNonTitleLine', () => {
  it('treats plain prose as a title', () => {
    expect(firstLineIsTitle('My morning')).toBe(true)
  })
  it('does not treat structure or headings as an auto-title', () => {
    for (const line of ['- item', '1. step', '> quote', '[] todo', '- [x] done', '# Heading']) {
      expect(firstLineIsTitle(line)).toBe(false)
    }
  })
  it('flags structural lines as non-title', () => {
    expect(isNonTitleLine('- item')).toBe(true)
    expect(isNonTitleLine('plain')).toBe(false)
  })
})

describe('markdownForDisplay', () => {
  it('promotes a plain first line to an H1 title', () => {
    expect(markdownForDisplay('My day\n\nBody text')).toBe('# My day\n\nBody text')
  })

  it('leaves an explicit heading alone', () => {
    expect(markdownForDisplay('# Already\n\nBody')).toBe('# Already\n\nBody')
  })

  it('does not promote a list / quote / task as a title', () => {
    expect(markdownForDisplay('- item\nmore')).toBe('- item\nmore')
    expect(markdownForDisplay('> quote')).toBe('> quote')
  })

  it('normalizes task lines for rendering', () => {
    expect(markdownForDisplay('# T\n\n[] todo')).toBe('# T\n\n- [ ] todo')
  })

  it('returns empty/whitespace docs unchanged', () => {
    expect(markdownForDisplay('')).toBe('')
    expect(markdownForDisplay('\n\n')).toBe('\n\n')
  })

  it('does not promote the title when asTitle is false', () => {
    expect(markdownForDisplay('My day\n\nBody', { asTitle: false })).toBe('My day\n\nBody')
    // tasks still normalize regardless of the title setting
    expect(markdownForDisplay('[] todo', { asTitle: false })).toBe('- [ ] todo')
  })

  it('promotes the first line exactly once (no duplicate title)', () => {
    const out = markdownForDisplay('Morning thoughts\nToday I woke up')
    expect(out).toBe('# Morning thoughts\nToday I woke up')
    expect(out.match(/Morning thoughts/g)).toHaveLength(1)
  })
})

describe('firstContentLineNumber', () => {
  it('skips leading blank lines (1-based)', () => {
    expect(firstContentLineNumber('\n\nhi')).toBe(3)
    expect(firstContentLineNumber('   \n')).toBeNull()
  })
})

describe('deriveTitle', () => {
  it('strips markdown syntax from the first line', () => {
    expect(deriveTitle('# **Bold** title\nbody')).toBe('Bold title')
    expect(deriveTitle('- a list item')).toBe('a list item')
    expect(deriveTitle('> a quote')).toBe('a quote')
  })
  it('returns empty for blank docs', () => {
    expect(deriveTitle('')).toBe('')
    expect(deriveTitle(null)).toBe('')
  })
  it('never leaks practice tokens; uses the practice name until something is written', () => {
    const untouched =
      '<!-- practice:name:Wesley’s Questions -->\n<!-- practice:section:Honesty -->\n'
    expect(deriveTitle(untouched)).toBe('Wesley’s Questions')
  })
  it('prefers the first written line of a practice entry over its name', () => {
    const written =
      '<!-- practice:name:The Daily Examen -->\n<!-- practice:section:Gratitude -->\ngrateful for the rain'
    expect(deriveTitle(written)).toBe('grateful for the rain')
  })
  it('never leaks a scripture fence token; uses the writing instead', () => {
    const body =
      'I am\n```dayspring-scripture 53430d30-3e0c-4d5a-9b1a-000000000000\nBe still, and know that I am God.\nPsalm 46:10 · ESV\n```'
    expect(deriveTitle(body)).toBe('I am')
  })
  it('skips a leading photo attachment ref', () => {
    const body = `![a sunrise](attachment:${'a'.repeat(64)}.jpg)\nmorning light`
    expect(deriveTitle(body)).toBe('morning light')
  })
})

describe('deriveEntryPreview', () => {
  it('never dumps the dayspring scripture token; shows the writing', () => {
    const body =
      'a few words here\n```dayspring-scripture 53430d30-3e0c-4d5a-9b1a-000000000000\nBe still, and know that I am God.\nPsalm 46:10 · ESV\n```\nresting in that'
    const preview = deriveEntryPreview(body)
    expect(preview).toBe('a few words here')
    expect(preview).not.toContain('dayspring-scripture')
  })
  it('returns null when the entry is only snippets', () => {
    const body =
      '<!-- practice:name:Lectio Divina -->\n<!-- practice:section:Lectio -->\n'
    expect(deriveEntryPreview(body)).toBeNull()
  })
})
