// Server-only environment access. These vars are NOT VITE_-prefixed, so Vite
// never bundles them into the client. Read lazily so a missing var only fails
// the request that needs it (not module import).

function need(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required server env: ${name}`)
  return v
}

export const env = {
  supabaseUrl: () => need('SUPABASE_URL'),
  serviceRoleKey: () => need('SUPABASE_SERVICE_ROLE_KEY'),
  openaiKey: () => need('OPENAI_API_KEY'),
  model: () => process.env.OPENAI_MODEL || 'gpt-5.4-nano',
  cronSecret: () => need('CRON_SECRET'),
  appOwnerId: () => need('APP_OWNER_ID'),
  // Optional — if set, reminder notifications are sent via Resend.
  // If unset, the cron marks reminders fired but sends nothing.
  resendKey: () => process.env.RESEND_API_KEY ?? null,
  appUrl: () => process.env.APP_URL ?? 'https://dayspring-eosin.vercel.app',
}
