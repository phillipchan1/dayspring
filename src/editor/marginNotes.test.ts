import { describe, expect, it } from 'vitest'
import { formatSpiritualBlock } from '@/lib/spiritualBlocks'
import { marginNotes } from './marginNotes'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const C = '33333333-3333-3333-3333-333333333333'

describe('marginNotes', () => {
  it('is empty for a page with nothing set apart', () => {
    expect(marginNotes('Just a Tuesday, and nothing to report.')).toEqual([])
  })

  it('carries the writer’s own words, not a summary of them', () => {
    const md = formatSpiritualBlock('prayer', A, 'For Dad, and for Thursday.')
    expect(marginNotes(md)[0]).toMatchObject({
      id: A,
      kind: 'prayer',
      text: 'For Dad, and for Thursday.',
      reference: null,
    })
  })

  it('carries the citation for scripture and for nothing else', () => {
    const scripture = formatSpiritualBlock('scripture', A, 'Be still', 'Psalm 46:10')
    const sense = formatSpiritualBlock('sense', B, 'something is being asked of me')
    const notes = marginNotes(`${scripture}\n${sense}`)
    expect(notes[0]!.reference).toBe('Psalm 46:10')
    expect(notes[1]!.reference).toBeNull()
  })

  // Document order, never grouped by kind. Grouping is a filing decision: it
  // would split a verse, a prayer and a sense from one sitting into three
  // sections of a page written in one go.
  it('reads in document order, not by kind', () => {
    const md = [
      formatSpiritualBlock('sense', A, 'first'),
      formatSpiritualBlock('scripture', B, 'second', 'John 1:1'),
      formatSpiritualBlock('prayer', C, 'third'),
    ].join('\n')
    expect(marginNotes(md).map((n) => n.kind)).toEqual(['sense', 'scripture', 'prayer'])
    expect(marginNotes(md).map((n) => n.text)).toEqual(['first', 'second', 'third'])
  })

  it('reports an offset that points back at the fence', () => {
    const block = formatSpiritualBlock('prayer', A, 'amen')
    const md = `before\n\n${block}\n\nafter`
    const note = marginNotes(md)[0]!
    expect(md.slice(note.from).startsWith('```dayspring-pray')).toBe(true)
  })
})
