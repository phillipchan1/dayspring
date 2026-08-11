// Anonymous usage events — counts of which doors get opened, never any words.
//
// ─── The privacy guarantee is structural, not procedural ─────────────────────
//
// The event vocabulary is a closed union and every property is an enum, number,
// or boolean. There is no free-text field anywhere in this API, so entry
// content, prayers, references, filenames, search queries — anything the user
// wrote — CANNOT travel through it, even by accident.
//
// That is enforced by the compiler, not by reviewer diligence. `Closed<V>`
// below collapses the open `string` type to `never`, so declaring
//
//     my_event: { note: string }
//
// makes the event impossible to call: its only argument has type `never`. A
// literal union (`'week' | 'month'`) passes through untouched. If you are here
// because tsc rejected a new event, that is the design working — the fix is an
// enum or a bucket, never a cast.
//
// Counts of user content are bucketed (see ./analytics/buckets), because a raw
// count is a fingerprint: "wrote 4,217 words on the 3rd" identifies a person in
// a way "wrote 1k–5k words" does not.
//
// ─── Consent ────────────────────────────────────────────────────────────────
//
// Everything is gated on Settings → About → the usage toggle (`shareUsage`).
// Events are dropped at the source when it's off — never buffered, never sent
// late. The vendor adapter (./analytics/posthog) additionally refuses to *load*
// the SDK at all while the toggle is off, because an initialised SDK writes
// storage and phones home on its own schedule regardless of what this file
// does. Gating `track()` alone would not be honest.
//
// ─── Identity ───────────────────────────────────────────────────────────────
//
// `identify()` uses the Supabase auth UUID, which is also what the server-side
// webhook events use as their distinct_id (see api/_lib/posthog.ts). That
// shared key is the entire reason this is worth building: it is what lets
// "which onboarding path did they choose" (client, day 0) join to "did they
// subscribe" (server, day 14) — D-003, and the measurement D-002 is waiting on.
//
// It also means this data is PSEUDONYMOUS, not anonymous. It is not linked to
// entry content and never can be, but it is linked to an account. Say that
// plainly in the privacy page rather than implying more than we deliver
// (Principle 7). See docs/product/MEASUREMENT.md.
//
// ─── The rule that outranks all of the above ────────────────────────────────
//
// Nothing measured here may ever be shown back to a user as a number.
// Principles 1 and 2 forbid it, D-006 leans permanently against it, and the
// moment a count in this file becomes a streak or a score the product has
// broken its own promise. This vocabulary exists so *we* can answer four
// questions; it is not a feature.

import { settingsStore } from './settings'
import type { EntrySource } from './types'
import type { CountBucket, YearsBucket } from './analytics/buckets'

/** Every value that may cross the boundary. Deliberately excludes bare `string`. */
export type PropValue = string | number | boolean

/**
 * The open `string` type collapses to `never`; a string *literal* union survives.
 *
 * This is the whole enforcement mechanism. `string extends V` is only true when
 * V is `string` itself (or `any`) — a union like `'a' | 'b'` does not satisfy
 * it, and neither does `number` or `boolean`.
 */
type Closed<V> = string extends V ? never : V

/** Applies Closed<> to every property of an event payload. */
type ClosedProps<P> = { [K in keyof P]: Closed<P[K]> }

type ReturnSurface = 'reflections' | 'scripture' | 'altar'
type SlashCmd = 'scripture' | 'pray' | 'sense' | 'ritual' | 'image' | 'emoji'

/**
 * Which side of the onboarding fork someone took (`OnboardingFlow.tsx`).
 *
 * `veteran` and `fresh` are the two cards. `veteran_mobile` is the third real
 * outcome the code already has and the fork's own copy pretends it doesn't: a
 * phone user who picks "I've been journaling for years" cannot import (a
 * multi-hundred-MB archive would take the WKWebView down), so they land on an
 * apology screen and enter empty. Folding them into `veteran` would report an
 * import path that never happened; folding them into `fresh` would hide that
 * we turned away exactly the persona D-014 says is the wedge.
 */
export type OnboardingPath = 'veteran' | 'fresh' | 'veteran_mobile'

/**
 * Where an archive came from — the detected parser, never a filename.
 *
 * Aliased to EntrySource rather than re-typed so the two cannot drift: adding a
 * parser widens both at once, and a value that isn't a real source stops
 * compiling here.
 */
export type ImportSource = EntrySource

/** Why an import ended without entries. Never carries the underlying error text. */
export type ImportFailure = 'unreadable' | 'empty' | 'unsupported' | 'aborted' | 'error'

/** The complete vocabulary. Props must stay enum/number/boolean — see above. */
interface EventProps {
  // ── Group A · the onboarding funnel (D-003) ───────────────────────────────
  // This group exists to settle one question: do people with archives choose
  // the import path, and do they convert better than fresh starts? That is
  // VISION Bet 3, PERSONAS P1's first prediction, and the input D-002 needs.

