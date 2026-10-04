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
  model: () => process.env.OPENAI_MODEL || 'gpt-6-luna',
  // AI Gateway ZDR (api/_lib/aiClient.ts). Default OFF — only 'on' / 'true'
  // (any case) change the client. Anything else, including unset, is identical
  // to today: direct OpenAI, unprefixed models, no providerOptions.
  aiGatewayZdr: () => {
    const v = (process.env.AI_GATEWAY_ZDR ?? '').trim().toLowerCase()
    return v === 'on' || v === 'true'
  },
  // Comma list of gateway provider slugs passed as providerOptions.gateway.only.
  // Default `azure` — Azure is full ZDR (OpenAI's listing is "ZDR with safety
  // retention"), and text-embedding-3-small is ZDR only on Azure.
  aiGatewayZdrProviders: () => {
    const raw = process.env.AI_GATEWAY_ZDR_PROVIDERS ?? 'azure'
    const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean)
    return parsed.length > 0 ? parsed : ['azure']
  },
  // Optional override for local / synthetic tests. When set it wins over OIDC.
  // Do not set this in production — preview/prod use getVercelOidcToken().
  aiGatewayApiKey: () => process.env.AI_GATEWAY_API_KEY || null,
  // Guards GET/POST /api/zdr-selftest. Unset → the route 404s.
  zdrSelftestToken: () => process.env.ZDR_SELFTEST_TOKEN || null,
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
  // Gather (api/_lib/gather.ts, docs/GATHER.md). Default ON (2026-10-04, D-035):
  // the gate reads every entry, so a prayer that never names God still reaches
  // the Altar. `GATHER_MODE=cue` puts the old regex prefilter back — the escape
  // hatch if the gate's cost or precision turns out wrong. Unknown values mean gate.
  gatherMode: (): 'cue' | 'gate' => {
    const v = (process.env.GATHER_MODE ?? '').trim().toLowerCase()
    return v === 'cue' ? 'cue' : 'gate'
  },
  // The gather engine (docs/GATHER.md §Engine, migration 20260930130000). Default
  // OFF: merging must not change who reads an entry or when. `on` hands harvest,
  // concordance and embedding to the per-owner `gather` job — driven by "the
  // words changed and the writer stopped" — and takes them off the daily cron.
  // Needs the migration applied first; unknown values mean off.
  gatherEngine: (): boolean => (process.env.GATHER_ENGINE ?? '').trim().toLowerCase() === 'on',
  // The stored entry read (api/_lib/entryRead.ts, migration 20261004120000,
  // D-035). Default OFF until the dry run (scripts/gather-read-dry.ts) has priced
  // the backfill. `on` makes the gather engine read each page for emotion,
  // desire, story, learning and change and store it in entry_reads — and queues
  // every already-gathered entry for that read once. Needs GATHER_ENGINE=on.
  gatherRead: (): boolean => (process.env.GATHER_READ ?? '').trim().toLowerCase() === 'on',
  // Minutes an entry must sit untouched before the engine reads it.
  gatherSettleMinutes: (): number => {
    const raw = (process.env.GATHER_SETTLE_MINUTES ?? '').trim()
    const n = Number(raw)
    return raw !== '' && Number.isFinite(n) && n >= 0 ? n : 30
  },
  // The emotion definitions the entry read uses. Default tight-denial (D-035):
  // the stored read is what Ascent shows, so it uses the stricter definitions
  // and the denied-first field. `GATHER_SENTIMENT=v2` restores the older prompt.
  gatherSentiment: (): 'v2' | 'tight-denial' => {
    const v = (process.env.GATHER_SENTIMENT ?? '').trim().toLowerCase()
    return v === 'v2' ? 'v2' : 'tight-denial'
  },
  // Welcome drip (api/_lib/welcomeDrip.ts). Default OFF — merging the PR must
  // not start mailing. Enroll still writes; only Resend sends are gated.
  welcomeDripSendsEnabled: () =>
    (process.env.WELCOME_DRIP_SENDS_ENABLED ?? 'false').toLowerCase() === 'true',
  welcomeDripFrom: () =>
    process.env.WELCOME_DRIP_FROM || 'The Dayspring team <hello@usedayspring.app>',

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
  // ── Growth instrumentation (api/_lib/growthEvents.ts) ──────────────────────
  // Same PostHog project the client bundle uses (src/lib/env.ts) — read directly
  // from process.env since Vercel serverless functions see every project env
  // var regardless of the VITE_ prefix, which only means something to Vite's
  // client bundler. Unset → growthEvents.ts skips the PostHog send.
  posthogKey: () => process.env.VITE_POSTHOG_KEY || null,
  posthogHost: () => process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  // Meta Conversions API — server-side StartTrial/Purchase/Cancel, matched to
  // the browser Pixel on the marketing site by pixel id. The pixel id itself
  // isn't secret (it's PUBLIC_META_PIXEL_ID in site/, a separate Vercel
  // project), but this project needs its own copy since the two projects don't
  // share env vars. The access token is a real secret: Events Manager →
  // Settings → Conversions API → Generate access token. Unset (either one) →
  // growthEvents.ts skips the Meta send.
  metaPixelId: () => process.env.META_PIXEL_ID || null,
  metaCapiAccessToken: () => process.env.META_CAPI_ACCESS_TOKEN || null,
}
