import { useCallback, useEffect, useRef, useState } from 'react'

// Background auto-update for the Tauri desktop app, Claude-Desktop style:
// poll periodically while the app is open, download+stage any new version
// silently, then surface a "restart to update" prompt instead of forcing a
// relaunch. No-ops in the browser build (web is updated by reloading the page).

export type UpdateState =
  | { status: 'idle' }
  | { status: 'downloading'; version: string }
  | { status: 'ready'; version: string }

const POLL_MS = 30 * 60 * 1000 // re-check every 30 minutes while open

function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function useAppUpdate() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' })
  const relaunchRef = useRef<(() => Promise<void>) | null>(null)
  const busyRef = useRef(false)
  const doneRef = useRef(false) // an update is staged & waiting for restart

  const restart = useCallback(async () => {
    if (relaunchRef.current) await relaunchRef.current()
  }, [])

  useEffect(() => {
    if (!isDesktop()) return
    let cancelled = false

    async function checkOnce() {
      // Skip if a check is in flight or an update is already staged.
      if (busyRef.current || doneRef.current) return
      busyRef.current = true
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (!update || cancelled) return

        // Download + install in the background; the app keeps running on the
        // current version until the user chooses to restart.
        setState({ status: 'downloading', version: update.version })
        await update.downloadAndInstall()
        if (cancelled) return

        const { relaunch } = await import('@tauri-apps/plugin-process')
        relaunchRef.current = relaunch
        doneRef.current = true
        setState({ status: 'ready', version: update.version })
      } catch (err) {
        // Never let an update failure disrupt the app; just try again next poll.
        if (!cancelled) console.error('[updater] check/install failed', err)
        if (!cancelled) setState({ status: 'idle' })
      } finally {
        busyRef.current = false
      }
    }

    void checkOnce()
    const timer = window.setInterval(() => void checkOnce(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return { state, restart }
}
