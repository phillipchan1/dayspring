import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configureTypeSafe, resetTypeSafe } from '../typesafe.js'
import { cascadeHarvest, cascadeSentiment, cascadeTag } from './cascade.js'
import {
  answersForQuestions,
  choiceOf,
  noulNo,
  noulYes,
  parseBody,
  scoreOf,
  systemOneResponse,
} from './mockFetch.js'

describe('cascade', () => {
  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = 'test-key'
  })
  afterEach(() => {
    resetTypeSafe()
    delete process.env.TYPESAFE_API_KEY
  })

  it('escalates a Jev transport error to the OpenAI harvest seam', async () => {
    configureTypeSafe({
      fetch: async () => {
        throw new Error('network down')
      },
    })
    const res = await cascadeHarvest([{ id: 'e1', body: 'Lord, be near her.' }], {
      tau: 0.8,
      harvestWithOpenAI: async () => ({
        byEntry: new Map([['e1', [{ type: 'prayer', text: 'Lord, be near her.' }]]]),
        failed: [],
      }),
    })
    expect(res.route.get('e1')).toBe('llm')
    expect(res.byEntry.get('e1')?.[0]?.text).toBe('Lord, be near her.')
    expect(res.failed).not.toContain('e1')
  })

  it('escalates none_of_these to the OpenAI tagger', async () => {
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id) => {
            if (id === 'keep') return noulYes()
            if (id === 'kind') return choiceOf('theme', 0.7)
            return choiceOf('none_of_these', 0.6)
          }),
        )
      },
    })
    const res = await cascadeTag([{ id: 'l1', content: 'Lord, the unnamed thing.' }], ['Naomi'], {
      tagWithOpenAI: async () => new Map([['l1', [{ label: 'the unnamed thing', kind: 'theme' }]]]),
    })
    expect(res.route.get('l1')).toBe('llm')
    expect(res.tags.get('l1')?.[0]?.label).toBe('the unnamed thing')
  })

  it('keeps a high-confidence Jev sentiment without calling OpenAI', async () => {
    let openaiCalls = 0
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id, type) => {
            if (id === 'present') return noulYes(0.96)
            if (type === 'score') return scoreOf(id === 'valence' ? 3.2 : 1.0, 0.9)
            if (id === 'emo_joy') return noulYes(0.88)
            return noulNo(0.05)
          }),
        )
      },
    })
    const reading = await cascadeSentiment('I felt happy walking home.', {
      tau: 0.8,
      sentimentWithOpenAI: async () => {
        openaiCalls++
        throw new Error('should not run')
      },
    })
    expect(reading.route).toBe('jev')
    expect(reading.present).toBe(true)
    expect(reading.emotions).toContain('joy')
    expect(openaiCalls).toBe(0)
  })
})
