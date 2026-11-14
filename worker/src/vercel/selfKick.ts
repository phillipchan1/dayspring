/**
 * Self-kick for the processing engine (api/_lib/processing.ts kickWorker()).
 *
 * Preferred path: the SELF service binding (a binding to this same Worker), so
 * the kick never leaves Cloudflare and does not depend on BETTER_AUTH_URL, DNS
 * or the custom domain. Fallback: fetch `${origin}/api/cron/process-tick`.
 *
 * The kicked request carries KICK_HEADER. index.ts answers it with 202 at once
 * and runs the tick under that invocation's own ctx.waitUntil, so a chain of
 * kicks never nests (each kicker only waits for the 202) and every tick gets
 * its own CPU budget. Failures are logged (status or error message only —
 * never the URL's secret or headers) instead of being swallowed.
 */
export const KICK_HEADER = 'x-dayspring-kick'
export const PROCESS_TICK_PATH = '/api/cron/process-tick'
/** Host is ignored by a service binding; only the path routes. */
const SELF_ORIGIN = 'https://dayspring.self'

export interface SelfFetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>
}

export interface SelfKickOptions {
  self?: SelfFetcher | null
  origin: string | null
  cronSecret: string | null
  fetchImpl?: typeof fetch
  log?: (message: string) => void
}

export function buildSelfKick(opts: SelfKickOptions): (() => Promise<void>) | null {
  const secret = opts.cronSecret?.trim()
  const log = opts.log ?? ((m: string) => console.error(m))
  if (!secret) {
    return null
  }
  const self = opts.self ?? null
  const origin = opts.origin?.trim().replace(/\/$/, '') || null
  if (!self && !origin) return null
  const via = self ? 'SELF binding' : 'origin fetch'
  return async () => {
    const headers = { authorization: `Bearer ${secret}`, [KICK_HEADER]: '1' }
    try {
      const res = self
        ? await self.fetch(new Request(`${SELF_ORIGIN}${PROCESS_TICK_PATH}`, { headers }))
        : await (opts.fetchImpl ?? fetch)(`${origin}${PROCESS_TICK_PATH}`, { headers })
      if (!res.ok) log(`[self-kick] process-tick via ${via} returned ${res.status}`)
      await res.body?.cancel().catch(() => undefined)
    } catch (e) {
      log(`[self-kick] process-tick via ${via} failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}
