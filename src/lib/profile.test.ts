import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  workers: true,
  apiGet: vi.fn(async (): Promise<{ profile: { acked_processing_completion: string | null } | null }> => ({
    profile: { acked_processing_completion: null },
  })),
  apiPost: vi.fn(async (_path: string, _body: { key: string }) => ({ ok: true })),
}))

vi.mock('./env', () => ({
  get isWorkersBackend() {
    return h.workers
  },
}))
vi.mock('./api', () => ({
  apiGet: h.apiGet,
  apiPost: h.apiPost,
}))
vi.mock('./supabase', () => ({
  requireSupabase: () => {
    throw new Error('supabase must not be used in workers mode')
  },
}))

const { getAckedCompletion, setAckedCompletion } = await import('./profile')

beforeEach(() => {
  h.workers = true
  h.apiGet.mockReset()
  h.apiPost.mockReset()
  h.apiGet.mockResolvedValue({ profile: { acked_processing_completion: null } })
  h.apiPost.mockResolvedValue({ ok: true })
})

describe('acked_processing_completion workers parity', () => {
  it('reads the text completion key from GET /api/data/profile', async () => {
    h.apiGet.mockResolvedValueOnce({
      profile: { acked_processing_completion: '2026-03-01T12:00:00.000Z' },
    })
    await expect(getAckedCompletion()).resolves.toBe('2026-03-01T12:00:00.000Z')
    expect(h.apiGet).toHaveBeenCalledWith('/api/data/profile')
  })

  it('treats a missing or empty key as null', async () => {
    h.apiGet.mockResolvedValueOnce({ profile: { acked_processing_completion: '' } })
    await expect(getAckedCompletion()).resolves.toBeNull()
    h.apiGet.mockResolvedValueOnce({ profile: null })
    await expect(getAckedCompletion()).resolves.toBeNull()
  })

  it('writes the same text key to POST /api/profile/ack-completion', async () => {
    const key = '2026-03-01T12:00:00.000Z'
    h.apiPost.mockImplementationOnce(async (_path: string, body: { key: string }) => {
      h.apiGet.mockResolvedValueOnce({ profile: { acked_processing_completion: body.key } })
      return { ok: true }
    })
    await setAckedCompletion(key)
    expect(h.apiPost).toHaveBeenCalledWith('/api/profile/ack-completion', { key })
    await expect(getAckedCompletion()).resolves.toBe(key)
  })
})
