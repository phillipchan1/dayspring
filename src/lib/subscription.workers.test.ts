import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./env', () => ({
  env: { apiBaseUrl: '', backend: 'workers' },
  isWorkersBackend: true,
  isSupabaseConfigured: false,
}))

const apiGet = vi.fn()
vi.mock('./api', () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiUrl: (path: string) => path,
}))

import { fetchSubscription } from './subscription'

describe('fetchSubscription (workers mode)', () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  it('reads entitlements from GET /api/data/profile, not supabase.from(profiles)', async () => {
    apiGet.mockResolvedValue({
      profile: {
        plan: 'active',
        plan_source: 'stripe',
        trial_ends_at: null,
        plan_expires_at: '2026-06-01T00:00:00.000Z',
        onboarded_at: '2026-01-01T00:00:00.000Z',
        feature_flags: ['trial_extended'],
      },
    })

    await expect(fetchSubscription()).resolves.toEqual({
      plan: 'active',
      plan_source: 'stripe',
      trial_ends_at: null,
      plan_expires_at: '2026-06-01T00:00:00.000Z',
      onboarded_at: '2026-01-01T00:00:00.000Z',
      featureFlags: ['trial_extended'],
    })
    expect(apiGet).toHaveBeenCalledWith('/api/data/profile')
  })

  it('throws when the profile row is missing', async () => {
    apiGet.mockResolvedValue({ profile: null })
    await expect(fetchSubscription()).rejects.toThrow('No profile row')
  })
})
