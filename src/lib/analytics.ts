// Anonymous usage events — counts of which doors get opened, never any words.
//
// The privacy guarantee is structural, not procedural: the event vocabulary is
// a closed union and every property is an enum, number, or boolean. There is no
// free-text field anywhere in this API, so entry content, prayers, references —
// anything the user wrote — CANNOT travel through it, even by accident. Keep it
// that way: a new event with a string payload is a design smell, not a quick fix.
//
// Everything is gated on the "Share anonymous usage" toggle (Settings → About).
// Events are dropped at the source when it's off — never buffered, never sent
// late. No vendor is wired yet: events log to the console in dev so the
// pipeline is testable, and `setAnalyticsTransport` is the seam where an
// Aptabase/PostHog client plugs in without touching any call site.

import { settingsStore } from './settings'
import type { PlatformKind } from './platform'
import type { VoiceId } from './voices'

type ReturnSurface = 'reflections' | 'scripture' | 'altar'
import type { SlashCommandId } from '@/editor/slashDetect'

type SlashCmd = SlashCommandId

/** The real step machine in src/features/onboarding/OnboardingFlow.tsx — the
 *  welcome carousel, the veteran/fresh-start fork, and the two paths out of
 *  it. Not a flat wizard: `import` has its own inner phase machine
 *  (ImportFlow.tsx) that these two events also cover. */
type OnboardingStep = 'tour' | 'fork' | 'import' | 'fresh'

/** Every sign-in method Dayspring offers (src/lib/auth.ts). No magic link. */
type AuthMethod = 'apple' | 'google' | 'email'

/** Word-count buckets for a saved entry. See lengthBucket() below — the only
 *  place the boundaries are allowed to live. */
type LengthBucket = 'empty' | '1_50' | '51_200' | '201_500' | '500_plus'

/** The three places a subscribe prompt actually renders (src/App.tsx):
 *  the full-screen picker, the trial-ended/past-due screen, and the
 *  persistent in-app nudge. */
type PaywallSurface = 'paywall' | 'locked' | 'trial_banner'

type Store = 'stripe' | 'apple'

/**
 * Why a checkout attempt didn't finish. Store-asymmetric on purpose:
 * Stripe's redirect-based Checkout never tells the client a user cancelled
 * (nothing reads `?checkout=cancelled`, so Stripe only ever reports
 * 'error') — 'cancelled' and 'unowned' are real, distinguishable outcomes on
 * the Apple path only (see src/lib/appleIap.ts). 'other' is a defensive
 * fallback for a thrown value that isn't even an Error.
 */
type CheckoutFailReason = 'cancelled' | 'error' | 'unowned' | 'other'

/** The real tab ids (src/lib/appHistory.ts) — there is no separate "account"
 *  tab; account actions live inside "about". */
type SettingsSection = 'appearance' | 'writing' | 'import' | 'shortcuts' | 'billing' | 'about'

/** The complete vocabulary. Props must stay enum/number/boolean — see above. */
interface EventProps {
  /**
   * The app launched — desktop, web, or the mobile shell. Fired once per real
   * bootstrap (src/main.tsx), not per component remount, so it stays a clean
   * D1/D7 retention signal regardless of auth or subscription state.
   */
  app_open: {
    platform: PlatformKind
    version_major: number
    version_minor: number
    version_patch: number
  }
  /**
   * This device's first-ever journal entry. One-shot per device (see
   * lib/firstEntry.ts) — the same "first on this device" semantics as
   * `surface_opened`'s `first` flag. Joined against trial start on the
   * Growth Pulse dashboard for the Quality signal: trial + first entry ≤24h.
   */
  first_entry_created: undefined
  /**
   * Fired alongside first_entry_created: how long from this device's first
   * known moment (main.tsx's first bootstrap) to that first entry. A device-
   * local proxy for "trial start" — there is no cheap, sync way to read the
   * account's real trial-start time from the offline-first repo layer that
   * fires first_entry_created (see lib/firstEntry.ts). Absent (not fired) if
   * the device-first-seen stamp was never written (private mode).
   */
  minutes_to_first_entry_bucket: { bucket: '0_5' | '5_30' | '30_1440' | '1440_plus' }
  /** A Return surface opened; `first` = never visited before on this device. */
  surface_opened: { surface: ReturnSurface; first: boolean }
  /** A slash command chosen (palette, accessory bar, or typed `/`). */
  slash_used: { cmd: SlashCmd }
  /** A ritual's prompts inserted into the entry. */
  ritual_begun: undefined
  /**
   * A ritual left, with how much of it got written.
   *
   * `ritual_begun` alone could not answer the only question that matters about
   * the library — whether a practice gets finished or abandoned — which left
   * MORNING_RITUALS_PLAN §10's own change-our-mind tests unrunnable. Counts
   * only: how many movements the block held, and how many carried words. No
   * practice name, because a name is a string and this vocabulary has none.
   */
  ritual_finished: { movements: number; answered: number }
  /** The "practices you have walked" surface opened, and how many it held. */
  ritual_threads_opened: { practices: number }
  /** A discovery ember lit for a never-visited surface. */
  ember_lit: { surface: ReturnSurface }
  /** A surface first opened while its ember was burning — the nudge worked. */
  ember_followed: { surface: ReturnSurface }
  /** A new item (verse, prayer) recorded as unseen on its Return surface. */
  surface_update_recorded: { surface: ReturnSurface }
  /** A surface's arrival line shown — either naming new items or introducing itself. */
  surface_arrival_shown: { surface: ReturnSurface; kind: 'updates' | 'discovery'; count: number }
  /** "See your Ascent →" clicked on the processing-complete banner. */
  processing_cta_clicked: undefined

