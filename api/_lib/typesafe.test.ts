import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askJev, configureTypeSafe, resetTypeSafe } from './typesafe.js'
import { noul } from '@typesafe-ai/sdk'
import { answersForQuestions, noulYes, parseBody, systemOneResponse } from './jev/mockFetch.js'

describe('askJev', () => {
  const logs: string[] = []

  beforeEach(() => {
    process.env.TYPESAFE_API_KEY = 'test-key'
    process.env.TYPESAFE_MODEL = 'jev-1.13.0'
    logs.length = 0
    vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      logs.push(String(a[0] ?? ''))
    })
  })

  afterEach(() => {
    resetTypeSafe()
    vi.restoreAllMocks()
    delete process.env.TYPESAFE_API_KEY
    delete process.env.TYPESAFE_MODEL
  })

  it('logs the [tokens] line recognition-eval parses, including ms=, and never logs state', async () => {
    configureTypeSafe({
      fetch: async (_url, init) => {
        const req = parseBody(init)
        return systemOneResponse(answersForQuestions(req.questions, () => noulYes()), {
          input: 312,
          output: 30,
        })
      },
    })

    const result = await askJev('jev_harvest:x', { sentences: ['secret journal text'] }, {
      contains_prayer: noul('Is this a prayer?'),
    })

    expect(result.model).toBe('jev-1.13.0')
    expect(result.usage).toEqual({ input_tokens: 312, output_tokens: 30 })
    expect(result.ms).toBeGreaterThanOrEqual(0)
    const line = logs.find((l) => l.startsWith('[tokens]'))
    expect(line).toMatch(
      /^\[tokens\] name=jev_harvest:x model=jev-1\.13\.0 in=312 cached=0 out=30 reasoning=0 attempt=0 ms=\d+$/,
    )
    expect(logs.join('\n')).not.toContain('secret journal text')
    expect(logs.join('\n')).not.toContain('contains_prayer')
  })
})
