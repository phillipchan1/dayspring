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
  // Embedding model for the Altar threading + open-thread similarity sweep (1536d).
  embedModel: () => process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
  // Crossway ESV API token (api.esv.org). Used to resolve verbatim verse text.
  esvApiKey: () => need('ESV_API_KEY'),
  cronSecret: () => need('CRON_SECRET'),
  appOwnerId: () => need('APP_OWNER_ID'),
  // Optional — if set, reminder notifications are sent via Resend.
  // If unset, the cron marks reminders fired but sends nothing.
  resendKey: () => process.env.RESEND_API_KEY ?? null,
  appUrl: () => process.env.APP_URL ?? 'https://dayspring-eosin.vercel.app',
  // Stripe Billing (set in Vercel project settings after creating Stripe account)
  stripeSecretKey: () => need('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: () => need('STRIPE_WEBHOOK_SECRET'),
  stripeAnnualPriceId: () => need('STRIPE_ANNUAL_PRICE_ID'),
  stripeMonthlyPriceId: () => need('STRIPE_MONTHLY_PRICE_ID'),
  // RevenueCat (iOS IAP — add when Capacitor/App Store launch)
  revenuecatWebhookSecret: () => process.env.REVENUECAT_WEBHOOK_SECRET ?? null,
}
