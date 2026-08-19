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
  // Speech-to-text model for voice dictation. gpt-4o-mini-transcribe is cheap
  // (~$0.003/min), accurate, and accepts a `prompt` for vocabulary biasing.
  transcribeModel: () => process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
  // Vision model for handwriting transcription (scanned journal pages). gpt-4o
  // reads cursive well using sentence context; a full model (not -mini) is worth
  // the cost here because misreads on a personal journal are expensive.
  visionModel: () => process.env.OPENAI_VISION_MODEL || 'gpt-4o',
  // Embedding model for the Altar threading + open-thread similarity sweep (1536d).
  embedModel: () => process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
  // Crossway ESV API token (api.esv.org). Used to resolve verbatim verse text.
  esvApiKey: () => need('ESV_API_KEY'),
  cronSecret: () => need('CRON_SECRET'),
  // Optional — if set, reminder notifications are sent via Resend and
  // account emails are synced into the Broadcast audience. If unset, the
  // remind cron marks reminders fired but sends nothing, and the audience
  // sync is a no-op.
  resendKey: () => process.env.RESEND_API_KEY ?? null,
  // Optional pin for the Broadcast segment that holds every account. When
  // unset, the sync finds or creates a segment named resendSegmentName().
  resendSegmentId: () => process.env.RESEND_SEGMENT_ID ?? null,
  resendSegmentName: () => process.env.RESEND_SEGMENT_NAME || 'Dayspring accounts',
  appUrl: () => process.env.APP_URL ?? 'https://dayspring-eosin.vercel.app',
  // Onboarding trial model. Default (false): app-managed reverse trial — the
  // trial is granted in-app at first sign-in (no Stripe object, no card), and
  // Stripe Checkout is only touched on conversion (→ 'active'). When true:
  // card-first — Checkout starts the trial (trial_period_days). Mirror of the
  // client constant ONBOARDING_REQUIRE_CARD in src/features/onboarding/flags.ts.
  onboardingRequireCard: () =>
    (process.env.ONBOARDING_REQUIRE_CARD ?? 'false').toLowerCase() === 'true',
  // Stripe Billing (set in Vercel project settings after creating Stripe account)
  stripeSecretKey: () => need('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: () => need('STRIPE_WEBHOOK_SECRET'),
  stripeAnnualPriceId: () => need('STRIPE_ANNUAL_PRICE_ID'),
  stripeMonthlyPriceId: () => need('STRIPE_MONTHLY_PRICE_ID'),
  // RevenueCat (Apple IAP lifecycle → profiles). Optional until the iOS build ships;
  // webhook rejects all requests when the secret is unset.
  revenuecatWebhookSecret: () => process.env.REVENUECAT_WEBHOOK_SECRET ?? null,
  revenuecatSecretApiKey: () => process.env.REVENUECAT_SECRET_API_KEY ?? null,
  // ── Apple In-App Purchase (iOS) ────────────────────────────────────────────
  // Credentials come from App Store Connect → Users and Access → Integrations →
  // In-App Purchase key. Nullable so importing this module never throws; the
  // Apple endpoints check and fail loudly with a named variable instead.
  // See docs/IOS.md for the full setup.
  appleBundleId: () => process.env.APPLE_BUNDLE_ID ?? 'com.phillipchan.dayspring',
  appleIssuerId: () => process.env.APPLE_ISSUER_ID ?? null,
  appleKeyId: () => process.env.APPLE_KEY_ID ?? null,
  // The .p8 file's contents. Vercel's UI preserves real newlines, but a value
  // pasted through a shell or CI often arrives with literal \n — accept both so
  // a subtly-wrong paste doesn't silently break signature generation.
  applePrivateKey: () => {
    const raw = process.env.APPLE_PRIVATE_KEY
    return raw ? raw.replace(/\\n/g, '\n') : null
  },
  // Numeric App Store app id (App Store Connect → App Information → Apple ID).
  // Required to verify PRODUCTION signatures; unused in sandbox.
  appleAppAppleId: () => {
    const raw = process.env.APPLE_APP_APPLE_ID
    if (!raw) return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  },
  // GitHub PAT (repo scope) for posting beta feedback as issues.
  githubToken: () => need('GITHUB_TOKEN'),
}
