import { describe, expect, it } from 'vitest'
import * as app from './writerWords'
import * as server from '../../api/_lib/writerWords'
import { PRACTICES } from '@/editor/practices/practicesData'

const SOAP = [
  'Morning, before anyone was up.',
  '<!-- ritual:name:SOAP -->',
  '<!-- ritual:section:Scripture -->',
  '```dayspring-scripture 7c1e0b52-9a0b-4f1e-8c3d-2b6a1f0e9d44',
  'Remain in me, and I in you.',
  'John 15:4 · ESV',
  '```',
  '<!-- ritual:section:Observation -->',
  '> Remain in me, and I in you (v. 4)',
  '',
  'He says remain before he says bear fruit.',
  '<!-- ritual:section:Prayer -->',
  '> I am the vine',
  '',
  'Teach me to stay.',
  '<!-- ritual:end -->',
  '',
  'After: the kids woke up.',
].join('\n')

describe.each([
  ['app', app],
  ['server', server],
])('writerWords (%s)', (_, m) => {
  it('keeps only what the writer wrote', () => {
    expect(m.writerWords(SOAP)).toBe(
      [
        'Morning, before anyone was up.',
        '',
        'He says remain before he says bear fruit.',
        '',
        'Teach me to stay.',
        '',
        'After: the kids woke up.',
      ].join('\n'),
    )
  })

  it('never lets a verse through as the writer’s words', () => {
    const out = m.writerWords(SOAP)
    expect(out).not.toContain('Remain in me')
    expect(out).not.toContain('I am the vine')
    expect(out).not.toContain('dayspring-scripture')
    expect(out).not.toContain('ritual:')
  })

  it('takes a verse-numbered quote out of any page, and keeps other quotes', () => {
    const page = 'A friend said:\n> You are not behind.\n\n> Be still (v. 10)\nAnd I was.'
    expect(m.writerWords(page)).toBe('A friend said:\n> You are not behind.\n\nAnd I was.')
  })

  it('keeps the writer’s own prayer block, and quotes in a ritual that is not Scripture', () => {
    const page = [
      '<!-- ritual:name:The Daily Examen -->',
      '<!-- ritual:section:Gratitude -->',
      '> My mother’s line: go gently',
      '```dayspring-pray 2d4e6f80-1a3b-4c5d-8e7f-9a0b1c2d3e4f',
      'Give me patience for the first hour.',
      '```',
      '<!-- ritual:end -->',
    ].join('\n')
    const out = m.writerWords(page)
    expect(out).toContain('> My mother’s line: go gently')
    expect(out).toContain('Give me patience for the first hour.')
  })

  it('reads an empty page as empty', () => {
    expect(m.writerWords('')).toBe('')
    expect(m.writerWords(null)).toBe('')
  })
})

describe('the scripture rituals list', () => {
  it('is exactly the practices that begin with a passage', () => {
    const withPassage = PRACTICES.filter((p) => p.passage).map((p) => p.name).sort()
    expect([...app.SCRIPTURE_RITUALS].sort()).toEqual(withPassage)
    expect([...server.SCRIPTURE_RITUALS]).toEqual([...app.SCRIPTURE_RITUALS])
  })
})
