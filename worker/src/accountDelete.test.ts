import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sessionUser } from './auth.ts'
import { app } from './index.ts'
import { deleteOwnedAccount } from './store.ts'

vi.mock('./auth.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./auth.ts')>()
  return { ...actual, sessionUser: vi.fn() }
})

vi.mock('./store.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./store.ts')>()
  return {
    ...actual,
    deleteOwnedAccount: vi.fn(async () => {}),
    upsertAttachment: vi.fn(async () => 'att-id'),
  }
})

vi.mock('./request.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./request.ts')>()
  return {
    ...actual,
    authOf: (c: { set: (k: string, v: unknown) => void }) => {
      const auth = {}
      c.set('auth', auth)
      return auth
    },
    sqlOf: (c: { set: (k: string, v: unknown) => void }) => {
      const sql = { end: async () => undefined }
      c.set('sql', sql)
      return sql
    },
  }
})

const OWNER_A = '11111111-1111-1111-1111-111111111111'
const OWNER_B = '22222222-2222-2222-2222-222222222222'

class MemoryR2 {
  private data = new Map<string, ArrayBuffer>()

  async put(key: string, value: ArrayBuffer | ArrayBufferView | string | Blob) {
    const buf = value instanceof ArrayBuffer
      ? value
      : await new Blob([value as BlobPart]).arrayBuffer()
    this.data.set(key, buf)
    return { key, size: buf.byteLength }
  }

  async list(opts: { prefix?: string; cursor?: string; limit?: number } = {}) {
    const keys = [...this.data.keys()].filter((k) => !opts.prefix || k.startsWith(opts.prefix)).sort()
    const start = opts.cursor ? keys.indexOf(opts.cursor) + 1 : 0
    const limit = opts.limit ?? 1000
    const slice = keys.slice(Math.max(0, start), Math.max(0, start) + limit)
    return {
      objects: slice.map((key) => ({ key })),
      truncated: start + slice.length < keys.length,
      cursor: slice.at(-1),
    }
  }

  async delete(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.data.delete(key)
  }

  keys() {
    return [...this.data.keys()].sort()
  }
}

function env(bucket: MemoryR2) {
  return {
    ENVIRONMENT: 'local',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/dayspring',
    STORAGE_SIGNING_KEY: 'test-signing-key-not-for-prod',
    ATTACHMENTS: bucket,
  }
}

describe('DELETE /api/account/delete', () => {
  beforeEach(() => {
    vi.mocked(sessionUser).mockReset()
    vi.mocked(deleteOwnedAccount).mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deletes Neon rows then every R2 object under <userId>/, including a second page', async () => {
    const bucket = new MemoryR2()
    const other = `${OWNER_B}/keep.jpg`
    await bucket.put(other, new Uint8Array([1]))
    for (let i = 0; i < 1001; i++) {
      await bucket.put(`${OWNER_A}/obj-${String(i).padStart(4, '0')}.jpg`, new Uint8Array([i % 256]))
    }
    expect(bucket.keys().filter((k) => k.startsWith(`${OWNER_A}/`)).length).toBe(1001)

    vi.mocked(sessionUser).mockResolvedValue({ id: OWNER_A, email: 'a@test' })
    const res = await app.request('/api/account/delete', { method: 'DELETE' }, env(bucket))
    expect(res.status).toBe(200)
    expect(vi.mocked(deleteOwnedAccount)).toHaveBeenCalledTimes(1)
    expect(bucket.keys()).toEqual([other])
  })
})
