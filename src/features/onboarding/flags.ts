// Onboarding trial model — single switch (mirror of the server env var
// ONBOARDING_REQUIRE_CARD in api/_lib/env.ts).
//
//  • false (recommended, default): app-managed reverse trial. On first sign-in
//    the trial is granted directly in Supabase (no Stripe, no card) and the whole
//    welcome + import flow runs inside it, gating nothing.
//  • true: card-first. A "Start your 14-day free trial" Checkout step is inserted
//    between OAuth and Welcome; the flow is entered only on return.
//
// Flipping this constant is the only change required to switch models on the
// client. Keep it in sync with the server env var.
export const ONBOARDING_REQUIRE_CARD =
  import.meta.env.VITE_ONBOARDING_REQUIRE_CARD === 'true'
