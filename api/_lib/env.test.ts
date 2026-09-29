import { afterEach, describe, expect, it } from 'vitest'
import { env } from './env.js'

const KEYS = [
  'OPENAI_MODEL',
  'OPENAI_VISION_MODEL',
  'OPENAI_TRANSCRIBE_MODEL',
  'TYPESAFE_API_KEY',
  'TYPESAFE_MODEL',
  'CLASSIFIER_PROVIDER',
] as const

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

describe('TypeSafe / classifier lab defaults', () => {
  const saved: Record<string, string | undefined> = {}

  afterEach(() => restore(saved))

  function isolate(): void {
    for (const key of KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  }

  it('leaves the TypeSafe key unset so imports never throw', () => {
    isolate()
    expect(env.typesafeKey()).toBeNull()
  })

  it('pins Jev to 1.13.0 when TYPESAFE_MODEL is unset', () => {
    isolate()
    expect(env.typesafeModel()).toBe('jev-1.13.0')
  })

  it('lets TYPESAFE_MODEL override the pin', () => {
    isolate()
    process.env.TYPESAFE_MODEL = 'jev-latest'
    expect(env.typesafeModel()).toBe('jev-latest')
  })

  it('defaults the classifier provider to openai (no production path change)', () => {
    isolate()
    expect(env.classifierProvider()).toBe('openai')
  })

  it('accepts jev and cascade providers', () => {
    isolate()
    process.env.CLASSIFIER_PROVIDER = 'jev'
    expect(env.classifierProvider()).toBe('jev')
    process.env.CLASSIFIER_PROVIDER = 'cascade'
    expect(env.classifierProvider()).toBe('cascade')
  })

  it('falls back to openai on an unknown CLASSIFIER_PROVIDER', () => {
    isolate()
    process.env.CLASSIFIER_PROVIDER = 'llama'
    expect(env.classifierProvider()).toBe('openai')
  })
})
