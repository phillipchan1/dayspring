import { describe, expect, it, vi } from 'vitest'
import { kickWorker } from '../../../api/_lib/processing.ts'
import { runInBridge, type BridgeContext } from './bridge.ts'
import { buildSelfKick, KICK_HEADER, PROCESS_TICK_PATH } from './selfKick.ts'

const SECRET = 'cron-secret-for-tests'

describe('self-kick', () => {
  it('kicks process-tick through the SELF binding with the cron secret and kick header', async () => {
    const self = { fetch: vi.fn(async (_req: Request | string) => new Response(null, { status: 202 })) }
    const globalFetch = vi.fn()
    const log = vi.fn()
    const kick = buildSelfKick({ self, origin: 'https://api.example.test', cronSecret: SECRET, fetchImpl: globalFetch as never, log })
    expect(kick).not.toBeNull()
    await kick!()
    expect(globalFetch).not.toHaveBeenCalled()
    expect(self.fetch).toHaveBeenCalledTimes(1)
    const req = self.fetch.mock.calls[0][0] as Request
    expect(new URL(req.url).pathname).toBe(PROCESS_TICK_PATH)
    expect(req.headers.get('authorization')).toBe(`Bearer ${SECRET}`)
    expect(req.headers.get(KICK_HEADER)).toBe('1')
    expect(log).not.toHaveBeenCalled()
  })

  it('logs a non-2xx kick instead of swallowing it, without the secret', async () => {
    const log = vi.fn()
    const self = { fetch: vi.fn(async () => new Response('nope', { status: 522 })) }
    await buildSelfKick({ self, origin: null, cronSecret: SECRET, log })!()
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toMatch(/SELF binding returned 522/)
    expect(log.mock.calls[0][0]).not.toContain(SECRET)
  })

  it('logs a thrown kick (e.g. same-zone fetch refused)', async () => {
    const log = vi.fn()
    const fetchImpl = vi.fn(async () => { throw new Error('error code: 1042') })
    await buildSelfKick({ origin: 'https://api.example.test/', cronSecret: SECRET, fetchImpl: fetchImpl as never, log })!()
    expect(fetchImpl).toHaveBeenCalledWith(`https://api.example.test${PROCESS_TICK_PATH}`, expect.anything())
    expect(log.mock.calls[0][0]).toMatch(/origin fetch failed: error code: 1042/)
  })

  it('is off without CRON_SECRET or any route to this Worker', () => {
    expect(buildSelfKick({ origin: 'https://x.test', cronSecret: null })).toBeNull()
    expect(buildSelfKick({ origin: null, cronSecret: SECRET })).toBeNull()
  })

  it("processing.ts kickWorker() runs the bridge's kick under waitUntil", async () => {
    const kick = vi.fn(async () => undefined)
    const tasks: Promise<unknown>[] = []
    const ctx = { client: {} as never, waitUntil: (p: Promise<unknown>) => { tasks.push(p) }, kick } as BridgeContext
    await runInBridge(ctx, async () => { kickWorker() })
    expect(kick).toHaveBeenCalledTimes(1)
    expect(tasks).toHaveLength(1)
  })

  it('logs when the bridge has no kick', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await runInBridge({ client: {} as never, waitUntil: () => undefined, kick: null }, async () => { kickWorker() })
      expect(err.mock.calls.some((c) => String(c[0]).includes('[self-kick] skipped'))).toBe(true)
    } finally {
      err.mockRestore()
    }
  })
})
