// How to react to a failed outbox push. Pure — no IO — so every branch is
// unit-testable without a server.
//
// The distinction that matters is "can this op ever succeed?". The flush used to
// stop on the first error of any kind, which meant one permanently-rejected write
// (an RLS change, a constraint violation, an oversized row) blocked every later
// write behind it forever, while the badge quietly read "Offline" on a device
// that was plainly online. Nothing recovered it short of clearing site data.
//
// Shapes this has to read, confirmed against @supabase/postgrest-js 2.x:
//   • network failure → { message: 'TypeError: Failed to fetch', code: '' }
//     (the response's status 0 is dropped by the time callers rethrow `error`)
//   • HTTP error      → the parsed PostgREST body { message, details, hint, code }
//     where `code` is a SQLSTATE ('23505') or a PostgREST code ('PGRST301')
//   • storage errors  → carry a numeric `status` / `statusCode`

export type SyncFailure =
  /** No response at all — the request never reached the server. Retry costs nothing. */
  | 'offline'
  /** Reached the server, which couldn't serve it *yet*. Worth retrying, but count it. */
  | 'transient'
  /** The server refused it and always will. Retrying forever would wedge the queue. */
  | 'permanent'

/** SQLSTATE classes and PostgREST codes that describe a passing condition. */
const TRANSIENT_CODES = new Set([
  'PGRST301', // JWT expired — auth-js refreshes and the next flush succeeds
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '53300', // too_many_connections
  '53400', // configuration_limit_exceeded
  '57014', // query_canceled — statement timeout
  '58030', // io_error
])

// Safari/WebKit says "Load failed", Firefox "NetworkError when attempting to
// fetch resource", Chrome "Failed to fetch". iOS ships WebKit, so the first one
// is not optional.
const OFFLINE_MESSAGE_RE =
  /failed to fetch|load failed|network\s?error|network request failed|fetcherror|err_internet_disconnected|err_network/i

function field(e: unknown, key: string): unknown {
  return typeof e === 'object' && e !== null ? (e as Record<string, unknown>)[key] : undefined
}

function stringField(e: unknown, key: string): string {
  const v = field(e, key)
  return typeof v === 'string' ? v : ''
}

function statusOf(e: unknown): number | null {
  for (const key of ['status', 'statusCode', 'originalStatus']) {
    const v = field(e, key)
    if (typeof v === 'number' && Number.isFinite(v)) return v
    // Storage sometimes stringifies it.
    if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v)
  }
  return null
}

function classifyStatus(status: number): SyncFailure {
  if (status === 0) return 'offline'
  if (status === 408 || status === 429 || status >= 500) return 'transient'
  // A token caught mid-refresh reads as 401/403. Retry it, but count the attempt
  // so a genuinely revoked grant quarantines instead of blocking the queue.
  if (status === 401 || status === 403) return 'transient'
  if (status >= 400) return 'permanent'
  return 'transient'
}

/**
 * Decide what a failed push means for the outbox. Unknown failures resolve to
 * `transient`: retrying a few times and then quarantining is recoverable, whereas
 * quarantining on a guess throws away a write the user made.
 */
export function classifySyncError(e: unknown): SyncFailure {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'

  const status = statusOf(e)
  if (status !== null) return classifyStatus(status)

  const code = stringField(e, 'code')
  if (code) {
    if (TRANSIENT_CODES.has(code)) return 'transient'
    // Connection exception class — the server went away mid-request.
    if (code.startsWith('08')) return 'transient'
    return 'permanent'
  }

  const message = `${stringField(e, 'message')} ${stringField(e, 'name')}`
  if (OFFLINE_MESSAGE_RE.test(message)) return 'offline'
  if (/aborterror|timeout/i.test(message)) return 'transient'
  return 'transient'
}

/** Attempts allowed before an op is quarantined and stops consuming retries. */
export const MAX_SYNC_ATTEMPTS = 6

/** A one-line reason to persist alongside a failed op, for support triage. */
export function describeSyncError(e: unknown): string {
  const code = stringField(e, 'code')
  const message = stringField(e, 'message') || String(e)
  return (code ? `[${code}] ${message}` : message).slice(0, 300)
}
