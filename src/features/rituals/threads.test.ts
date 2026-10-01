import { describe, expect, it } from 'vitest'
import { answerParts, buildRitualThreads, openingMovement, threadDepth } from './threads'
import type { Entry } from '@/lib/types'

/** The shape `buildPracticeBlock` actually writes into an entry. */
function ritual(name: string, movements: [string, string][]): string {
  const parts = [`<!-- ritual:name:${name} -->`]
  for (const [label, text] of movements) {
    parts.push(`<!-- ritual:section:${label} -->`)
    parts.push(text)
  }
  return parts.join('\n')
}

function entry(id: string, at: string, body: string): Entry {
  return {
    id,
    created_at: at,
    updated_at: at,
    body_markdown: body,
    title: null,
    mood: null,
    tags: [],
    word_count: 0,
    source: 'native',
    external_id: null,
  } as Entry
}

describe('buildRitualThreads', () => {
  it('groups the same movement across entries, newest first', () => {
    const threads = buildRitualThreads([
      entry(
        'a',
        '2026-06-01T07:00:00Z',
        ritual('The Daily Examen', [['Gratitude', 'Coffee, and the walk.']]),
      ),
      entry(
        'b',
        '2026-08-01T07:00:00Z',
        ritual('The Daily Examen', [['Gratitude', 'Ella read to me.']]),
      ),
    ])

    expect(threads).toHaveLength(1)
    const gratitude = threads[0]!.movements[0]!
    expect(gratitude.label).toBe('Gratitude')
    expect(gratitude.answers.map((a) => a.text)).toEqual(['Ella read to me.', 'Coffee, and the walk.'])
  })

  it('looks the question up live rather than reading it from the entry', () => {
    // The entry carries only the label; the question must come from the table.
    const threads = buildRitualThreads([
      entry('a', '2026-06-01T07:00:00Z', ritual('The Daily Examen', [['Gratitude', 'x']])),
    ])
    expect(threads[0]!.movements[0]!.question).toMatch(/grateful/i)
  })

  it('drops movements the writer left blank', () => {
    const threads = buildRitualThreads([
      entry(
        'a',
        '2026-06-01T07:00:00Z',
        ritual('The Daily Examen', [
          ['Gratitude', 'Something.'],
          ['Awareness', ''],
        ]),
      ),
    ])
    expect(threads[0]!.movements.map((m) => m.label)).toEqual(['Gratitude'])
  })

  it('omits a practice whose every movement is blank', () => {
    const threads = buildRitualThreads([
      entry('a', '2026-06-01T07:00:00Z', ritual('Lectio Divina', [['Lectio — Read', '']])),
    ])
    expect(threads).toEqual([])
  })

  it('orders practices by last walked', () => {
    const threads = buildRitualThreads([
      entry('a', '2026-01-01T07:00:00Z', ritual('The Daily Examen', [['Gratitude', 'x']])),
      entry('b', '2026-09-01T07:00:00Z', ritual('Psalmic Lament', [['Address', 'Lord.']])),
    ])
    expect(threads.map((t) => t.practice)).toEqual(['Psalmic Lament', 'The Daily Examen'])
  })

  it('reads a retired practice, so an old entry never loses its questions', () => {
    // `SHELF` hides the retired ones; `PRACTICE_BY_NAME` must still resolve them.
    const threads = buildRitualThreads([
      entry(
        'a',
        '2026-06-01T07:00:00Z',
        ritual('Emotionally Healthy Examen', [['Feel', 'Flat, mostly.']]),
      ),
    ])
    expect(threads[0]!.movements[0]!.question).not.toBe('')
  })

  it('survives a practice that is not in the table at all', () => {
    const threads = buildRitualThreads([
      entry('a', '2026-06-01T07:00:00Z', ritual('A Practice We Deleted', [['Some Label', 'words']])),
    ])
    expect(threads[0]!.movements[0]!.question).toBe('')
    expect(threads[0]!.movements[0]!.answers[0]!.text).toBe('words')
  })

  it('keeps a multi-paragraph answer whole', () => {
    const body = [
      '<!-- ritual:name:The Daily Examen -->',
      '<!-- ritual:section:Gratitude -->',
      'First line.',
      'Second line.',
      '<!-- ritual:section:Prayer -->',
      'Patience.',
    ].join('\n')
    const threads = buildRitualThreads([entry('a', '2026-06-01T07:00:00Z', body)])
    expect(threads[0]!.movements[0]!.answers[0]!.text).toBe('First line.\nSecond line.')
  })

  it('counts two blocks in one entry as two walks', () => {
    const body = `${ritual('The Daily Examen', [['Gratitude', 'one']])}\n\nprose\n\n${ritual(
      'The Daily Examen',
      [['Gratitude', 'two']],
    )}`
    const threads = buildRitualThreads([entry('a', '2026-06-01T07:00:00Z', body)])
    expect(threads[0]!.walks).toBe(2)
    expect(threads[0]!.movements[0]!.answers).toHaveLength(2)
  })

  it('ignores entries with no ritual in them', () => {
    expect(buildRitualThreads([entry('a', '2026-06-01T07:00:00Z', 'Just an ordinary page.')])).toEqual(
      [],
    )
  })

  it('reads the legacy practice: token prefix', () => {
    const body = [
      '<!-- practice:name:The Daily Examen -->',
      '<!-- practice:section:Gratitude -->',
      'From before the rename.',
    ].join('\n')
    expect(buildRitualThreads([entry('a', '2026-06-01T07:00:00Z', body)])[0]!.practice).toBe(
      'The Daily Examen',
    )
  })
})

