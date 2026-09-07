import { describe, expect, it } from 'vitest'
import { MAX_PROPOSALS, PROPOSABLE, stripFences, verbatimOnly } from './notice.js'

const TEXT = [
  'Down to the water while it was still dark. Just the sound of it.',
  'For Dad, and for Thursday. That I would stop rehearsing the worst version.',
  'The long way home is not a detour.',
].join('\n')

describe('verbatimOnly', () => {
  it('keeps a quote copied character for character', () => {
    const kept = verbatimOnly([{ quote: 'The long way home is not a detour.', kind: 'learned' }], TEXT)
    expect(kept).toEqual([{ quote: 'The long way home is not a detour.', kind: 'learned' }])
  })

  /*
   * The failure this whole surface exists to avoid. Structured output guarantees
   * shape, never truthfulness — a beautifully-formed quote nobody wrote is still
   * the app putting words on someone's page.
   */
  it('drops a quote the writer did not write', () => {
    expect(verbatimOnly([{ quote: 'God is faithful in every season.', kind: 'sense' }], TEXT)).toEqual([])
  })

  // Close enough is how words the writer never wrote end up on their page.
  it('drops a quote that was tidied on the way back', () => {
    expect(verbatimOnly([{ quote: "That I'd stop rehearsing the worst version.", kind: 'prayer' }], TEXT)).toEqual([])
    expect(verbatimOnly([{ quote: 'the long way home is not a detour.', kind: 'learned' }], TEXT)).toEqual([])
    expect(verbatimOnly([{ quote: ' The long way home is not a detour. ', kind: 'learned' }], TEXT)).toEqual([])
  })

  it('drops a kind outside the closed set', () => {
    const q = 'The long way home is not a detour.'
    expect(verbatimOnly([{ quote: q, kind: 'breakthrough' }], TEXT)).toEqual([])
  })

  /*
   * Absence is declared only. Inferring that God felt absent to someone is a
   * verdict on their interior life, and no amount of pencil makes a machine the
   * right author of that sentence. Scripture is out too — save-time capture
   * already resolves real ESV text and a second guesser would only disagree.
   */
  it('never proposes absence, and never proposes scripture', () => {
    const q = 'Down to the water while it was still dark.'
    expect(verbatimOnly([{ quote: q, kind: 'absence' }], TEXT)).toEqual([])
    expect(verbatimOnly([{ quote: q, kind: 'scripture' }], TEXT)).toEqual([])
    expect(PROPOSABLE).not.toContain('absence')
    expect(PROPOSABLE).not.toContain('scripture')
  })

  /*
   * Gift was RETIRED from the vocabulary (markKinds.ts) — a writer read the
   * label and did not know what it meant. Proposing it would let a kept pencil
   * note write a row that `look for` never offers as a filter, so the marking
   * would exist and be unfindable.
   */
  it('never proposes a retired kind', () => {
    const q = 'That I would stop rehearsing the worst version.'
    expect(verbatimOnly([{ quote: q, kind: 'gift' }], TEXT)).toEqual([])
    expect(PROPOSABLE).not.toContain('gift')
  })

  it('drops a fragment too short to be a line', () => {
    expect(verbatimOnly([{ quote: 'the water', kind: 'story' }], TEXT)).toEqual([])
  })

  // Three pencil notes all saying "prayer" reads as the machine having one idea,
  // not as it having noticed three things.
  it('keeps at most one of each kind', () => {
    const kept = verbatimOnly(
      [
        { quote: 'The long way home is not a detour.', kind: 'learned' },
        { quote: 'Down to the water while it was still dark.', kind: 'learned' },
      ],
      TEXT,
    )
    expect(kept).toHaveLength(1)
  })

  it('never returns more than the cap', () => {
    const many = [
      { quote: 'Down to the water while it was still dark.', kind: 'story' },
      { quote: 'For Dad, and for Thursday.', kind: 'prayer' },
      { quote: 'The long way home is not a detour.', kind: 'learned' },
      { quote: 'That I would stop rehearsing the worst version.', kind: 'desire' },
    ]
    expect(many.length).toBeGreaterThan(MAX_PROPOSALS)
    expect(verbatimOnly(many, TEXT).length).toBe(MAX_PROPOSALS)
  })
})

describe('stripFences', () => {
  const ID = '11111111-1111-1111-1111-111111111111'

  // It must not be able to propose something already marked, and it must never
  // see the fence syntax it could otherwise imitate inside a quote.
  it('removes a marking whole, leaving the prose either side', () => {
    const md = `before\n\`\`\`dayspring-pray ${ID}\nfor Dad\n\`\`\`\nafter`
    const out = stripFences(md)
    expect(out).toContain('before')
    expect(out).toContain('after')
    expect(out).not.toContain('for Dad')
    expect(out).not.toContain('dayspring-pray')
  })

  it('removes every marking on a page, not just the first', () => {
    const md = [
      `\`\`\`dayspring-gift ${ID}`,
      'a gift',
      '```',
      'prose between',
      `\`\`\`dayspring-sense ${ID}`,
      'a sense',
      '```',
    ].join('\n')
    const out = stripFences(md)
    expect(out).toContain('prose between')
    expect(out).not.toContain('a gift')
    expect(out).not.toContain('a sense')
  })

  it('leaves an ordinary code block alone', () => {
    const md = 'before\n```js\nconst x = 1\n```\nafter'
    expect(stripFences(md)).toBe(md)
  })
})
