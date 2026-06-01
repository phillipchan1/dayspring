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
}

const POLL_MS = 30 * 60 * 1000 // background re-check every 30 min while open
const TRANSIENT_MS = 4000 // how long "up to date"/"error" lingers before idling

function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

let state: UpdateState = { status: 'idle', version: null }
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
    if (state.status === next.status) set({ status: 'idle', version: null })
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
  if (manual) set({ status: 'checking', version: null })
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()

    if (!update) {
      if (manual) setTransient({ status: 'up-to-date', version: null })
      else if (state.status !== 'ready') set({ status: 'idle', version: null })
      return
    }

    set({ status: 'downloading', version: update.version })
    await update.downloadAndInstall()

    const { relaunch } = await import('@tauri-apps/plugin-process')
    relaunchFn = relaunch
    staged = true
    set({ status: 'ready', version: update.version })
  } catch (err) {
    console.error('[updater] check/install failed', err)
    if (manual) setTransient({ status: 'error', version: null })
    else if (state.status !== 'ready') set({ status: 'idle', version: null })
  } finally {
    inFlight = false
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
