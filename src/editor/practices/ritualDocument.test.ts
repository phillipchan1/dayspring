import { describe, expect, it } from 'vitest'
import {
  composeRitualMarkdown,
  readRitual,
  ritualBlockRange,
  ritualIndexAt,
  ritualEntryShape,
  ritualRemovalRange,
} from './ritualDocument'
import { buildPracticeBlock } from './usePracticeInsertion'
import { PRACTICES } from './practicesData'

const examen = PRACTICES.find((p) => p.name === 'The Daily Examen')!
const LABELS = examen.prompts.map((p) => p.label)

describe('composeRitualMarkdown', () => {
  it('writes exactly what buildPracticeBlock writes when nothing is answered', () => {
    // The two must agree, or a ritual composed here and one begun the old way
    // would be different documents.
    const seeded = buildPracticeBlock(examen, '', 0).text
    expect(composeRitualMarkdown(examen.name, LABELS, ['', '', '', ''])).toBe(seeded)
  })

  it('puts each movement’s writing under its own token', () => {
    const md = composeRitualMarkdown(examen.name, LABELS, ['Bread.', 'Distant.', '', ''])
    expect(md).toContain('<!-- ritual:section:Gratitude -->\nBread.')
    expect(md).toContain('<!-- ritual:section:Awareness -->\nDistant.')
  })

  it('keeps a movement written as several paragraphs whole', () => {
    const md = composeRitualMarkdown(examen.name, LABELS, ['One.\n\nTwo.', '', '', ''])
    expect(md).toContain('<!-- ritual:section:Gratitude -->\nOne.\n\nTwo.\n<!-- ritual:section:Awareness -->')
  })

  it('trims trailing blank lines, which would read as leaving the ritual', () => {
    const md = composeRitualMarkdown(examen.name, LABELS, ['Bread.\n\n\n', '', '', ''])
    expect(md).toContain('<!-- ritual:section:Gratitude -->\nBread.\n<!-- ritual:section:Awareness -->')
  })

  it('never persists a question or a placeholder', () => {
    const md = composeRitualMarkdown(examen.name, LABELS, ['a', 'b', 'c', 'd'])
    for (const p of examen.prompts) {
      expect(md).not.toContain(p.question)
      expect(md).not.toContain(p.placeholder)
    }
  })
})

describe('reading a ritual back', () => {
  const doc = 'Morning.\n\n' + composeRitualMarkdown(examen.name, LABELS, ['Bread.', '', 'Short with her.', ''])

  it('recovers the name, the movements and the words', () => {
    const r = readRitual(doc, 0)!
    expect(r.name).toBe('The Daily Examen')
    expect(r.labels).toEqual(LABELS)
    expect(r.texts).toEqual(['Bread.', '', 'Short with her.', ''])
  })

  it('round-trips: what is read back composes to the same document', () => {
    const r = readRitual(doc, 0)!
    const range = ritualBlockRange(doc, 0)!
    const rebuilt =
      doc.slice(0, range.from) +
      composeRitualMarkdown(r.name, r.labels, r.texts) +
      doc.slice(range.to)
    expect(rebuilt).toBe(doc)
  })

  it('round-trips a multi-paragraph movement', () => {
    const d = composeRitualMarkdown(examen.name, LABELS, ['One.\n\nTwo.', 'b', 'c', 'd'])
    expect(readRitual(d, 0)!.texts[0]).toBe('One.\n\nTwo.')
  })

  it('finds the block by the offset its name token starts at', () => {
    const range = ritualBlockRange(doc, 0)!
    expect(ritualIndexAt(doc, range.from)).toBe(0)
    expect(ritualIndexAt(doc, range.from + 1)).toBe(-1)
  })

  it('separates two rituals in one entry', () => {
    const two =
      composeRitualMarkdown(examen.name, LABELS, ['first', '', '', '']) +
      '\n\n' +
      composeRitualMarkdown(examen.name, LABELS, ['second', '', '', ''])
    expect(readRitual(two, 0)!.texts[0]).toBe('first')
    expect(readRitual(two, 1)!.texts[0]).toBe('second')
  })

  it('returns null for a block that is not there', () => {
    expect(readRitual('just prose', 0)).toBeNull()
    expect(ritualBlockRange(doc, 3)).toBeNull()
  })
})

describe('ritualRemovalRange', () => {
  it('leaves following prose with a single seam, not a hole', () => {
    const block = composeRitualMarkdown(examen.name, LABELS, ['Bread.', '', '', ''])
    const source = `Morning.\n\n${block}\n\nEvening.`
    const range = ritualRemovalRange(source, 0)!
    expect(source.slice(0, range.from) + source.slice(range.to)).toBe('Morning.\n\nEvening.')
  })

  it('clears an entry that was only the ritual', () => {
    const source = composeRitualMarkdown(examen.name, LABELS, ['', '', '', ''])
    const range = ritualRemovalRange(source, 0)!
    expect(source.slice(0, range.from) + source.slice(range.to)).toBe('')
  })

  it('does not eat the ritual next to it', () => {
    const first = composeRitualMarkdown(examen.name, LABELS, ['first', '', '', ''])
    const second = composeRitualMarkdown(examen.name, LABELS, ['second', '', '', ''])
    const source = `${first}\n\n${second}`
    const range = ritualRemovalRange(source, 0)!
    const next = source.slice(0, range.from) + source.slice(range.to)
    expect(readRitual(next, 0)!.texts[0]).toBe('second')
    expect(readRitual(next, 1)).toBeNull()
  })
})

describe('ritualEntryShape', () => {
  const labels = examen.prompts.map((p) => p.label)
  const block = composeRitualMarkdown(examen.name, labels, ['Bread.', '', 'Short.', ''])

  it('reads a page that opens with its one ritual as a ritual entry', () => {
    const shape = ritualEntryShape(block)
    expect(shape.kind).toBe('ritual')
    if (shape.kind !== 'ritual') return
    expect(shape.contents.texts).toEqual(['Bread.', '', 'Short.', ''])
    expect(shape.after).toBe('')
  })

  it('keeps what follows the block as the After', () => {
    const shape = ritualEntryShape(`${block}\n\nA long quiet evening.`)
    expect(shape.kind === 'ritual' && shape.after).toBe('A long quiet evening.')
  })

  it('reads the After back when the last movement was left empty', () => {
    // What the composer writes: the block (ending on an empty answer line),
    // then a blank line, then the After.
    const doc = `${composeRitualMarkdown(examen.name, labels, ['Bread.', '', '', ''])}\n\nLater.`
    const shape = ritualEntryShape(doc)
    expect(shape.kind === 'ritual' && shape.contents.texts).toEqual(['Bread.', '', '', ''])
    expect(shape.kind === 'ritual' && shape.after).toBe('Later.')
  })

  it('tolerates blank lines above the ritual', () => {
    expect(ritualEntryShape(`\n\n${block}`).kind).toBe('ritual')
  })

  it('calls a ritual inside other writing, or two rituals, mixed', () => {
    expect(ritualEntryShape(`Morning.\n\n${block}`).kind).toBe('mixed')
    expect(ritualEntryShape(`${block}\n\n${block}`).kind).toBe('mixed')
  })

  it('calls a page without one plain', () => {
    expect(ritualEntryShape('Just a day.').kind).toBe('plain')
    expect(ritualEntryShape(null).kind).toBe('plain')
  })
})
