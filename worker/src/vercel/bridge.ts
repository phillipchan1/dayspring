/**
 * Runs an unchanged Vercel handler (api/**) inside the Worker.
 *
 * Per request, an AsyncLocalStorage context supplies:
 *   - supabaseAdmin(): a Neon-backed supabase-js-shaped client (pgrest.ts), so
 *     the Vercel code's `.from()/.rpc()/auth.*` calls hit Neon through
 *     Hyperdrive. auth.getUser(token) resolves Better Auth bearer sessions.
 *   - @vercel/functions waitUntil(): mapped to ctx.waitUntil.
 *   - kickWorker(): kicks this Worker's own /api/cron/process-tick, never
 *     APP_URL (which still names the Vercel web app).
 * api/_lib/env.ts reads process.env, which nodejs_compat fills from the
 * Worker's vars and secrets (compatibility_date ≥ 2025-04-01).
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setSupabaseAdminOverride } from '../../../api/_lib/supabaseAdmin.ts'
import { setKickWorkerOverride } from '../../../api/_lib/processing.ts'
import { createPgRestClient, type PgRestClient } from './pgrest.ts'

export type VercelHandler = (req: Request) => Promise<Response> | Response

export interface BridgeContext {
  client: PgRestClient
  waitUntil: (p: Promise<unknown>) => void
  /** Public origin of this Worker (BETTER_AUTH_URL), for self-kicks. */
  origin: string | null
  cronSecret: string | null
}

const als = new AsyncLocalStorage<BridgeContext>()
const REQ_CONTEXT = Symbol.for('@vercel/request-context')
let installed = false

function install(): void {
  if (installed) return
  installed = true
  setSupabaseAdminOverride(() => {
    const ctx = als.getStore()
    if (!ctx) throw new Error('supabaseAdmin() called outside a Worker request context')
    return ctx.client as unknown as SupabaseClient
  })
  setKickWorkerOverride(() => {
    const ctx = als.getStore()
    if (!ctx?.origin || !ctx.cronSecret) return
    const url = `${ctx.origin.replace(/\/$/, '')}/api/cron/process-tick`
    ctx.waitUntil(
      fetch(url, { headers: { authorization: `Bearer ${ctx.cronSecret}` } }).then(() => undefined).catch(() => undefined),
    )
  })
  ;(globalThis as Record<symbol, unknown>)[REQ_CONTEXT] = {
    get: () => {
      const ctx = als.getStore()
      return ctx ? { waitUntil: ctx.waitUntil } : {}
    },
  }
}

export function bridgeContext(): BridgeContext | undefined {
  return als.getStore()
}

export async function runInBridge<T>(ctx: BridgeContext, fn: () => Promise<T>): Promise<T> {
  install()
  return als.run(ctx, fn)
}

/** Run a Vercel handler as-is (its own CORS via api/_lib/cors.ts). */
export async function runVercelHandler(ctx: BridgeContext, handler: VercelHandler, req: Request): Promise<Response> {
  return runInBridge(ctx, async () => handler(req))
}

export { createPgRestClient }
