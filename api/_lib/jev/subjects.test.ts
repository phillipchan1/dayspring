import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configureTypeSafe, resetTypeSafe } from '../typesafe.js'
import { jevTagTexts } from './subjects.js'
import {
  answersForQuestions,
  choiceOf,
  noulNo,
  noulYes,
  parseBody,
  systemOneResponse,
} from './mockFetch.js'

describe('jevTagTexts', () => {
  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = 'test-key'
  })
  afterEach(() => {
    resetTypeSafe()
    delete process.env.TYPESAFE_API_KEY
  })

  it('assigns a vocabulary label and runs it through cleanTags', async () => {
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id) => {
            if (id === 'keep') return noulYes()
            if (id === 'kind') return choiceOf('person', 0.91)
            return choiceOf('Naomi', 0.87)
          }),
        )
      },
    })
    const res = await jevTagTexts([{ id: 'l1', content: 'God, be near her tonight.' }], ['Naomi', 'Frontier'])
    expect(res.tags.get('l1')).toEqual([{ label: 'Naomi', kind: 'person' }])
    expect(res.needsLlm).not.toContain('l1')
  })

  it('marks none_of_these as needs-LLM', async () => {
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id) => {
            if (id === 'keep') return noulYes()
            if (id === 'kind') return choiceOf('theme', 0.8)
            return choiceOf('none_of_these', 0.77)
          }),
        )
      },
    })
    const res = await jevTagTexts([{ id: 'l2', content: 'Lord, the unnamed thing.' }], ['Naomi'])
    expect(res.needsLlm).toContain('l2')
    expect(res.tags.get('l2')).toEqual([])
  })

  it('drops a divine label even if Jev returns it', async () => {
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(
          answersForQuestions(req.questions, (id) => {
            if (id === 'keep') return noulYes()
            if (id === 'kind') return choiceOf('person', 0.9)
            return choiceOf('Jesus', 0.9)
          }),
        )
      },
    })
    const res = await jevTagTexts([{ id: 'l3', content: 'Jesus, I love you.' }], ['Jesus', 'Naomi'])
    expect(res.tags.get('l3')).toEqual([])
  })
})
