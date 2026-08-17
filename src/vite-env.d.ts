/// <reference types="vite/client" />

/** Injected by Vite's `define` from package.json — see vite.config.ts. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_RELEASE_CHANNEL?: string
  readonly VITE_APPLE_IAP_MONTHLY_PRODUCT_ID?: string
  readonly VITE_APPLE_IAP_ANNUAL_PRODUCT_ID?: string
  readonly VITE_ONBOARDING_REQUIRE_CARD?: string
  readonly VITE_BETA_FEEDBACK_ENABLED?: string
  /** Set to 'false' to disable the optional app lock entirely. Default on. */
  readonly VITE_FF_APP_LOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
