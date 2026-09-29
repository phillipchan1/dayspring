import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configureTypeSafe, resetTypeSafe } from '../typesafe.js'
import { chunkForHarvest, estimateHarvestTokens, jevHarvestTexts } from './harvest.js'
import { TARGET_TOKENS_PER_REQUEST } from './sentences.js'
import {
  answersForQuestions,
  choiceOf,
  noulNo,
  noulYes,
  parseBody,
  systemOneResponse,
} from './mockFetch.js'

describe('jevHarvestTexts', () => {
  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = 'test-key'
  })
  afterEach(() => {
    resetTypeSafe()
    delete process.env.TYPESAFE_API_KEY
  })

  it('builds verbatim spans from sentence labels and respects the per-entry cap', async () => {
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id, type) => {
            if (id === 'contains_prayer') return noulYes()
            if (id === 'contains_sense') return noulNo()
            if (type === 'choice') {
              const state = req.state as { sentences?: string[] }
              const i = Number(id.slice(1))
              const text = state.sentences?.[i] ?? ''
              if (/Lord|Take the fear/.test(text)) return choiceOf('prayer', 0.92)
              return choiceOf('neither', 0.88)
            }
            return noulNo()
          }),
        )
      },
    })

    const body = 'Long day.\n\nLord, I am tired of being afraid. Take the fear of tomorrow off me.\n\nMade dinner.'
    const { byEntry, failed, gate } = await jevHarvestTexts([{ id: 'e1', body }])
    expect(failed).toEqual([])
    const passages = byEntry.get('e1') ?? []
    expect(passages.length).toBeGreaterThan(0)
    expect(passages.length).toBeLessThanOrEqual(5)
    expect(body.includes(passages[0]!.text)).toBe(true)
    expect(passages[0]!.type).toBe('prayer')
    expect(gate.get('e1')?.containsPrayer).toBe(true)
  })

  it('chunks a 260-sentence entry into more than one request', async () => {
    let calls = 0
    configureTypeSafe({
      fetch: async (_url, init) => {
        calls++
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id, type) => {
            if (type === 'noul') return noulNo()
            return choiceOf('neither', 0.7)
          }),
        )
      },
    })
    const body = Array.from({ length: 260 }, (_, i) => `Sentence number ${i} about the weather.`).join(' ')
    await jevHarvestTexts([{ id: 'long', body }])
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  it('records HTTP 400 max_tokens_exceeded instead of swallowing it', async () => {
    configureTypeSafe({
      fetch: async () =>
        new Response(JSON.stringify({ error: { code: 'max_tokens_exceeded', message: 'too large' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
    })
    const { failed, failures } = await jevHarvestTexts([{ id: 'adv-long', body: 'Lord, help me tonight.' }])
    expect(failed).toEqual(['adv-long'])
    expect(failures[0]?.status).toBe(400)
    expect(failures[0]?.code).toBe('max_tokens_exceeded')
    expect(failures[0]?.message).toMatch(/400|max_tokens|too large/i)
  })

  it('packs long entries so each harvest chunk stays under the token budget', () => {
    const sentences = Array.from({ length: 200 }, (_, i) => ({
      id: `s${i}`,
      text: `${'The same long weather note repeats here. '.repeat(8)}${i}.`,
      start: 0,
      end: 10,
    }))
    const chunks = chunkForHarvest(sentences)
    expect(chunks.length).toBeGreaterThan(2)
    for (const chunk of chunks) {
      if (chunk.length > 1) expect(estimateHarvestTokens(chunk)).toBeLessThanOrEqual(TARGET_TOKENS_PER_REQUEST)
    }
    expect(chunks.flat()).toHaveLength(200)
  })

  it('records lowConfidence when a sentence is under tau', async () => {
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id, type) => {
            if (type === 'noul') return noulYes(0.6)
            return choiceOf('prayer', 0.4)
          }),
        )
      },
    })
    const { lowConfidence } = await jevHarvestTexts(
      [{ id: 'low', body: 'Lord, be near her tonight.' }],
      { tau: 0.8 },
    )
    expect(lowConfidence).toContain('low')
  })
})
