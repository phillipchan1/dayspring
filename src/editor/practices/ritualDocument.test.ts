import { describe, expect, it } from 'vitest'
import {
  composeRitualMarkdown,
  readRitual,
  ritualBlockRange,
  ritualIndexAt,
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
