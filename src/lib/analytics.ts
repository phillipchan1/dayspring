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

type ReturnSurface = 'reflections' | 'scripture' | 'altar'
import type { SlashCommandId } from '@/editor/slashDetect'

type SlashCmd = SlashCommandId

/** The complete vocabulary. Props must stay enum/number/boolean — see above. */
interface EventProps {
  /**
   * The app launched — desktop, web, or the mobile shell. Fired once per real
   * bootstrap (src/main.tsx), not per component remount, so it stays a clean
   * D1/D7 retention signal regardless of auth or subscription state.
   */
  app_open: undefined
  /**
   * This device's first-ever journal entry. One-shot per device (see
   * lib/firstEntry.ts) — the same "first on this device" semantics as
   * `surface_opened`'s `first` flag. Joined against trial start on the
   * Growth Pulse dashboard for the Quality signal: trial + first entry ≤24h.
   */
  first_entry_created: undefined
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
