import { describe, expect, it } from 'vitest'
import {
  booleanProbs,
  chunkWriterWords,
  formatLunaVariant,
  lunaSentimentSchema,
  lunaSentimentSystem,
  lunaTunedHarvest,
  lunaTunedSentiment,
  lunaTunedTag,
  parseLunaVariant,
} from './lunaTuned.js'
import { emptyFittedThresholds } from './sentimentThresholds.js'

describe('luna-tuned variant parsing', () => {
  it('defaults to gate-first, small batches, tight+denial without lp', () => {
    const v = parseLunaVariant()
    expect(formatLunaVariant(v)).toBe('harvest=gate,gb=6,hb=3,chunk=4000,tb=2,sent=tight+denial')
  })
  it('parses overrides and rejects unknown parts', () => {
    const v = parseLunaVariant('harvest=nocue,hb=2,tb=3,sent=tight+denial+lp')
    expect(v).toMatchObject({ harvest: 'nocue', harvestBatch: 2, tagBatch: 3, tight: true, denial: true, lp: true })
    expect(parseLunaVariant('sent=plain')).toMatchObject({ tight: false, denial: false, lp: false })
    expect(() => parseLunaVariant('bogus=1')).toThrow()
    expect(() => parseLunaVariant('sent=tight+nope')).toThrow()
  })
})

describe('chunkWriterWords', () => {
  it('keeps short entries whole and splits long ones on sentence boundaries', () => {
    expect(chunkWriterWords('Lord, help.', 4000)).toEqual(['Lord, help.'])
    const body = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} is here.`).join(' ')
    const chunks = chunkWriterWords(body, 300)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(300)
      expect(body.includes(c)).toBe(true)
    }
    expect(chunks.join(' ')).toBe(body)
  })
})

describe('lunaTunedHarvest', () => {
  const entries = [
    { id: 'a', body: 'Walked the dog. Please just let her be okay tonight.' },
    { id: 'b', body: 'Groceries, laundry, errands.' },
  ]
  it('gates first and only span-harvests gate-positive entries, in small batches', async () => {
    const harvestCalls: string[][] = []
    const res = await lunaTunedHarvest(entries, parseLunaVariant('harvest=gate,hb=1'), {
      callModel: (async () => ({
        entries: [
          { id: 'a', contains_prayer: true, contains_sense: false },
          { id: 'b', contains_prayer: false, contains_sense: false },
        ],
      })) as never,
      harvestBatch: async (batch) => {
        harvestCalls.push(batch.map((e) => e.id))
        return new Map([['a', [{ type: 'prayer' as const, text: 'Please just let her be okay tonight.' }]]])
      },
    })
    expect(harvestCalls).toEqual([['a']])
    expect(res.gate.get('a')?.containsPrayer).toBe(true)
    expect(res.gate.get('b')?.containsPrayer).toBe(false)
    expect(res.byEntry.get('a')?.[0]?.text).toBe('Please just let her be okay tonight.')
    expect(res.harvestedChunks).toBe(1)
  })
  it('fails open to span harvest when the gate call throws, and drops non-verbatim spans', async () => {
    const res = await lunaTunedHarvest(entries, parseLunaVariant('harvest=gate,hb=6'), {
      callModel: (async () => {
        throw new Error('down')
      }) as never,
      harvestBatch: async () => new Map([['a', [{ type: 'prayer' as const, text: 'invented words' }]]]),
    })
    expect(res.harvestedChunks).toBe(2)
    expect(res.byEntry.size).toBe(0)
  })
  it('without a gate, the entry gate is any kept span', async () => {
    const res = await lunaTunedHarvest(entries, parseLunaVariant('harvest=nocue'), {
      harvestBatch: async () => new Map([['a', [{ type: 'sense' as const, text: 'Walked the dog.' }]]]),
    })
    expect(res.gate.get('a')).toEqual({ containsPrayer: false, containsSense: true })
    expect(res.gate.get('b')).toEqual({ containsPrayer: false, containsSense: false })
  })
})

describe('lunaTunedTag', () => {
  it('slices lines into batches of tagBatch', async () => {
    const sizes: number[] = []
    const lines = Array.from({ length: 5 }, (_, i) => ({ id: `l${i}`, content: 'x' }))
    const out = await lunaTunedTag(lines, parseLunaVariant('tb=2'), {
      tagTexts: async (b) => {
        sizes.push(b.length)
        return new Map(b.map((l) => [l.id, [{ label: 'work', kind: 'place' as const }]]))
      },
    })
    expect(sizes.sort()).toEqual([1, 2, 2])
    expect(out.size).toBe(5)
  })
})

describe('luna-tuned sentiment', () => {
  it('prompt carries the tight definitions and denial instruction; schema asks denied first', () => {
    const v = parseLunaVariant('sent=tight+denial')
    expect(lunaSentimentSystem(v)).toContain('Not mere stress')
    expect(lunaSentimentSystem(v)).toContain('"denied"')
    const schema = lunaSentimentSchema(v) as { required: string[] }
    expect(schema.required[0]).toBe('denied')
    const lp = lunaSentimentSchema(parseLunaVariant('sent=tight+denial+lp')) as { required: string[] }
    expect(lp.required).toContain('feels_anger')
    expect(lp.required).not.toContain('emotions')
  })
  it('drops denied emotions', async () => {
    const r = await lunaTunedSentiment('I am not angry, just tired.', parseLunaVariant('sent=tight+denial'), {}, {
      callModel: (async () => ({ denied: ['anger'], present: true, valence: -0.4, activation: 0.2, emotions: ['anger', 'weariness'] })) as never,
    })
    expect(r.emotions).toEqual(['weariness'])
    expect(r.denied).toEqual(['anger'])
  })
  it('reads boolean confidences from logprobs and applies thresholds', async () => {
    const tokens = [
      { token: '{"', logprob: 0 },
      { token: 'present', logprob: 0 },
      { token: '":', logprob: 0 },
      { token: 'true', logprob: Math.log(0.9) },
      { token: ',"feels_fear":', logprob: 0 },
      { token: 'true', logprob: Math.log(0.6) },
      { token: ',"feels_stress":', logprob: 0 },
      { token: 'false', logprob: Math.log(0.7) },
      { token: '}', logprob: 0 },
    ]
    const probs = booleanProbs(tokens)
    expect(probs.present).toBeCloseTo(0.9)
    expect(probs.feels_fear).toBeCloseTo(0.6)
    expect(probs.feels_stress).toBeCloseTo(0.3)
    const deps = {
      callModelLogprobs: (async () => ({
        out: { denied: [], present: true, valence: -0.5, activation: 0.6, feels_fear: true, feels_stress: false },
        tokens,
      })) as never,
    }
    const v = parseLunaVariant('sent=tight+denial+lp')
    const lo = await lunaTunedSentiment('x', v, { thresholds: emptyFittedThresholds({ stress: 0.25 }) }, deps)
    expect(lo.emotions.sort()).toEqual(['fear', 'stress'])
    const hi = await lunaTunedSentiment('x', v, { thresholds: emptyFittedThresholds({ fear: 0.7 }) }, deps)
    expect(hi.emotions).toEqual([])
  })
})
