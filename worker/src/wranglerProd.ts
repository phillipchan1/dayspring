export const PROD_ENV_NAME = 'production'
export const HYPERDRIVE_ID_PLACEHOLDER = 'HYPERDRIVE_ID_PLACEHOLDER'

/** Secret names. Must never appear in wrangler `vars` (use `wrangler secret put`). */
export const PROD_SECRET_NAMES = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'CRON_SECRET',
  'RESEND_API_KEY',
  'ESV_API_KEY',
  'AI_GATEWAY_API_KEY',
  'PGPASSWORD',
  'APPLE_CLIENT_SECRET',
  'GOOGLE_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_ANNUAL_PRICE_ID',
  'STRIPE_MONTHLY_PRICE_ID',
  'APPLE_ISSUER_ID',
  'APPLE_KEY_ID',
  'APPLE_PRIVATE_KEY',
  'META_CAPI_ACCESS_TOKEN',
  'REVENUECAT_WEBHOOK_SECRET',
] as const

const SECRET_NAME_SET = new Set<string>(PROD_SECRET_NAMES)

export type WranglerEnvBlock = {
  name?: string
  vars?: Record<string, string>
  hyperdrive?: Array<{ binding?: string; id?: string }>
}

export type WranglerFile = {
  name?: string
  vars?: Record<string, string>
  hyperdrive?: Array<{ binding?: string; id?: string }>
  env?: Record<string, WranglerEnvBlock>
}

/** JSONC with line comments, block comments, and trailing commas. */
export function parseJsonc(text: string): unknown {
  const withoutBlock = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const withoutLine = withoutBlock.replace(/(^|[^:])\/\/.*$/gm, '$1')
  const withoutTrailing = withoutLine.replace(/,(\s*[}\]])/g, '$1')
  return JSON.parse(withoutTrailing) as unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asWranglerFile(value: unknown): WranglerFile {
  if (!isRecord(value)) throw new Error('wrangler config is not an object')
  return value as WranglerFile
}

function mergedProdVars(config: WranglerFile): Record<string, string> {
  const prod = config.env?.[PROD_ENV_NAME]
  return { ...(config.vars ?? {}), ...(prod?.vars ?? {}) }
}

function looksLikeLoopbackValue(value: string): boolean {
  const lower = value.toLowerCase()
  if (lower.includes('localhost')) return true
  if (lower.includes('127.0.0.1') || lower.includes('[::1]') || lower.includes('0.0.0.0')) return true
  return false
}

/**
 * Problems in the production wrangler env. Empty array means the committed
 * production block is safe (placeholder Hyperdrive, no secrets in vars).
 */
export function productionEnvProblems(config: WranglerFile): string[] {
  const problems: string[] = []
  const prod = config.env?.[PROD_ENV_NAME]
  if (!prod) {
    problems.push(`missing env.${PROD_ENV_NAME}`)
    return problems
  }
  if (prod.name !== 'dayspring') {
    problems.push(`env.${PROD_ENV_NAME}.name must be "dayspring" (got ${JSON.stringify(prod.name)})`)
  }
  const hyperdrive = prod.hyperdrive ?? []
  if (hyperdrive.length !== 1 || hyperdrive[0]?.binding !== 'HYPERDRIVE') {
    problems.push(`env.${PROD_ENV_NAME} must bind HYPERDRIVE`)
  } else if (!hyperdrive[0]?.id) {
    problems.push(`env.${PROD_ENV_NAME} Hyperdrive id is empty`)
  }

  const vars = mergedProdVars(config)
  if (Object.prototype.hasOwnProperty.call(vars, 'ENVIRONMENT')) {
    problems.push('production vars must not set ENVIRONMENT')
  }
  for (const [key, value] of Object.entries(vars)) {
    if (SECRET_NAME_SET.has(key)) {
      problems.push(`secret ${key} must not be in vars`)
    }
    if (typeof value === 'string' && looksLikeLoopbackValue(value)) {
      problems.push(`production var ${key} contains localhost/loopback`)
    }
  }
  const authUrl = vars.BETTER_AUTH_URL?.trim() ?? ''
  if (authUrl) {
    let host = ''
    try {
      host = new URL(authUrl).hostname.toLowerCase()
    } catch {
      problems.push('production BETTER_AUTH_URL is not a URL')
    }
    if (host.endsWith('.workers.dev') || host === 'workers.dev') {
      problems.push('production BETTER_AUTH_URL must not be workers.dev')
    }
  }
  return problems
}
