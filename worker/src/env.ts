export interface HyperdriveBinding {
  connectionString: string
}

export interface Env {
  ASSETS?: Fetcher
  HYPERDRIVE?: HyperdriveBinding
  DATABASE_URL?: string
  /** Worker AI. Read by name only — do not put a value in wrangler.jsonc. */
  AI_GATEWAY_API_KEY?: string
  AI_GATEWAY_ZDR?: string
  AI_GATEWAY_ZDR_PROVIDERS?: string
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

const HYPERDRIVE_PLACEHOLDERS = [
  'HYPERDRIVE_ID_PLACEHOLDER',
  '00000000000000000000000000000000',
] as const

function isPlaceholderHyperdrive(connectionString: string): boolean {
  return HYPERDRIVE_PLACEHOLDERS.some((token) => connectionString.includes(token))
}

export function databaseUrl(env: Env): string | null {
  const bound = env.HYPERDRIVE?.connectionString
  const fromHyperdrive = bound?.trim() ?? ''
  // Prefer the Hyperdrive binding when it is a real connection string.
  // Preview / local / a still-unfilled placeholder fall back to DATABASE_URL.
  // Return the exact binding string so TLS can identity-match it.
  if (bound && fromHyperdrive && !isPlaceholderHyperdrive(fromHyperdrive)) {
    return bound
  }
  const fallback = env.DATABASE_URL?.trim() ?? ''
  return fallback || fromHyperdrive || null
}

export function welcomeDripSendsEnabled(env: Env): boolean {
  const raw = env.WELCOME_DRIP_SENDS_ENABLED?.trim().toLowerCase()
  return raw === 'true' || raw === 'on' || raw === '1'
}
