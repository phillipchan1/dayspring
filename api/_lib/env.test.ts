import { afterEach, describe, expect, it } from 'vitest'
import { env } from './env.js'

const KEYS = [
  'OPENAI_MODEL',
  'OPENAI_VISION_MODEL',
  'OPENAI_TRANSCRIBE_MODEL',
  'AI_GATEWAY_ZDR',
  'AI_GATEWAY_ZDR_PROVIDERS',
  'GATHER_MODE',
  'GATHER_SENTIMENT',
  'GATHER_ENGINE',
  'GATHER_SETTLE_MINUTES',
  'GATHER_READ',
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

  it('keeps the AI Gateway ZDR flag off unless it is on/true', () => {
    isolate()
    expect(env.aiGatewayZdr()).toBe(false)
    process.env.AI_GATEWAY_ZDR = 'off'
    expect(env.aiGatewayZdr()).toBe(false)
    process.env.AI_GATEWAY_ZDR = 'on'
    expect(env.aiGatewayZdr()).toBe(true)
    process.env.AI_GATEWAY_ZDR = 'TRUE'
    expect(env.aiGatewayZdr()).toBe(true)
  })

  it('defaults ZDR providers to azure and splits a comma list', () => {
    isolate()
    expect(env.aiGatewayZdrProviders()).toEqual(['azure'])
    process.env.AI_GATEWAY_ZDR_PROVIDERS = 'azure, openai'
    expect(env.aiGatewayZdrProviders()).toEqual(['azure', 'openai'])
  })
})

describe('Gather flags', () => {
  const saved: Record<string, string | undefined> = {}

  afterEach(() => restore(saved))

  function isolate(): void {
    for (const key of KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  }

  it('defaults gatherMode to gate and gatherSentiment to tight-denial', () => {
    isolate()
    expect(env.gatherMode()).toBe('gate')
    expect(env.gatherSentiment()).toBe('tight-denial')
  })

  it('parses known values and falls unknown values back to the defaults', () => {
    isolate()
    process.env.GATHER_MODE = 'gate'
    process.env.GATHER_SENTIMENT = 'tight-denial'
    expect(env.gatherMode()).toBe('gate')
    expect(env.gatherSentiment()).toBe('tight-denial')

    process.env.GATHER_MODE = 'GATE'
    process.env.GATHER_SENTIMENT = 'TIGHT-DENIAL'
    expect(env.gatherMode()).toBe('gate')
    expect(env.gatherSentiment()).toBe('tight-denial')

    process.env.GATHER_MODE = 'luna'
    process.env.GATHER_SENTIMENT = 'tight'
    expect(env.gatherMode()).toBe('gate')
    expect(env.gatherSentiment()).toBe('tight-denial')

    process.env.GATHER_MODE = ' CUE '
    process.env.GATHER_SENTIMENT = 'V2'
    expect(env.gatherMode()).toBe('cue')
    expect(env.gatherSentiment()).toBe('v2')
  })
})

describe('gather engine flags', () => {
  const saved: Record<string, string | undefined> = {}
  afterEach(() => restore(saved))
  function isolate(): void {
    for (const key of KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  }

  it('is off unless GATHER_ENGINE is exactly "on"', () => {
    isolate()
    expect(env.gatherEngine()).toBe(false)
    for (const v of ['true', '1', 'yes', 'gate', '']) {
      process.env.GATHER_ENGINE = v
      expect(env.gatherEngine()).toBe(false)
    }
    process.env.GATHER_ENGINE = ' ON '
    expect(env.gatherEngine()).toBe(true)
  })

  it('stores the read only when GATHER_READ is exactly "on"', () => {
    isolate()
    expect(env.gatherRead()).toBe(false)
    for (const v of ['true', '1', 'yes', '']) {
      process.env.GATHER_READ = v
      expect(env.gatherRead()).toBe(false)
    }
    process.env.GATHER_READ = ' On '
    expect(env.gatherRead()).toBe(true)
  })

  it('settles for 30 minutes by default, and ignores a nonsense override', () => {
    isolate()
    expect(env.gatherSettleMinutes()).toBe(30)
    process.env.GATHER_SETTLE_MINUTES = '5'
    expect(env.gatherSettleMinutes()).toBe(5)
    process.env.GATHER_SETTLE_MINUTES = '0'
    expect(env.gatherSettleMinutes()).toBe(0)
    for (const v of ['-3', 'soon']) {
      process.env.GATHER_SETTLE_MINUTES = v
      expect(env.gatherSettleMinutes()).toBe(30)
    }
  })
})
