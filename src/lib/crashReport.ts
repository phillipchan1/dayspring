import { isTauri } from './platform'
import { supabase } from './supabase'
import { apiUrl } from './api'

// ---------------------------------------------------------------------------
// Breadcrumbs — a rolling ring of the last N user actions, captured at key
// interaction points. When a crash occurs the ring is snapshotted and attached
// to the report so you can see "what happened right before it broke" without
// asking anyone.
// ---------------------------------------------------------------------------

export interface Breadcrumb {
  /** Coarse category: navigation, command, network, settings, error */
  category: string
  /** Human-readable label: "opened altar", "slash:scripture", "went offline" */
  label: string
  /** ISO timestamp */
  ts: string
}

const MAX_CRUMBS = 20
const ring: Breadcrumb[] = []

export function addBreadcrumb(category: string, label: string): void {
  if (ring.length >= MAX_CRUMBS) ring.shift()
  ring.push({ category, label, ts: new Date().toISOString() })
}

export function getBreadcrumbs(): Breadcrumb[] {
  return ring.slice() // shallow copy
}

// ---------------------------------------------------------------------------
// Crash reports — fire-and-forget through the existing /api/feedback endpoint,
// same Supabase table, type = 'crash'. No new infra required.
// ---------------------------------------------------------------------------

export interface CrashPayload {
  error: string
  componentStack?: string | undefined
  surface?: string | undefined
  breadcrumbs: Breadcrumb[]
  url: string
  userAgent: string
  platform: 'desktop' | 'web'
  timestamp: string
}

/**
 * Best-effort crash report. Swallows its own errors — we never want crash
 * reporting to itself crash the app.
 */
export function reportCrash(payload: CrashPayload): void {
  try {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      void fetch(apiUrl('/api/feedback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: 'crash',
          message: `[crash] ${payload.error}`,
          metadata: payload,
        }),
      }).catch(() => {
        // Last resort: at least get it in the console.
        // eslint-disable-next-line no-console
        console.error('[crashReport] failed to submit', payload)
      })
    })
  } catch {
    // eslint-disable-next-line no-console
    console.error('[crashReport] failed to build report', payload)
  }
}

/**
 * Build a CrashPayload from the pieces React's error boundary gives us.
 */
export function buildCrashPayload(
  error: Error,
  componentStack?: string,
  surface?: string,
): CrashPayload {
  return {
    error: `${error.name}: ${error.message}`,
    componentStack: componentStack ?? undefined,
    surface,
    breadcrumbs: getBreadcrumbs(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    platform: isTauri() ? 'desktop' : 'web',
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Global (non-React) error handlers — catches unhandled promise rejections and
// stray throws that React's componentDidCatch doesn't see.
// ---------------------------------------------------------------------------

export function installGlobalHandlers(): void {
  // Network state breadcrumbs — offline/online transitions are a top correlate
  // of crashes (stale data, failed fetches, race conditions).
  window.addEventListener('offline', () => addBreadcrumb('network', 'went offline'))
  window.addEventListener('online', () => addBreadcrumb('network', 'came online'))

  window.addEventListener('error', (event) => {
    if (!event.error) return
    reportCrash(buildCrashPayload(event.error instanceof Error ? event.error : new Error(String(event.error))))
  })

  window.addEventListener('unhandledrejection', (event) => {
    const err =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason))
    reportCrash(buildCrashPayload(err))
  })
}
