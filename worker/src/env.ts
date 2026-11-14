export interface HyperdriveBinding {
  connectionString: string
}

export interface Env {
  ASSETS?: Fetcher
  /** Service binding to this same Worker: the processing engine's self-kick (vercel/selfKick.ts). */
  SELF?: Fetcher
  HYPERDRIVE?: HyperdriveBinding
  DATABASE_URL?: string
  /** Worker AI. Read by name only — do not put a value in wrangler.jsonc. */
  AI_GATEWAY_API_KEY?: string
  AI_GATEWAY_ZDR?: string
  AI_GATEWAY_ZDR_PROVIDERS?: string
  OPENAI_MODEL?: string
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
  /** Apple Services ID. Public; not a secret. */
  APPLE_CLIENT_ID?: string
  APPLE_CLIENT_SECRET?: string
  /** iOS bundle id — Better Auth apple idToken audience. */
  APPLE_APP_BUNDLE_IDENTIFIER?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  /** wrangler / `.dev.vars` only: `local` allows a localhost auth fallback. */
  ENVIRONMENT?: string
  RESEND_API_KEY?: string
  RESEND_FROM?: string
  CRON_SECRET?: string
  ESV_API_KEY?: string
  WELCOME_DRIP_SENDS_ENABLED?: string
  /** Supabase Storage stays the photo bucket; service role mints signed URLs. */
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  /** Billing. Secrets only — never put these in wrangler `vars`. */
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_ANNUAL_PRICE_ID?: string
  STRIPE_MONTHLY_PRICE_ID?: string
  APPLE_BUNDLE_ID?: string
  APPLE_ISSUER_ID?: string
  APPLE_KEY_ID?: string
  APPLE_PRIVATE_KEY?: string
  APPLE_APP_APPLE_ID?: string
  APP_URL?: string
  ONBOARDING_REQUIRE_CARD?: string
  VITE_POSTHOG_KEY?: string
  VITE_POSTHOG_HOST?: string
  META_PIXEL_ID?: string
  META_CAPI_ACCESS_TOKEN?: string
  REVENUECAT_WEBHOOK_SECRET?: string
  /** Vercel-port routes (worker/src/vercel). The transcription key is read only in vercel/routes.ts. */
  GATHER_ENGINE?: string
  GATHER_MODE?: string
  /** `on` only in the switch step that turns off Vercel's remind / sync-resend / welcome-drip crons. */
  WORKER_MAIL_CRONS?: string
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
