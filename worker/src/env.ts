export interface HyperdriveBinding {
  connectionString: string
}

export interface Env {
  ASSETS?: Fetcher
  HYPERDRIVE?: HyperdriveBinding
  DATABASE_URL?: string
  OPENAI_API_KEY?: string
  OPENAI_MODEL?: string
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
  /** wrangler / `.dev.vars` only: `local` allows a localhost auth fallback. */
  ENVIRONMENT?: string
  RESEND_API_KEY?: string
  RESEND_FROM?: string
  CRON_SECRET?: string
  ESV_API_KEY?: string
  WELCOME_DRIP_SENDS_ENABLED?: string
}

export function databaseUrl(env: Env): string | null {
  const fromHyperdrive = env.HYPERDRIVE?.connectionString?.trim() ?? ''
  if (fromHyperdrive && !fromHyperdrive.includes('00000000000000000000000000000000')) {
    return fromHyperdrive
  }
  const fallback = env.DATABASE_URL?.trim() ?? ''
  return fallback || fromHyperdrive || null
}

export function welcomeDripSendsEnabled(env: Env): boolean {
  const raw = env.WELCOME_DRIP_SENDS_ENABLED?.trim().toLowerCase()
  return raw === 'true' || raw === 'on' || raw === '1'
}