  // ── Activation / onboarding ────────────────────────────────────────────────
  /** An onboarding step (or import phase) became visible. */
  onboarding_step_viewed: { step: OnboardingStep }
  /** An onboarding step was genuinely finished — moved on, not skipped. */
  onboarding_step_completed: { step: OnboardingStep }
  /** An onboarding step was explicitly skipped rather than finished. Only
   *  'tour' (Welcome's Skip button) and 'import' (the "skip ahead" wait
   *  screen) actually have a skip path today. */
  onboarding_skipped: { step: OnboardingStep }
  /** A sign-in completed — the moment `useSession` sees a real SIGNED_IN
   *  event, not a restored/refreshed session. */
  auth_completed: { method: AuthMethod }

  // ── Journal core loop ───────────────────────────────────────────────────────
  /** "New entry" — the one unambiguous "started composing" moment
   *  (src/features/journal/JournalScreen.tsx's handleNew). */
  entry_started: undefined
  /**
   * A successful autosave persist — the create AND every subsequent update,
   * by design (Phase B ships generously; roll up to "last per entry per
   * session" for a length distribution rather than treating every row as a
   * distinct save). `had_slash` is reconstructed from the body's own
   * structural markers (prayer/sense/scripture fences, the ritual comment)
   * and undercounts /emoji, which leaves no trace of its own — see
   * docs/GROWTH_PULSE.md.
   */
  entry_saved: { length_bucket: LengthBucket; had_ritual: boolean; had_slash: boolean }

  // ── Paywall / money friction ────────────────────────────────────────────────
  /** A subscribe surface rendered. */
  paywall_seen: { surface: PaywallSurface }
  /** A checkout attempt began (Stripe Checkout redirect, or a StoreKit sheet). */
  checkout_started: { store: Store }
  /** A checkout attempt did not finish. See `CheckoutFailReason`'s comment for
   *  which reasons are real on which store. */
  checkout_failed: { store: Store; reason: CheckoutFailReason }
  /** "Restore purchases" tapped — Apple-only; there is no Stripe equivalent. */
  restore_tapped: { store: 'apple' }
  /** Paid, but the Stripe webhook hasn't landed within ~30s (src/App.tsx). No
   *  Apple equivalent — that path awaits its own verify() call inline. */
  entitlement_stalled: undefined

  // ── Navigation / settings ───────────────────────────────────────────────────
  /** A Settings tab became visible — the initial open and every later switch. */
  settings_opened: { section: SettingsSection }
  /** A voice (palette + type pairing) was picked in the Theme tab. */
  theme_changed: { theme: VoiceId }
  /** The Stripe billing portal specifically — not Apple's subscription sheet
   *  or the App Store account page, which are managed at Apple, not us. */
  billing_portal_opened: undefined

  // ── Library ──────────────────────────────────────────────────────────────
  /** The Rituals Library (browse-to-begin) opened — distinct from
   *  `ritual_threads_opened`, which is "practices you have walked" (history). */
  practice_library_opened: { count: number }
}

/** The only place the entry_saved word-count boundaries are allowed to live. */
export function lengthBucket(words: number): LengthBucket {
  if (words <= 0) return 'empty'
  if (words <= 50) return '1_50'
  if (words <= 200) return '51_200'
  if (words <= 500) return '201_500'
  return '500_plus'
}

export type AnalyticsEvent = keyof EventProps

type Transport = (
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>,
) => void

let transport: Transport | null = null

/** Vendor seam — call once at startup with the Aptabase/PostHog adapter. */
export function setAnalyticsTransport(t: Transport | null) {
  transport = t
}

export function track<E extends AnalyticsEvent>(
  event: E,
  ...args: EventProps[E] extends undefined ? [] : [EventProps[E]]
): void {
  if (!settingsStore.get().shareUsage) return
  const props = args[0] as Record<string, string | number | boolean> | undefined
  if (import.meta.env.DEV) {
    console.debug('[usage]', event, props ?? '')
  }
  try {
    transport?.(event, props)
  } catch {
    // Analytics must never break the app.
  }
}