describe('openingMovement', () => {
  it('prefers the deepest movement', () => {
    const threads = buildRitualThreads([
      entry(
        'a',
        '2026-06-01T07:00:00Z',
        ritual('The Daily Examen', [
          ['Gratitude', 'one'],
          ['Prayer', 'two'],
        ]),
      ),
      entry('b', '2026-07-01T07:00:00Z', ritual('The Daily Examen', [['Prayer', 'three']])),
    ])
    expect(openingMovement(threads[0]!)!.label).toBe('Prayer')
  })

  it('breaks a tie toward the shorter answers, not the longer', () => {
    // A column of brain dumps is a wall; a column of one-liners is a thread.
    const threads = buildRitualThreads([
      entry(
        'a',
        '2026-06-01T07:00:00Z',
        ritual('The Morning Offering', [
          ['Everything', 'a'.repeat(400)],
          ['What matters', 'Talking to Dan.'],
        ]),
      ),
    ])
    expect(openingMovement(threads[0]!)!.label).toBe('What matters')
  })

  it('returns null for a thread with no movements', () => {
    expect(openingMovement({ practice: 'x', walks: 0, lastAt: '', movements: [] })).toBeNull()
  })
})

describe('threadDepth', () => {
  it('counts every answer across every movement', () => {
    const threads = buildRitualThreads([
      entry(
        'a',
        '2026-06-01T07:00:00Z',
        ritual('The Daily Examen', [
          ['Gratitude', 'one'],
          ['Prayer', 'two'],
        ]),
      ),
    ])
    expect(threadDepth(threads[0]!)).toBe(2)
  })
})

describe('movement order', () => {
  it('follows the practice, not the order movements were first answered', () => {
    // The most recent walk skips "Not yours", so first-seen order would put it
    // after "Offering" — which comes after it in the ritual.
    const threads = buildRitualThreads([
      entry(
        'b',
        '2026-08-01T07:00:00Z',
        ritual('The Morning Offering', [
          ['Everything', 'a'],
          ['What matters', 'b'],
          ['Not yours', ''],
          ['Offering', 'd'],
        ]),
      ),
      entry(
        'a',
        '2026-06-01T07:00:00Z',
        ritual('The Morning Offering', [['Not yours', 'the roof']]),
      ),
    ])
    expect(threads[0]!.movements.map((m) => m.label)).toEqual([
      'Everything',
      'What matters',
      'Not yours',
      'Offering',
    ])
  })

  it('keeps first-seen order for a practice the table does not know', () => {
    const threads = buildRitualThreads([
      entry('a', '2026-06-01T07:00:00Z', ritual('Gone', [['Zeta', 'z'], ['Alpha', 'a']])),
    ])
    expect(threads[0]!.movements.map((m) => m.label)).toEqual(['Zeta', 'Alpha'])
  })
})

describe('answerParts — a verse never reads as her answer (Guardrail H3)', () => {
  it('shows a Read movement\'s passage by its reference, never the raw fence or the verse', () => {
    const read = [
      '```dayspring-scripture 7c1e0b52-9a0b-4f1e-8c3d-2b6a1f0e9d44',
      'Remain in me, and I in you.',
      'John 15:4–5 · ESV',
      '```',
    ].join('\n')
    expect(answerParts(read)).toEqual([{ kind: 'passage', text: 'John 15:4–5' }])
  })

  it('sets a `>` line apart as a quote, marker gone, and keeps her words as text', () => {
    const meditate = '> Remain in me (v. 4)\n\nHe says remain before\nhe says bear fruit.'
    expect(answerParts(meditate)).toEqual([
      { kind: 'quote', text: 'Remain in me (v. 4)' },
      { kind: 'text', text: 'He says remain before\nhe says bear fruit.' },
    ])
  })

  it('leaves a plain answer exactly as written', () => {
    expect(answerParts('The walk after dinner.\nAnd the rain.')).toEqual([
      { kind: 'text', text: 'The walk after dinner.\nAnd the rain.' },
    ])
  })
})

