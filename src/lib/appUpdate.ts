// Shared desktop auto-update store (Tauri only).
//
// One module-level singleton drives both the background poll (surfaced by the
// UpdateToast) and the manual "Check for updates" button in Settings → About,
// so they never disagree about state. No-ops in the browser build.

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

function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const IDLE: UpdateState = { status: 'idle', version: null, error: null, notes: null }
let state: UpdateState = IDLE
const listeners = new Set<() => void>()
let relaunchFn: (() => Promise<void>) | null = null
let inFlight = false
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
 * calls no-op while one is in flight or an update is already staged.
 */
export async function checkForUpdate(manual = false): Promise<void> {
  if (!isDesktop() || inFlight || staged) return
  inFlight = true
  if (manual) set({ status: 'checking', version: null, error: null, notes: null })
  try {
    await runCheck(manual)
  } finally {
    inFlight = false
  }
}

// One check attempt, with a single automatic retry on transient failures —
// network blips and brief GitHub hiccups are common and shouldn't read as a
// dead end (which is what bit us: a successful poll moments later proved the
// endpoint was fine).
async function runCheck(manual: boolean, attempt = 1): Promise<void> {
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()

    if (!update) {
      if (manual) setTransient({ status: 'up-to-date', version: null, error: null, notes: null })
      else if (state.status !== 'ready') set(IDLE)
      return
    }

    // `update.body` is the human-readable note from latest.json (generated in CI
    // from the commits since the last release). May be empty for older builds.
    const notes = update.body?.trim() || null
    set({ status: 'downloading', version: update.version, error: null, notes })
    await update.downloadAndInstall()

    const { relaunch } = await import('@tauri-apps/plugin-process')
    relaunchFn = relaunch
    staged = true
    set({ status: 'ready', version: update.version, error: null, notes })
  } catch (err) {
    console.error(`[updater] attempt ${attempt} failed`, err)
    if (attempt < 2) {
      // brief backoff, then one retry
      await new Promise((r) => window.setTimeout(r, 1200))
      return runCheck(manual, attempt + 1)
    }
    const msg = err instanceof Error ? err.message : String(err)
    if (manual) setTransient({ status: 'error', version: null, error: msg, notes: null })
    else if (state.status !== 'ready') set(IDLE)
  }
}

/** Relaunch into the staged update. No-op until one is ready. */
export async function restartForUpdate(): Promise<void> {
  if (relaunchFn) await relaunchFn()
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
