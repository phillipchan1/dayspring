import { describe, it, expect } from 'vitest'
import {
  ageBand,
  ageMixture,
  firstName,
  ingestSsaYear,
  pFemale,
  type NameStats,
} from './nameInference.ts'

function index(...years: Array<[number, string]>): Map<string, NameStats> {
  const map = new Map<string, NameStats>()
  for (const [year, text] of years) ingestSsaYear(map, year, text)
  return map
}

describe('ingestSsaYear', () => {
  it('accumulates a name across sexes and years', () => {
    const map = index(
      [1990, 'Jordan,M,5000\nJordan,F,3000\nMary,F,9000'],
      [1991, 'Jordan,M,4000\nJordan,F,4000'],
    )
    const jordan = map.get('jordan')!
    expect(jordan.male).toBe(9000)
    expect(jordan.female).toBe(7000)
    expect(jordan.years.get(1990)).toBe(8000)
    expect(jordan.years.get(1991)).toBe(8000)
  })

  it('lowercases the key so lookup does not depend on the file casing', () => {
    const map = index([1990, 'MARY,F,10'])
    expect(map.get('mary')).toBeDefined()
  })

  it('skips malformed rows without losing the rest of the year', () => {
    const map = index([1990, 'Mary,F,9000\ngarbage\n\nBob,M,notanumber\nJohn,M,100\n'])
    expect(map.get('mary')!.female).toBe(9000)
    expect(map.get('john')!.male).toBe(100)
    expect(map.get('bob')).toBeUndefined()
    expect(map.size).toBe(2)
  })

  it('ignores a sex column that is neither M nor F', () => {
    const map = index([1990, 'Alex,X,500'])
    expect(map.size).toBe(0)
  })
})

describe('firstName', () => {
  it('takes the first token', () => {
    expect(firstName('Mary Ellen Robinson')).toBe('mary')
  })

  it('keeps hyphens and apostrophes, which belong to real names', () => {
    expect(firstName("Jean-Luc Picard")).toBe('jean-luc')
    expect(firstName("D'Angelo Barksdale")).toBe("d'angelo")
  })

  it('strips surrounding punctuation and whitespace', () => {
    expect(firstName('  "Mary" Smith ')).toBe('mary')
  })

  it('refuses initials — too thin to guess from', () => {
    expect(firstName('J. Robinson')).toBeNull()
  })

  it('refuses handles and email-ish tokens rather than guessing', () => {
    expect(firstName('user1234')).toBeNull()
    expect(firstName('mary_smith')).toBeNull()
    expect(firstName('mary@example.com')).toBeNull()
  })

  it('returns null for absent or empty names', () => {
    expect(firstName(undefined)).toBeNull()
    expect(firstName(null)).toBeNull()
    expect(firstName('   ')).toBeNull()
  })

  it('handles non-Latin scripts without crashing (they simply will not match)', () => {
    expect(firstName('宮崎 駿')).toBe('宮崎')
  })
})

describe('pFemale', () => {
  it('is the female share of births', () => {
    const map = index([1990, 'Jordan,M,6000\nJordan,F,4000'])
    expect(pFemale(map.get('jordan'))).toBeCloseTo(0.4, 5)
  })

  it('is 1 for an unambiguously female-coded name', () => {
    const map = index([1990, 'Mary,F,9000'])
    expect(pFemale(map.get('mary'))).toBe(1)
  })

  it('is null for an unknown name, so the caller can drop it from coverage', () => {
    expect(pFemale(undefined)).toBeNull()
  })

  it('is null rather than NaN when a name somehow has no births', () => {
    expect(pFemale({ male: 0, female: 0, years: new Map() })).toBeNull()
  })
})

describe('ageBand', () => {
  it('places ages inside their band, edges included', () => {
    expect(ageBand(18)).toBe('18–24')
    expect(ageBand(24)).toBe('18–24')
    expect(ageBand(25)).toBe('25–34')
    expect(ageBand(54)).toBe('45–54')
    expect(ageBand(64)).toBe('55–64')
  })

  it('has an open top band', () => {
    expect(ageBand(65)).toBe('65+')
    expect(ageBand(103)).toBe('65+')
  })
})

describe('ageMixture', () => {
  it('spreads one person across their name’s whole birth-year distribution', () => {
    // A name split evenly between 1970 and 2000 births.
    const map = index([1970, 'Robin,F,1000'], [2000, 'Robin,F,1000'])
    const mix = ageMixture(map.get('robin')!, 2026)
    expect(mix).toHaveLength(2)
    // 1970 → age 56, 2000 → age 26. Half a person in each band.
    expect(mix.map((m) => m.band).sort()).toEqual(['25–34', '55–64'])
    expect(mix.every((m) => Math.abs(m.weight - 0.5) < 1e-10)).toBe(true)
  })

  it('weights sum to exactly one, so nobody is counted twice', () => {
    const map = index(
      [1970, 'Robin,F,1234'],
      [1985, 'Robin,F,4321'],
      [2000, 'Robin,F,777'],
    )
    const total = ageMixture(map.get('robin')!, 2026).reduce((a, m) => a + m.weight, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('weights each year by its share of births', () => {
    const map = index([1990, 'Karen,F,900'], [1991, 'Karen,F,100'])
    const mix = ageMixture(map.get('karen')!, 2026)
    const y1990 = mix.find((m) => m.age === 36)!
    const y1991 = mix.find((m) => m.age === 35)!
    expect(y1990.weight).toBeCloseTo(0.9, 10)
    expect(y1991.weight).toBeCloseTo(0.1, 10)
  })

  it('concentrates a cohort-locked name in one band', () => {
    // Every "Karen" born 1963–1967 → ages 59–63 in 2026 → all 55–64.
    const map = index(
      [1963, 'Karen,F,30000'],
      [1965, 'Karen,F,32000'],
      [1967, 'Karen,F,28000'],
    )
    const mix = ageMixture(map.get('karen')!, 2026)
    expect(new Set(mix.map((m) => m.band))).toEqual(new Set(['55–64']))
  })

  it('returns nothing for a name with no year data rather than dividing by zero', () => {
    expect(ageMixture({ male: 5, female: 5, years: new Map() }, 2026)).toEqual([])
  })
})
