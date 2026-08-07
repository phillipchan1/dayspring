// What the client already knows about itself. Read at sign-in and sent to
// /api/profile/ensure, which stamps it onto the profile (see the demographics
// migration for the guardrail: this informs roadmap decisions, it never renders
// back to a user).
//
// Everything here is observed, never inferred, and none of it is a question the
// user has to answer. There is deliberately no free-text field — the same
// closed-vocabulary discipline analytics.ts uses, for the same reason: entry
// content must not be able to travel through this API even by accident.

import { isTauri, isIOSTauri, isMobileTauri } from './platform'

/** Distribution channel — how they got the app, not what they're holding. */
export type Platform = 'web' | 'desktop' | 'ios' | 'android'

/** Device shape — what they're holding, independent of channel. A phone
 *  browser is ('web', 'phone'); the native iPad app is ('ios', 'tablet'). */
export type FormFactor = 'phone' | 'tablet' | 'desktop'

export interface ClientContext {
  platform: Platform
  form_factor: FormFactor
  /** IANA zone, e.g. "America/Los_Angeles". */
  timezone?: string
  /** BCP-47, e.g. "en-US". */
  locale?: string
}

function detectPlatform(): Platform {
  if (!isTauri()) return 'web'
  if (isIOSTauri()) return 'ios'
  // isMobileTauri covers Android too; anything left is a real desktop build.
  if (isMobileTauri()) return 'android'
  return 'desktop'
}

// Longest screen edge, so an orientation change can't reclassify a device
// mid-session. screen (not window) because a resized browser window on a Mac
// must not read as a phone.
const PHONE_MAX_SHORT_EDGE = 500

function detectFormFactor(): FormFactor {
  if (typeof navigator === 'undefined' || typeof screen === 'undefined') return 'desktop'
  // iPadOS reports "Macintosh" in its UA, so touch points are the tell — the
  // same trick platform.ts uses for isIOSTauri.
  const touch = navigator.maxTouchPoints > 1
  if (!touch) return 'desktop'
  const shortEdge = Math.min(screen.width, screen.height)
  return shortEdge > 0 && shortEdge <= PHONE_MAX_SHORT_EDGE ? 'phone' : 'tablet'
}

function detectTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

function detectLocale(): string | undefined {
  try {
    return navigator.language || undefined
  } catch {
    return undefined
  }
}

/** Snapshot of this device. Cheap and synchronous — safe to call on mount. */
export function clientContext(): ClientContext {
  const timezone = detectTimezone()
  const locale = detectLocale()
  return {
    platform: detectPlatform(),
    form_factor: detectFormFactor(),
    ...(timezone ? { timezone } : {}),
    ...(locale ? { locale } : {}),
  }
}
