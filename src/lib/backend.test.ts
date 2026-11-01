import { describe, expect, it } from 'vitest'
import { env, isSupabaseConfigured, isWorkersBackend } from './env'

describe('backend flag (inert default)', () => {
  it('does not treat an unset or Vercel API URL as Workers', () => {
    expect(env.backend).toBe('')
    expect(isWorkersBackend).toBe(false)
  })

  it('keeps the existing supabase-configured meaning', () => {
    expect(typeof isSupabaseConfigured).toBe('boolean')
  })
})
