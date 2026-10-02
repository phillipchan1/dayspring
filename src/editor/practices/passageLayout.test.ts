import { describe, expect, it } from 'vitest'
import { flatText, layoutPassage } from './passageLayout'
import type { Verse } from './passage'

const PSALM: Verse[] = [
  {
    n: 1,
    text: 'O LORD, how many are my foes! Many are rising against me;',
    parts: [
      { text: 'O LORD, how many are my foes!', at: 'stanza', indent: 1, head: { kind: 'title', text: 'A Psalm of David.' } },
      { text: 'Many are rising against me;', at: 'line', indent: 2 },
    ],
  },
  {
    n: 2,
    text: 'many are saying of my soul, “There is no salvation for him in God.” Selah',
    parts: [
      { text: 'many are saying of my soul,', at: 'line', indent: 1 },
      { text: '“There is no salvation for him in God.” Selah', at: 'line', indent: 2, selah: true },
    ],
  },
  {
    n: 3,
    text: 'But you, O LORD, are a shield about me,',
    parts: [{ text: 'But you, O LORD, are a shield about me,', at: 'stanza', indent: 1 }],
  },
]

describe('layoutPassage', () => {
  it('sets poetry one line to a row, with a gap between stanzas', () => {
    const rows = layoutPassage(PSALM)
    expect(rows.map((r) => [r.kind, r.indent, r.gap])).toEqual([
      ['poetry', 1, false],
      ['poetry', 2, false],
      ['poetry', 1, false],
      ['poetry', 2, false],
      ['poetry', 1, true],
    ])
    expect(rows[0]!.head).toEqual({ kind: 'title', text: 'A Psalm of David.' })
    expect(rows[3]!.frags[0]!.selah).toBe(true)
  })

  it('draws a verse number only where the verse begins', () => {
    const rows = layoutPassage(PSALM)
    expect(rows.map((r) => r.frags.map((f) => (f.lead ? f.n : '·')).join())).toEqual(['1', '·', '2', '·', '3'])
  })

  it('keeps word and character offsets the verse’s own', () => {
    const second = layoutPassage(PSALM)[3]!.frags[0]!
    expect(second.word).toBe(6)
    expect(second.char).toBe('many are saying of my soul,'.length + 1)
    expect(flatText(PSALM[1]!).slice(second.char)).toBe(second.text)
  })

  it('flows prose verses into one paragraph, and breaks where a paragraph begins', () => {
    const rows = layoutPassage([
      { n: 4, text: 'Hear the word.', parts: [{ text: 'Hear the word.', at: 'para' }] },
      {
        n: 5,
        text: 'Thus says the LORD: “What wrong',
        parts: [
          { text: 'Thus says the LORD:', at: 'flow' },
          { text: '“What wrong', at: 'stanza', indent: 1 },
        ],
      },
      { n: 6, text: 'Then more.', parts: [{ text: 'Then more.', at: 'para', resume: true }] },
      { n: 7, text: 'A new one.', parts: [{ text: 'A new one.', at: 'para' }] },
    ])
    expect(rows.map((r) => [r.kind, r.frags.map((f) => f.n).join(), r.gap, r.flush])).toEqual([
      ['prose', '4,5', false, true],
      ['poetry', '5', true, false],
      ['prose', '6', true, true],
      ['prose', '7', false, false],
    ])
  })

  it('reads a verse with no shape as one plain paragraph, as before', () => {
    const rows = layoutPassage([
      { n: 1, text: 'I am the true vine,  and my Father is the farmer.' },
      { n: 2, text: 'Every branch in me.' },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'prose', flush: true, gap: false })
    expect(rows[0]!.frags[0]!.text).toBe('I am the true vine, and my Father is the farmer.')
  })

  it('never opens a passage with a gap, even mid-psalm', () => {
    expect(layoutPassage(PSALM.slice(2))[0]!.gap).toBe(false)
  })
})

describe('writePassage', () => {
  it('writes a poem into the fence one line to a line, prose run together', async () => {
    const { writePassage } = await import('./passage')
    const fence = writePassage({ book: 'Psalms', chapter: 3, from: 1, to: 3 }, PSALM, 'id')
    expect(fence).toContain(
      'O LORD, how many are my foes!\nMany are rising against me;\nmany are saying of my soul,\n“There is no salvation for him in God.” Selah\nBut you, O LORD',
    )
  })
})
