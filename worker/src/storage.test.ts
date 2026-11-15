import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sessionUser } from './auth.ts'
import { app } from './index.ts'
import {
  hashFromStorageKey,
  sha256Hex,
  signR2Url,
  verifyR2Sig,
} from './storage.ts'

vi.mock('./auth.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./auth.ts')>()
  return { ...actual, sessionUser: vi.fn() }
})

vi.mock('./store.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./store.ts')>()
  return { ...actual, upsertAttachment: vi.fn(async () => 'att-id') }
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
const SIGNING_KEY = 'test-signing-key-not-for-prod'

class MemoryR2 {
  private data = new Map<string, { buf: ArrayBuffer; contentType: string; etag: string }>()

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | Blob,
    options?: { httpMetadata?: { contentType?: string } },
  ) {
    const buf = value instanceof ArrayBuffer
      ? value
      : await new Blob([value as BlobPart]).arrayBuffer()
    const etag = crypto.randomUUID().replace(/-/g, '')
    this.data.set(key, {
      buf,
      contentType: options?.httpMetadata?.contentType ?? 'application/octet-stream',
      etag,
    })
    return { key, size: buf.byteLength, etag, httpEtag: `"${etag}"` }
  }

  async get(key: string) {
    const obj = this.data.get(key)
    if (!obj) return null
    return {
      body: new Blob([obj.buf]).stream(),
      httpMetadata: { contentType: obj.contentType },
      etag: obj.etag,
      httpEtag: `"${obj.etag}"`,
      size: obj.buf.byteLength,
      arrayBuffer: async () => obj.buf,
    }
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

  size() {
    return this.data.size
  }
}

function r2Env(bucket: MemoryR2, extra: Record<string, unknown> = {}) {
  return {
    ENVIRONMENT: 'local',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/dayspring',
    STORAGE_BACKEND: 'r2',
    STORAGE_SIGNING_KEY: SIGNING_KEY,
    ATTACHMENTS: bucket,
    ...extra,
  }
}

async function sign(
  env: Record<string, unknown>,
  body: Record<string, unknown>,
  owner = OWNER_A,
) {
  vi.mocked(sessionUser).mockResolvedValue({ id: owner, email: 'a@test' })
  return app.request('/api/storage/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, env)
}

describe('/api/storage', () => {
  beforeEach(() => {
    vi.mocked(sessionUser).mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects a cross-owner storageKey with 403', async () => {
    const res = await sign(r2Env(new MemoryR2()), {
      action: 'upload',
      storageKey: `${OWNER_B}/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg`,
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'forbidden key' })
  })

  it('sign → PUT → GET roundtrips through R2', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
    const hash = await sha256Hex(bytes.buffer)
    const storageKey = `${OWNER_A}/${hash}.png`
    const bucket = new MemoryR2()
    const env = r2Env(bucket)

    const uploadSign = await sign(env, {
      action: 'upload',
      storageKey,
      hash,
      mime: 'image/png',
      bytes: bytes.byteLength,
    })
    expect(uploadSign.status).toBe(200)
    const { signedUrl: putUrl } = await uploadSign.json() as { signedUrl: string }
    expect(putUrl).toContain('/api/storage/object/')
    expect(putUrl).toContain(`/${OWNER_A}/${hash}.png`)
    expect(putUrl).toContain('exp=')
    expect(putUrl).toContain('sig=')

    const putParsed = new URL(putUrl)
    const put = await app.request(putParsed.pathname + putParsed.search, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: bytes,
    }, env)
    expect(put.status).toBe(200)
    expect(put.headers.get('access-control-allow-origin')).toBe('*')

    const downloadSign = await sign(env, {
      action: 'download',
      storageKey,
      transform: { width: 1400, quality: 72, resize: 'contain' },
    })
    expect(downloadSign.status).toBe(200)
    const { signedUrl: getUrl } = await downloadSign.json() as { signedUrl: string }
    const getParsed = new URL(getUrl)
    const get = await app.request(getParsed.pathname + getParsed.search, { method: 'GET' }, env)
    expect(get.status).toBe(200)
    expect(get.headers.get('content-type')).toBe('image/png')
    expect(get.headers.get('etag')).toMatch(/^"/)
    expect(get.headers.get('cache-control')).toContain('private')
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(bytes)
  })

  it('rejects a bad or expired R2 signature with 403', async () => {
    const hash = 'c'.repeat(64)
    const storageKey = `${OWNER_A}/${hash}.jpg`
    const bucket = new MemoryR2()
    const env = r2Env(bucket)
    const origin = 'http://localhost'

    const { signedUrl } = await signR2Url({
      origin,
      method: 'GET',
      key: storageKey,
      secret: SIGNING_KEY,
    })
    const parsed = new URL(signedUrl)
    parsed.searchParams.set('sig', 'deadbeef')
    const bad = await app.request(parsed.pathname + parsed.search, { method: 'GET' }, env)
    expect(bad.status).toBe(403)

    const expired = await signR2Url({
      origin,
      method: 'GET',
      key: storageKey,
      secret: SIGNING_KEY,
      nowSec: Math.floor(Date.now() / 1000) - 4000,
    })
    const expiredParsed = new URL(expired.signedUrl)
    const gone = await app.request(
      expiredParsed.pathname + expiredParsed.search,
      { method: 'GET' },
      env,
    )
    expect(gone.status).toBe(403)
  })

  it('fails closed when STORAGE_SIGNING_KEY is missing', async () => {
    const hash = 'd'.repeat(64)
    const res = await sign(r2Env(new MemoryR2(), { STORAGE_SIGNING_KEY: '' }), {
      action: 'download',
      storageKey: `${OWNER_A}/${hash}.jpg`,
    })
    expect(res.status).toBe(501)
  })

  it('OPTIONS /api/storage/object allows PUT for Capacitor/Tauri', async () => {
    const res = await app.request('/api/storage/object/x/y.jpg', { method: 'OPTIONS' }, r2Env(new MemoryR2()))
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-methods') ?? '').toMatch(/PUT/)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })
})

describe('R2 HMAC helpers', () => {
  it('accepts a matching signature and rejects a swapped method', async () => {
    const key = `${OWNER_A}/${'e'.repeat(64)}.jpg`
    const { signedUrl } = await signR2Url({
      origin: 'https://dayspring.example',
      method: 'PUT',
      key,
      secret: SIGNING_KEY,
      mime: 'image/jpeg',
      bytes: 12,
    })
    const url = new URL(signedUrl)
    expect(await verifyR2Sig({
      method: 'PUT',
      key,
      exp: url.searchParams.get('exp'),
      sig: url.searchParams.get('sig'),
      secret: SIGNING_KEY,
      mime: url.searchParams.get('mime'),
      bytes: url.searchParams.get('bytes'),
    })).toBe(true)
    expect(await verifyR2Sig({
      method: 'GET',
      key,
      exp: url.searchParams.get('exp'),
      sig: url.searchParams.get('sig'),
      secret: SIGNING_KEY,
      mime: url.searchParams.get('mime'),
      bytes: url.searchParams.get('bytes'),
    })).toBe(false)
    expect(hashFromStorageKey(key)).toBe('e'.repeat(64))
  })
})
