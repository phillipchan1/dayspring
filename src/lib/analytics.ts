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
type SlashCmd = 'scripture' | 'pray' | 'sense' | 'ritual' | 'image'

/** The complete vocabulary. Props must stay enum/number/boolean — see above. */
interface EventProps {
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
