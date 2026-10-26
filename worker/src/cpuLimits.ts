/**
 * Routes likely to blow Workers Free's 10 ms CPU budget.
 * I/O wait (OpenAI, Resend, Neon) does not count; JSON, embeddings, and
 * per-entry loops do. See docs/cloudflare-migration/inventory.md §6.
 */
export const CPU_HEAVY_ROUTES = [
  'POST /api/ask',
  'POST /api/keeping/read',
  'POST /api/pages/interpret',
  'POST /api/transcribe',
  'POST /api/transcribe-image',
  'POST /api/onboarding/backfill',
  'POST /api/spiritual/notice',
  'GET|POST /api/cron/synthesize',
  'GET|POST /api/cron/process-tick',
  'GET|POST /api/cron/echoes',
  'POST /api/reflections/generate',
  'POST /api/concordance/rebuild',
] as const

export const CPU_HEAVY_NOTE =
  'Workers Free: 10ms CPU/request. This route is flagged to exceed that on a real payload; use Workers Paid ($5/mo) or keep it on Vercel until cutover.'

export function cpuHeavyPayload(route: string): { route: string; cpu: 'exceeds-free-10ms'; note: string } {
  return { route, cpu: 'exceeds-free-10ms', note: CPU_HEAVY_NOTE }
}
