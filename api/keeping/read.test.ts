import { describe, expect, it } from 'vitest'
import { candidatesForEntry } from './read'

describe('candidatesForEntry', () => {
  it('includes literal subjects and writer-named implicit domains', () => {
    const result = candidatesForEntry(
      'The boys were home sick again today.',
      [
        {
          canonical: 'the boys',
          surface_forms: ['boys'],
          kind: 'person',
          status: 'suggested',
          source: 'repetition',
          first_seen: '2020-01-01',
        },
        {
          canonical: 'Family',
          surface_forms: [],
          kind: 'term',
          status: 'confirmed',
          source: 'explicit',
          first_seen: '2019-01-01',
        },
        {
          canonical: 'Unrelated Project',
          surface_forms: [],
          kind: 'project',
          status: 'suggested',
          source: 'repetition',
          first_seen: '2018-01-01',
        },
      ],
      [],
    )

    expect(result.map((subject) => subject.label)).toEqual(['the boys', 'Family'])
  })

  it('keeps typed subjects available for semantic joins', () => {
    const result = candidatesForEntry('We packed the last box tonight.', [], [
      {
        subject_key: 'word:the move',
        label: 'The move',
        terms: ['the move'],
        kind: 'matter',
      },
    ])

    expect(result).toEqual([
      {
        key: 'word:the move',
        label: 'The move',
        terms: ['the move'],
        kind: 'matter',
        writerNamed: true,
      },
    ])
  })

  it('never offers the journal addressee as an implicit subject', () => {
    const result = candidatesForEntry(
      'Jesus, I need you.',
      [
        {
          canonical: 'Jesus',
          surface_forms: [],
          kind: 'person',
          status: 'confirmed',
          source: 'explicit',
          first_seen: '2019-01-01',
        },
      ],
      [],
    )

    expect(result).toEqual([])
  })
})
