// Guards the deterministic gates the Concordance applies to model proposals.
//
// The charter (concordance.ts, top of file) asks one question of every
// candidate: does this help REPRODUCE the user, or CONCLUDE something about
// them? Names and spellings reproduce. Moods, traits and struggles conclude.
// The model is told the rule in the prompt; these gates are what make it true
// regardless of what the model returns, so they are the part worth testing.
//
// Two asymmetric failure modes:
//   a missed name        — costs fidelity; the transcript spells "Es" wrong
//   a surviving verdict  — breaks "light, not verdict" outright, by storing a
//                          conclusion about someone's interior life
//
// Prose comes from the shared corpus (src/lib/recognition/), categories
// entity-alias / entity-descriptor-bait / entity-generic-control.

import { describe, expect, it } from 'vitest'
import {
  CONCORDANCE,
  EVALUATIVE_DESCRIPTOR,
  gateCandidate,
  isVerbatim,
  machineConfidence,
  type Candidate,
} from './concordance.js'
import { CORPUS } from '../../src/lib/recognition/corpus/index.js'

const byId = (id: string) => CORPUS.find((e) => e.id === id)!

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  kind: 'person',
  canonical: 'Esther',
  surface_form: 'Es',
  ...over,
})

describe('gateCandidate', () => {
  const body = byId('ent-alias-02').body // "Es booked the tickets without telling me…"

  it('accepts a candidate whose surface form is the writer’s own spelling', () => {
    expect(gateCandidate(body, candidate())).toEqual({
      kind: 'person',
      canonical: 'Esther',
      surface_form: 'Es',
    })
  })

  it('rejects a surface form that does not appear in the entry', () => {
    // The honesty gate. A canonical name may be inferred; a SPELLING may not —
    // the whole point of the surface form is that the writer wrote it.
    expect(gateCandidate(body, candidate({ surface_form: 'Esther' }))).toBeNull()
  })

  it('is whitespace-tolerant about the surface form', () => {
    const wrapped = byId('pra-paraphrase-02').body // has line breaks
    expect(gateCandidate(wrapped, candidate({ canonical: 'x', surface_form: 'be patient with me' }))).not.toBeNull()
  })

  it('rejects an unknown kind', () => {
    expect(gateCandidate(body, candidate({ kind: 'mood' as Candidate['kind'] }))).toBeNull()
    expect(CONCORDANCE.KINDS).not.toContain('mood')
  })

  it('rejects absurdly long canonical names and surface forms', () => {
    expect(gateCandidate(body, candidate({ canonical: 'x'.repeat(81) }))).toBeNull()
    expect(gateCandidate(`${body} ${'y'.repeat(81)}`, candidate({ surface_form: 'y'.repeat(81) }))).toBeNull()
  })

  it('rejects empty fields', () => {
    expect(gateCandidate(body, candidate({ canonical: '   ' }))).toBeNull()
    expect(gateCandidate(body, candidate({ surface_form: '' }))).toBeNull()
  })

  it('keeps a clean identity descriptor', () => {
    const ada = byId('ent-descriptor-04')
    const out = gateCandidate(
      ada.body,
      candidate({ canonical: 'Ada', surface_form: 'Ada', descriptor: 'my daughter' }),
    )
    expect(out?.descriptor).toBe('my daughter')
  })

  it('drops an evaluative descriptor and KEEPS the entity', () => {
    // This is the load-bearing behavior: the person stays in the Concordance,
    // the diagnosis about them does not.
    const bait = byId('ent-descriptor-01') // "Es is anxious about the move…"
    const out = gateCandidate(bait.body, candidate({ descriptor: 'anxious about the move' }))
    expect(out).toEqual({ kind: 'person', canonical: 'Esther', surface_form: 'Es' })
    expect(out?.descriptor).toBeUndefined()
  })

  it('drops a descriptor that is too long or too wordy, entity intact', () => {
    const long = gateCandidate(body, candidate({ descriptor: 'a'.repeat(61) }))
    expect(long?.canonical).toBe('Esther')
    expect(long?.descriptor).toBeUndefined()

    const wordy = gateCandidate(body, candidate({ descriptor: 'one two three four five six' }))
    expect(wordy?.canonical).toBe('Esther')
    expect(wordy?.descriptor).toBeUndefined()
  })
})

describe('EVALUATIVE_DESCRIPTOR', () => {
  it('catches the verdict words the charter refuses', () => {
    for (const d of [
      'anxious about the move',
      'seems lonely',
      'struggling with the same thing',
      'a broken man',
      'growing in confidence',
      'feeling stuck',
    ]) {
      expect(EVALUATIVE_DESCRIPTOR.test(d), d).toBe(true)
    }
  })

  it('lets plain identity through', () => {
    for (const d of ['my wife', 'my daughter', 'our church', 'futures ticker', 'my accountant']) {
      expect(EVALUATIVE_DESCRIPTOR.test(d), d).toBe(false)
    }
  })
})

describe('isVerbatim', () => {
  it('accepts an exact or whitespace-normalized substring, rejects anything else', () => {
    const body = 'Drove up to Whitby\nwith Es for the day.'
    expect(isVerbatim(body, 'Whitby')).toBe(true)
    expect(isVerbatim(body, 'Whitby with Es')).toBe(true)
    expect(isVerbatim(body, 'Scarborough')).toBe(false)
    expect(isVerbatim(body, '')).toBe(false)
  })
})

describe('machineConfidence', () => {
  it('starts higher for an import seed than for a repetition', () => {
    expect(machineConfidence('import', 1)).toBe(CONCORDANCE.IMPORT_SEED_CONFIDENCE)
    expect(machineConfidence('repetition', 1)).toBe(CONCORDANCE.REPETITION_BASE_CONFIDENCE)
  })

  it('rises with the number of distinct entries an entity appears in', () => {
    const climb = [1, 2, 3, 4].map((n) => machineConfidence('import', n))
    expect(climb).toEqual([...climb].sort((a, b) => a - b))
    expect(climb[3]!).toBeGreaterThan(climb[0]!)
  })

  it('never reaches certainty, however often the entity recurs', () => {
    // Only the user's own confirm or correction pins a Concordance item at 1.0.
    // A machine that can talk itself up to certainty is how a fidelity aid
    // turns into a claim about someone.
    for (const n of [1, 5, 50, 5000]) {
      expect(machineConfidence('import', n)).toBeLessThan(1)
      expect(machineConfidence('repetition', n)).toBeLessThanOrEqual(0.9)
    }
    expect(machineConfidence('import', 5000)).toBe(0.9)
  })

  it('does not go below the base for a first sighting', () => {
    expect(machineConfidence('import', 0)).toBe(CONCORDANCE.IMPORT_SEED_CONFIDENCE)
    expect(machineConfidence('import', -3)).toBe(CONCORDANCE.IMPORT_SEED_CONFIDENCE)
  })
})
