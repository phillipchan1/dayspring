import { describe, expect, it } from 'vitest'
import {
  currentMovementIndex,
  isRitualComplete,
  parseRitualBlocks,
  ritualBlockAtLine,
} from './ritualPacing'

/** A four-movement ritual, with `answers` written onto the matching lines. */
function examen(answers: (string | null)[] = [null, null, null, null]): string[] {
  const lines = ['<!-- ritual:name:The Daily Examen -->']
  const labels = ['Gratitude', 'Awareness', 'Examination', 'Prayer']
  labels.forEach((label, i) => {
    lines.push(`<!-- ritual:section:${label} -->`)
    lines.push(answers[i] ?? '')
  })
  return lines
}

describe('parseRitualBlocks', () => {
  it('reads a block, its name and every movement', () => {
    const [block] = parseRitualBlocks(examen())
    expect(block!.name).toBe('The Daily Examen')
    expect(block!.movements.map((m) => m.label)).toEqual([
      'Gratitude',
      'Awareness',
      'Examination',
      'Prayer',
    ])
  })

  it('points each movement at the line the writer answers on', () => {
    const [block] = parseRitualBlocks(examen())
    // line 1 is the name token; each movement is token, then its answer line.
    expect(block!.movements.map((m) => m.tokenLine)).toEqual([2, 4, 6, 8])
    expect(block!.movements.map((m) => m.answerLine)).toEqual([3, 5, 7, 9])
  })

  it('marks only the movements that have words in them', () => {
    const [block] = parseRitualBlocks(examen(['The long walk.', null, '   ', null]))
    expect(block!.movements.map((m) => m.filled)).toEqual([true, false, false, false])
  })

  it('follows a movement across several written lines', () => {
    const lines = [
      '<!-- ritual:name:The Daily Examen -->',
      '<!-- ritual:section:Gratitude -->',
      'The long walk after dinner.',
      '',
      'And the phone call I almost did not take.',
      '<!-- ritual:section:Awareness -->',
      '',
    ]
    const [block] = parseRitualBlocks(lines)
    expect(block!.movements[0]!.contentEnd).toBe(5)
    expect(block!.movements[0]!.filled).toBe(true)
  })

  it('ends the block at its last written line, not at the document end', () => {
    const lines = [
      ...examen(['Bread.', null, null, null]),
      '',
      'A thought I had afterwards that belongs to the entry.',
    ]
    const [block] = parseRitualBlocks(lines)
    // Line 9 is the final (empty) answer line; the prose two lines below is the
    // writer's own, and leaving the ritual must not swallow it.
    expect(block!.endLine).toBe(9)
    expect(ritualBlockAtLine([block!], 11)).toBeNull()
  })

  it('keeps a paragraph butted against the last answer inside the movement', () => {
    // No blank line between them, which in markdown means one paragraph — so it
    // belongs to the movement. Pressing Enter twice is how you leave a ritual,
    // and that is the case the test above covers.
    const lines = [
      ...examen(['Bread.', 'Distant.', 'Short with her.', 'Patience.']),
      'And another line right underneath it.',
    ]
    const [block] = parseRitualBlocks(lines)
    expect(block!.endLine).toBe(10)
    expect(block!.movements[3]!.filled).toBe(true)
  })

  it('separates two rituals in one entry', () => {
    const lines = [...examen(['Bread.', null, null, null]), ...examen()]
    const blocks = parseRitualBlocks(lines)
    expect(blocks).toHaveLength(2)
    expect(blocks[1]!.nameLine).toBe(10)
  })

  it('still reads the legacy `practice:` prefix', () => {
    const lines = [
      '<!-- practice:name:The Daily Examen -->',
      '<!-- practice:section:Gratitude -->',
      'Bread.',
    ]
    const [block] = parseRitualBlocks(lines)
    expect(block!.name).toBe('The Daily Examen')
    expect(block!.movements[0]!.filled).toBe(true)
  })

  it('finds the block a line sits in, and nothing outside one', () => {
    const lines = ['Prose above.', '', ...examen()]
    const [block] = parseRitualBlocks(lines)
    expect(ritualBlockAtLine([block!], 1)).toBeNull()
    expect(ritualBlockAtLine([block!], 5)).toBe(block)
  })
})

describe('where the writer is standing', () => {
  it('holds them in the first movement still unanswered', () => {
    const [block] = parseRitualBlocks(examen(['Bread.', null, null, null]))
    expect(currentMovementIndex(block!)).toBe(1)
  })

  it('treats a skipped movement as the one still waiting', () => {
    const [block] = parseRitualBlocks(examen([null, 'Distant.', null, null]))
    expect(currentMovementIndex(block!)).toBe(0)
  })

  it('rests on the last movement once the practice is written through', () => {
    const [block] = parseRitualBlocks(examen(['a', 'b', 'c', 'd']))
    expect(isRitualComplete(block!)).toBe(true)
    expect(currentMovementIndex(block!)).toBe(3)
  })

  it('is not complete while any movement is empty', () => {
    const [block] = parseRitualBlocks(examen(['a', 'b', 'c', null]))
    expect(isRitualComplete(block!)).toBe(false)
  })
})