  /** The first-run arc began — the welcome carousel painted. */
  onboarding_started: undefined
  /** The veteran/fresh fork was shown. The funnel's denominator. */
  onboarding_fork_shown: undefined
  /** A fork card was chosen. THE D-003 event. */
  onboarding_path_chosen: { path: OnboardingPath }
  /** An archive was handed to the parser. */
  onboarding_import_started: { source: ImportSource }
  /** An archive parsed and its entries were written. Counts are bucketed. */
  onboarding_import_completed: {
    source: ImportSource
    entries: CountBucket
    years: YearsBucket
  }
  /** An import ended without entries. `reason` is an enum, never the error text. */
  onboarding_import_failed: { source: ImportSource; reason: ImportFailure }
  /** onboarded_at was stamped and the editor opened. The funnel's numerator. */
  onboarding_completed: { path: OnboardingPath }

  // ── Group B · the Return surfaces ─────────────────────────────────────────

  /** A Return surface opened; `first` = never visited before on this device. */
  surface_opened: { surface: ReturnSurface; first: boolean }
  /** A slash command chosen (palette, accessory bar, or typed `/`). */
  slash_used: { cmd: SlashCmd }
  /** A ritual's prompts inserted into the entry. */
  ritual_begun: undefined
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
}

export type AnalyticsEvent = keyof EventProps

/**
 * The events that carry free text. `never` while the vocabulary is clean.
 *
 * An event whose payload contains a bare `string` no longer satisfies
 * `ClosedProps<>` of itself — because that property has become `never` — so its
 * name falls through into this union.
 */
type FreeTextEvents<M> = {
  [E in keyof M]: M[E] extends undefined
    ? never
    : M[E] extends ClosedProps<M[E]>
      ? never
      : E
}[keyof M]

/**
 * Compile-time proof that no event carries free text.
 *
 * Add `{ query: string }` to an event above and this line stops compiling with
 * `Type '"your_event"' does not satisfy the constraint 'never'` — the offending
 * event named in the error. The call site would fail too (its argument becomes
 * uninhabitable), but this exists so the *declaration* fails first, where the
 * mistake actually is, rather than in whichever feature file happens to call it.
 *
 * If you are here to silence this: the answer is an enum, a boolean, or a
 * bucket from ./analytics/buckets. Never a cast. Principle 7 is the reason.
 */
declare function noEventMayCarryFreeText<_Offenders extends never>(): void
noEventMayCarryFreeText<FreeTextEvents<EventProps>>()

/**
 * The vendor seam.
 *
 * An object rather than a bare capture function because consent and identity
 * are part of the contract: a transport that can send events but cannot be told
 * to forget someone is not one we're allowed to install.
 */
export interface AnalyticsTransport {
  capture(event: AnalyticsEvent, props?: Record<string, PropValue>): void
  /** Bind subsequent events to an account. Called with the Supabase auth UUID. */
  identify(distinctId: string, personProps?: Record<string, PropValue>): void
  /** Attach durable facts to the person — see setPersonProperties(). */
  setPerson(props: Record<string, PropValue>): void
  /** Sign-out: drop the identity and start a fresh anonymous id. */
  reset(): void
}

let transport: AnalyticsTransport | null = null

/** Install the vendor adapter. Call once at startup; pass null to uninstall. */
export function setAnalyticsTransport(t: AnalyticsTransport | null) {
  transport = t
}

/** True when the user has opted in. The single gate every path below consults. */
export function usageSharingEnabled(): boolean {
  return settingsStore.get().shareUsage
}

export function track<E extends AnalyticsEvent>(
  event: E,
  ...args: EventProps[E] extends undefined ? [] : [ClosedProps<EventProps[E]>]
): void {
  if (!usageSharingEnabled()) return
  const props = args[0] as Record<string, PropValue> | undefined
  if (import.meta.env.DEV) {
    console.debug('[usage]', event, props ?? '')
  }
  try {
    transport?.capture(event, props)
  } catch {
    // Analytics must never break the app.
  }
}

/**
 * Bind events to an account.
 *
 * `distinctId` MUST be the Supabase auth UUID — the server-side webhook events
 * use the same value, and the join between them is the only reason per-branch
 * trial conversion (D-003) is answerable at all. Person properties are subject
 * to the same enum-only rule as events; there is no email, no name, no address.
 */
export function identify(distinctId: string, personProps?: Record<string, PropValue>): void {
  if (!usageSharingEnabled()) return
  try {
    transport?.identify(distinctId, personProps)
  } catch {
    // Analytics must never break the app.
  }
}

/**
 * Attach a durable fact to the person rather than to one event.
 *
 * This is what makes the funnel answerable across a boundary neither side can
 * cross alone. Which fork someone took is known only in the browser, on day 0;
 * whether they subscribed is known only to a Stripe webhook, on day 14. Neither
 * event can carry the other's fact, so the fork is written onto the person and
 * the conversion is grouped by it afterwards. That join is D-003.
 *
 * Same enum-only rule as events. Person properties are the easiest place in any
 * analytics stack to accidentally park an email address; don't.
 */
export function setPersonProperties(props: Record<string, PropValue>): void {
  if (!usageSharingEnabled()) return
  try {
    transport?.setPerson(props)
  } catch {
    // Analytics must never break the app.
  }
}

/** Sign-out. Unbinds the identity so the next user on this device is a stranger. */
export function resetIdentity(): void {
  try {
    transport?.reset()
  } catch {
    // Analytics must never break the app.
  }
}
