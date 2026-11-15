import { describe, expect, it } from 'vitest'
import { env, isWorkersBackend } from './env'

describe('backend flag (inert default)', () => {
  it('does not treat an unset or Vercel API URL as Workers', () => {
    expect(env.backend).toBe('')
    expect(isWorkersBackend).toBe(false)
  })
})
