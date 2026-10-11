// Shared desktop auto-update store (Tauri only).
//
// One module-level singleton drives both the background poll (surfaced by the
// UpdateToast) and the manual "Check for updates" button in Settings → About,
// so they never disagree about state. No-ops in the browser build.

import { isDesktopTauri } from './platform'
import { flush } from './repo'

export type UpdateStatus =
  | 'idle' // nothing to report
  | 'checking' // a check is in flight (manual checks surface this)
  | 'up-to-date' // transient: last check found nothing new
  | 'downloading' // a newer version is being fetched + staged
  | 'ready' // staged and waiting for the user to restart
  | 'error' // last check/install failed

export interface UpdateState {
  status: UpdateStatus
  version: string | null // the available/staged version, when known
  error: string | null // short message for the 'error' status, when known
  notes: string | null // human-readable "what's new" (the updater's `body`/latest.json `notes`), when known
}

const POLL_MS = 30 * 60 * 1000 // background re-check every 30 min while open
const TRANSIENT_MS = 4000 // how long "up to date"/"error" lingers before idling

/*
 * Every request gets a deadline. The updater's requests have none by default,
 * so one that stalled — a check in flight as the Mac went to sleep, a
 * connection a captive network held open — never settled, `inFlight` stayed
 * true for the life of the process, and every later check (the 30-minute poll
 * AND the Settings button) returned at its first line without a word. The
 * alpha app sat on 1.0.508 while 1.0.509 and 1.0.510 were published, and
 * "Check for updates" did nothing at all.
 */
const CHECK_TIMEOUT_MS = 30_000
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000
/** A check (not a download) still running after this is stuck, and a new one may start. */
const STUCK_MS = 2 * CHECK_TIMEOUT_MS + 5_000

function isDesktop(): boolean {
  // Desktop Tauri only — the updater plugin isn't registered on iOS/Android
  // (see src-tauri/src/lib.rs), so a check there can only ever fail.
  return isDesktopTauri()
}

const IDLE: UpdateState = { status: 'idle', version: null, error: null, notes: null }
let state: UpdateState = IDLE
const listeners = new Set<() => void>()
let relaunchFn: (() => Promise<void>) | null = null
let inFlight = false
let inFlightSince = 0
/** Which check is current — a stuck one that settles late must not write over a newer one. */
let run = 0
let staged = false // an update is downloaded and waiting for restart
let pollStarted = false
let transientTimer: number | undefined

function emit() {
  for (const l of listeners) l()
}

function set(next: UpdateState) {
  state = next
  emit()
}

function setTransient(next: UpdateState) {
  set(next)
  window.clearTimeout(transientTimer)
  transientTimer = window.setTimeout(() => {
    // Only clear if nothing more important happened since.
    if (state.status === next.status) set(IDLE)
  }, TRANSIENT_MS)
}

/**
 * Run one update check. `manual` surfaces "checking" / "up to date" feedback
 * that the silent background poll suppresses. Safe to call concurrently — extra
 * calls join the one in flight (a manual one says so) or no-op once an update
 * is staged. A check that has run past `STUCK_MS` is abandoned for a new one.
 */
export async function checkForUpdate(manual = false): Promise<void> {
  if (!isDesktop() || staged) return
  if (inFlight) {
    const stuck = state.status !== 'downloading' && Date.now() - inFlightSince > STUCK_MS
    if (!stuck) {
      // Already looking — say so, rather than a button that does nothing.
      if (manual && state.status === 'idle') set({ status: 'checking', version: null, error: null, notes: null })
      return
    }
  }
  const mine = ++run
  inFlight = true
  inFlightSince = Date.now()
  if (manual) set({ status: 'checking', version: null, error: null, notes: null })
  try {
    await runCheck(manual, () => mine === run)
  } finally {
    if (mine === run) inFlight = false
  }
}

// One check attempt, with a single automatic retry on transient failures —
// network blips and brief GitHub hiccups are common and shouldn't read as a
// dead end (which is what bit us: a successful poll moments later proved the
// endpoint was fine).
async function runCheck(manual: boolean, live: () => boolean, attempt = 1): Promise<void> {
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    let update = await check({ timeout: CHECK_TIMEOUT_MS })
    if (!live()) return

    if (!update) {
      // `checking` here means someone pressed the button while this one ran.
      if (manual || state.status === 'checking') setTransient({ status: 'up-to-date', version: null, error: null, notes: null })
      else if (state.status !== 'ready') set(IDLE)
      return
    }

    // Download the update, then immediately re-check before notifying the user.
    // If we published a newer version while this download was in flight, grab
    // that one too — so the user only restarts once for the absolute latest.
    // Cap at 3 cascades to guard against pathological release loops.
    const MAX_CASCADE = 3
    let cascade = 0
    let lastVersion = update.version
    let lastNotes = update.body?.trim() || null

    while (update && cascade < MAX_CASCADE) {
      lastVersion = update.version
      lastNotes = update.body?.trim() || null
      set({ status: 'downloading', version: lastVersion, error: null, notes: lastNotes })
      await update.downloadAndInstall(undefined, { timeout: DOWNLOAD_TIMEOUT_MS })
      if (!live()) return
      cascade++
      update = cascade < MAX_CASCADE ? await check({ timeout: CHECK_TIMEOUT_MS }) : null
      if (!live()) return
    }

    const { relaunch } = await import('@tauri-apps/plugin-process')
    relaunchFn = relaunch
    staged = true
    set({ status: 'ready', version: lastVersion, error: null, notes: lastNotes })
  } catch (err) {
    if (!live()) return
    if (attempt < 2) {
      // brief backoff, then one retry
      await new Promise((r) => window.setTimeout(r, 1200))
      return runCheck(manual, live, attempt + 1)
    }
    const msg = err instanceof Error ? err.message : String(err)
    if (manual || state.status === 'checking') {
      // The user asked, so give feedback — but as one quiet warning, not a
      // per-attempt console.error. The UI shows a gentle, URL-free message.
      console.warn('[updater] check failed:', msg)
      setTransient({ status: 'error', version: null, error: msg, notes: null })
    } else if (state.status !== 'ready') {
      // Background poll: stay silent and idle. Offline / no published release yet
      // is expected and must not spam the console for someone whose app works.
      set(IDLE)
    }
  }
}

/** Relaunch into the staged update. No-op until one is ready. */
export async function restartForUpdate(): Promise<void> {
  if (!relaunchFn) return
  // Push whatever is queued before tearing the process down. The outbox is in
  // IndexedDB so nothing is lost either way, but a user who clicks "Restart to
  // update" and then opens the app on their phone should find their last
  // sentence already there.
  await flush().catch(() => {
    /* offline, or the server refused — the outbox keeps it for next launch */
  })
  await relaunchFn()
}

/** Start the background poll once (idempotent). Called when the first hook mounts. */
function ensurePolling() {
  if (pollStarted || !isDesktop()) return
  pollStarted = true
  void checkForUpdate(false)
  window.setInterval(() => void checkForUpdate(false), POLL_MS)
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  ensurePolling()
  return () => listeners.delete(listener)
}

export function getSnapshot(): UpdateState {
  return state
}
// build marker 1487c13

// acl-fix verification build
