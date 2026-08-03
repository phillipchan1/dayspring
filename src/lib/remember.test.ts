import { describe, expect, it } from 'vitest'
import { collectPassages, extractEmphasis, extractQuotes, passagesForEntry } from './remember'

const entry = (body: string, id = 'e1', created_at = '2024-03-14T10:00:00Z') => ({
  id,
  created_at,
  body_markdown: body,
})

describe('extractEmphasis', () => {
  it('reads bold and italic', () => {
    expect(extractEmphasis('I think **I have been measuring the wrong thing** tonight.')).toEqual([
      'I have been measuring the wrong thing',
    ])
    expect(extractEmphasis('He kept _nothing back that I needed_ from me.')).toEqual([
      'nothing back that I needed',
    ])
  })

  it('yields one span for bold, not one per delimiter', () => {
    expect(extractEmphasis('**a whole bolded sentence here**')).toHaveLength(1)
  })

  it('keeps document order when bold and italic are mixed', () => {
    expect(extractEmphasis('*first one here* then **second one here**')).toEqual([
      'first one here',
      'second one here',
    ])
  })

  it('does not treat list markers as emphasis', () => {
    expect(extractEmphasis('* buy milk\n* call mum\n* write it down')).toEqual([])
  })

  it('does not read emphasis out of headings', () => {
    expect(extractEmphasis('## **Morning prayer time**\nplain body text here')).toEqual([])
  })

  it('ignores emphasis inside inline code', () => {
    expect(extractEmphasis('the value is `**not** emphasis here` in code')).toEqual([])
  })

  it('ignores snake_case identifiers', () => {
    expect(extractEmphasis('called entry_id_field and owner_id_field today')).toEqual([])
  })

  it('skips spans inside spiritual fences', () => {
    const md = [
      'plain line above the block',
      '```dayspring-pray 11111111-2222-3333-4444-555555555555',
      'that I would **stop treating the waiting** as punishment',
      '```',
      'and **something after the block entirely** here',
    ].join('\n')
    expect(extractEmphasis(md)).toEqual(['something after the block entirely'])
  })
})

describe('extractQuotes', () => {
  it('joins a contiguous run into one passage', () => {
    const md = '> He kept nothing back that I needed.\n> He kept back what I wanted.'
    expect(extractQuotes(md)).toEqual([
      'He kept nothing back that I needed. He kept back what I wanted.',
    ])
  })

  it('splits runs separated by a blank quote line or plain text', () => {
    const md = '> first thought written down\n\n> second thought written down'
    expect(extractQuotes(md)).toHaveLength(2)
  })

  it('ignores quote markers inside spiritual fences', () => {
    const md = [
      '```dayspring-sense 11111111-2222-3333-4444-555555555555',
      '> a quoted line inside the block',
      '```',
    ].join('\n')
    expect(extractQuotes(md)).toEqual([])
  })
})

describe('passagesForEntry', () => {
  it('drops spans shorter than the word floor', () => {
    expect(passagesForEntry(entry('a **name** and *two words* only'))).toEqual([])
  })

  it('dedupes an emphasised line inside a quote to a single quote passage', () => {
    const md = '> **He kept nothing back that I actually needed** from me'
    const out = passagesForEntry(entry(md))
    expect(out).toHaveLength(1)
    expect(out[0]!.source).toBe('quote')
  })

  it('carries the entry id and date onto every passage', () => {
    const out = passagesForEntry(entry('**I have been measuring the wrong thing** again'))
    expect(out[0]).toMatchObject({ entryId: 'e1', date: '2024-03-14T10:00:00Z', source: 'emphasis' })
  })

  it('keeps the text verbatim apart from whitespace collapsing', () => {
    const out = passagesForEntry(entry('**I  do not\nthink He is late here**'))
    expect(out[0]!.text).toBe('I do not think He is late here')
  })

  it('returns nothing for an empty or null body', () => {
    expect(passagesForEntry(entry(''))).toEqual([])
    expect(passagesForEntry({ id: 'e1', created_at: '2024-01-01T00:00:00Z', body_markdown: null as never })).toEqual([])
  })
})

describe('emphasis completeness filter', () => {
  it('drops clipped phrases that end mid-thought', () => {
    // The real archive is full of these: "do what they do", "will not let them go".
    expect(passagesForEntry(entry('he told me to **do what they do** and left'))).toEqual([])
  })

  it('keeps a short span that ends as a sentence', () => {
    const out = passagesForEntry(entry('and then **I feel super unqualified.** honestly'))
    expect(out.map((p) => p.text)).toEqual(['I feel super unqualified.'])
  })

  it('keeps a long span even without terminal punctuation', () => {
    const md = '**i love the feeling of looking at how much I can deadlift compared to others**'
    expect(passagesForEntry(entry(md))).toHaveLength(1)
  })

  it('does not apply the completeness rule to blockquotes', () => {
    expect(passagesForEntry(entry('> shepherd the flock of God that is among you'))).toHaveLength(1)
  })
})

describe('collectPassages', () => {
  const declared = { entry_id: 'e2', created_at: '2019-11-12T09:00:00Z', text: 'For Dad. Again. The same words.', source: null }
  const harvested = { entry_id: 'e4', created_at: '2020-05-05T09:00:00Z', text: 'God it is frustrating and hard.', source: 'scanned' }
  const mark = { entry_id: 'e3', quote: 'I have been measuring the wrong thing', noticed_at: '2026-01-09T09:00:00Z' }

  it('merges marks, derived passages, and declared prayers, newest first', () => {
    const out = collectPassages([entry('> a line I set apart on purpose here')], [mark], [declared])
    expect(out.map((p) => p.source)).toEqual(['mark', 'quote', 'pray'])
  })

  it('never includes altar-harvested rows', () => {
    expect(collectPassages([], [], [harvested])).toEqual([])
  })

  it('includes writer-declared prayers', () => {
    expect(collectPassages([], [], [declared]).map((p) => p.source)).toEqual(['pray'])
  })

  it('collapses a bolded sentence that has also been marked into one mark', () => {
    const out = collectPassages([entry('**I have been measuring the wrong thing** tonight')], [mark])
    expect(out).toHaveLength(1)
    expect(out[0]!.source).toBe('mark')
    expect(out[0]!.date).toBe('2026-01-09T09:00:00Z')
  })

  it('dates a mark to when it was noticed, not to the entry', () => {
    const out = collectPassages([entry('plain body', 'e3', '2019-01-01T00:00:00Z')], [mark])
    expect(out[0]!.date).toBe('2026-01-09T09:00:00Z')
  })

  it('applies the word floor to declared prayers', () => {
    expect(collectPassages([], [], [{ ...declared, text: 'For Dad' }])).toEqual([])
  })

  it('handles an empty corpus', () => {
    expect(collectPassages([])).toEqual([])
  })
})
