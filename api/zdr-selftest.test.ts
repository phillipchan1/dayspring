import { afterEach, describe, expect, it } from 'vitest'
import { GET } from './zdr-selftest.js'

const KEY = 'ZDR_SELFTEST_TOKEN'
let saved: string | undefined

function isolate(): void {
  saved = process.env[KEY]
  delete process.env[KEY]
}

function restore(): void {
  if (saved === undefined) delete process.env[KEY]
  else process.env[KEY] = saved
}

describe('zdr-selftest guard', () => {
  afterEach(restore)

  it('returns 404 when the token env is unset', async () => {
    isolate()
    const res = await GET(new Request('http://localhost/api/zdr-selftest'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the header does not match', async () => {
    isolate()
    process.env[KEY] = 'expected-token'
    const res = await GET(
      new Request('http://localhost/api/zdr-selftest', {
        headers: { 'x-zdr-selftest-token': 'wrong' },
      }),
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 when no header is sent', async () => {
    isolate()
    process.env[KEY] = 'expected-token'
    const res = await GET(new Request('http://localhost/api/zdr-selftest'))
    expect(res.status).toBe(404)
  })
})
