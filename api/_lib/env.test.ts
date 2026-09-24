import { afterEach, describe, expect, it } from 'vitest'
import { env } from './env.js'

const KEYS = ['OPENAI_MODEL', 'OPENAI_VISION_MODEL', 'OPENAI_TRANSCRIBE_MODEL'] as const

function restore(saved: Record<string, string | undefined>): void {
  for (const key of KEYS) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('text / vision / transcribe model defaults', () => {
  const saved: Record<string, string | undefined> = {}

  afterEach(() => restore(saved))

  function isolate(): void {
    for (const key of KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  }

  it('defaults the text model to gpt-6-luna when OPENAI_MODEL is unset', () => {
    isolate()
    expect(env.model()).toBe('gpt-6-luna')
  })

  it('lets OPENAI_MODEL override the text default', () => {
    isolate()
    process.env.OPENAI_MODEL = 'gpt-5.4-nano'
    expect(env.model()).toBe('gpt-5.4-nano')
  })

  it('leaves vision and transcribe defaults on their own models', () => {
    isolate()
    expect(env.visionModel()).toBe('gpt-4o')
    expect(env.transcribeModel()).toBe('gpt-4o-mini-transcribe')
  })
})
