/**
 * The Vercel handlers the Worker serves as-is, and what each needs to run.
 * Loaded lazily so Node strip-types checks that import `app` never resolve
 * api/**'s `.js` specifiers (wrangler/esbuild and vitest do).
 */
import type { VercelHandler } from './bridge.ts'

export type Gate =
  /** Text/vision/embeddings through api/_lib/aiClient.ts (AI Gateway, ZDR). */
  | 'ai-gateway'
  /** Direct OpenAI audio (no ZDR route exists), as on Vercel. */
  | 'openai-direct'
  /** No model call. */
  | 'none'
  /** Sends mail. Off until WORKER_MAIL_CRONS=on (Vercel's crons off in the same step). */
  | 'mail'

export interface PortedRoute {
  method: 'GET' | 'POST'
  path: string
  gate: Gate
  load: () => Promise<VercelHandler>
}

const post = (path: string, gate: Gate, load: () => Promise<{ POST: VercelHandler }>): PortedRoute => ({
  method: 'POST',
  path,
  gate,
  load: async () => (await load()).POST,
})
const cron = (path: string, gate: Gate, load: () => Promise<{ GET: VercelHandler }>): PortedRoute => ({
  method: 'GET',
  path,
  gate,
  load: async () => (await load()).GET,
})

export const PORTED_ROUTES: PortedRoute[] = [
  post('/api/ask', 'ai-gateway', () => import('../../../api/ask.ts')),
  post('/api/transcribe', 'openai-direct', () => import('../../../api/transcribe.ts')),
  post('/api/transcribe-image', 'ai-gateway', () => import('../../../api/transcribe-image.ts')),
  post('/api/pages/interpret', 'ai-gateway', () => import('../../../api/pages/interpret.ts')),
  post('/api/keeping/read', 'ai-gateway', () => import('../../../api/keeping/read.ts')),
  post('/api/reflections/generate', 'ai-gateway', () => import('../../../api/reflections/generate.ts')),
  post('/api/spiritual/notice', 'ai-gateway', () => import('../../../api/spiritual/notice.ts')),
  post('/api/spiritual/scripture', 'ai-gateway', () => import('../../../api/spiritual/scripture.ts')),
  post('/api/spiritual/scripture-resolve', 'none', () => import('../../../api/spiritual/scripture-resolve.ts')),
  post('/api/spiritual/scripture-chapter', 'none', () => import('../../../api/spiritual/scripture-chapter.ts')),
  post('/api/onboarding/backfill', 'ai-gateway', () => import('../../../api/onboarding/backfill.ts')),
  post('/api/concordance/rebuild', 'ai-gateway', () => import('../../../api/concordance/rebuild.ts')),
  post('/api/processing/enqueue', 'none', () => import('../../../api/processing/enqueue.ts')),
  cron('/api/cron/synthesize', 'ai-gateway', () => import('../../../api/cron/synthesize.ts')),
  cron('/api/cron/process-tick', 'ai-gateway', () => import('../../../api/cron/process-tick.ts')),
  cron('/api/cron/echoes', 'ai-gateway', () => import('../../../api/cron/echoes.ts')),
  cron('/api/cron/welcome-drip', 'mail', () => import('../../../api/cron/welcome-drip.ts')),
  cron('/api/cron/remind', 'mail', () => import('../../../api/cron/remind.ts')),
  cron('/api/cron/sync-resend', 'mail', () => import('../../../api/cron/sync-resend.ts')),
]

/** Same schedule as vercel.json `crons`; scheduled() maps each to its path. */
export const CRON_PATHS: Record<string, string> = {
  '0 8 * * *': '/api/cron/synthesize',
  '* * * * *': '/api/cron/process-tick',
  '0 9 * * *': '/api/cron/remind',
  '15 9 * * *': '/api/cron/sync-resend',
  '30 9 * * *': '/api/cron/welcome-drip',
  '0 10 * * 1': '/api/cron/echoes',
}

export function workerMailCronsOn(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  return v === 'on' || v === 'true'
}

/**
 * Speech-to-text has no ZDR route, so POST /api/transcribe calls OpenAI directly,
 * as on Vercel (Tech Lead ruling, Nov 13 2026: dictation and captions stay off ZDR).
 * This is the only Worker file allowed to name that key (worker/src/ai.guard.ts).
 */
export function openaiDirectConfigured(env: object): boolean {
  const v = (env as Record<string, unknown>).OPENAI_API_KEY
  return typeof v === 'string' && v.trim().length > 0
}
