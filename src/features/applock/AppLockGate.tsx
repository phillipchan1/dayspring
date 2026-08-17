// The gate. Nothing of the journal renders until this is satisfied.
//
// It renders the lock screen INSTEAD of its children, not layered over them —
// so `JournalScreen` never mounts, never opens IndexedDB, and never puts a
// sentence of anyone's writing into the DOM while the lock is up. An overlay
// would have looked identical and been a lie.
//
// Two covers, not one:
//
//   VEIL   an opaque sheet whenever the app isn't frontmost. No PIN to clear
//          it; stepping away and back inside the grace period just dismisses
//          it. This is what keeps entry text out of the macOS window preview
//          and off the iOS app-switcher card, and it's why "after 5 minutes"
//          doesn't mean "readable in the app switcher for 5 minutes".
//
//   LOCK   the veil plus the PIN screen. Cold launch, or a return after the
//          grace period has run out.
//
// The veil is layered over the children (they're already mounted and already
// hold content — that's the whole reason it exists), while the lock replaces
// them outright.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { APP_LOCK_ENABLED } from './flags'
import { LockScreen } from './LockScreen'
import { setPrivacyScreen } from './privacyScreen'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { shouldLock } from '@/lib/appLockPolicy'
import { endExternalTrip, isExternalTripPending } from '@/lib/appLockSuppress'
import {
  consumeResetIfRequested,
  getAppLock,
  hasResetMarker,
  lockState,
  readMirror,
  writeMirror,
} from '@/lib/appLockStore'

/** The lock this account has, as far as we know right now. `undefined` = we
 *  don't know yet; `null` = it has none. Read from the shared store so that
 *  changing the PIN in Settings takes effect on the very next lock rather than
 *  the next relaunch. */
function useLockConfig() {
  return useSyncExternalStore(lockState.subscribe, lockState.get, lockState.get)
}

export function AppLockGate({ ownerId, children }: { ownerId: string; children: ReactNode }) {
  // The first synchronous read, done before the first paint. A cold launch with
  // a known lock has to come up locked in the very first render, or there is a
  // frame where the journal is on screen — which is the whole thing we promised
  // wouldn't happen. Ref-guarded because render can run twice under StrictMode.
  const seeded = useRef(false)
  if (!seeded.current) {
    seeded.current = true
    lockState.seed(APP_LOCK_ENABLED && !hasResetMarker(ownerId) ? readMirror(ownerId) : null)
  }

  const config = useLockConfig()
  const [locked, setLocked] = useState<boolean>(() => lockState.get() != null)
  const [veiled, setVeiled] = useState(false)

  const hiddenAtRef = useRef<number | null>(null)
  // Spent by the first evaluation. After that, only a real relaunch is a cold
  // start — remounting this component (a theme change, a re-render) is not.
  const coldStartRef = useRef(true)

  // ── Resolve whose lock this is ──────────────────────────────────────────
  //
  // Fast path: the mirror already answered in the initial state above, and the
  // network read below only reconciles. Slow path: no mirror (a new device, or
  // storage cleared), so we have to ask before rendering anything.
  useEffect(() => {
    if (!APP_LOCK_ENABLED) return
    let alive = true

    void (async () => {
      // Returning from a "Forgot your PIN?" reset: they proved the account by
      // signing in again, so drop the lock before deciding anything else.
      if (hasResetMarker(ownerId)) {
        try {
          await consumeResetIfRequested(ownerId)
          if (!alive) return
          lockState.set(null)
          setLocked(false)
          coldStartRef.current = false
          return
        } catch {
          // Couldn't reach the server to clear it. Leave the marker for the
          // next launch and fall through to the normal read — this is the
          // user's only way back in, so it must not be spent on a failed try.
        }
      }

      try {
        const remote = await getAppLock()
        if (!alive) return
        writeMirror(ownerId, remote)
        lockState.set(remote)
        // Only the first resolution can lock. A later reconcile must not slam
        // the door on someone who is already inside and typing.
        if (coldStartRef.current) {
          setLocked(remote != null)
          coldStartRef.current = false
        }
      } catch {
        if (!alive) return
        // Couldn't reach the account. If the mirror already told us there's a
        // lock, keep it — offline is not a way in. If we have no answer at all,
        // there is no verifier to check a PIN against, so open: inventing a
        // gate nobody can pass would lock the user out of their own journal.
        if (lockState.get() === undefined) lockState.set(null)
        coldStartRef.current = false
      }
    })()

    return () => {
      alive = false
    }
  }, [ownerId])

  // ── Foreground / background ─────────────────────────────────────────────
  //
  // `pagehide` is the event that actually fires in the iOS WKWebView (the same
  // reason useAutosave listens for it). `blur`/`focus` are the macOS and web
  // tell — ⌘-Tab doesn't change `visibilityState`, but it does put another app
  // in front of our window, which is exactly when the preview is taken.
  const onAway = useCallback(() => {
    if (hiddenAtRef.current === null) hiddenAtRef.current = Date.now()
    setVeiled(true)
  }, [])

  const onBack = useCallback(() => {
    const suppressed = isExternalTripPending()
    const decision = shouldLock({
      config: config ?? null,
      coldStart: false,
      hiddenAtMs: hiddenAtRef.current,
      nowMs: Date.now(),
      suppressed,
    })
    // Spend the mark whether or not it changed the outcome: one hand-off
    // excuses one return, never a standing exemption.
    endExternalTrip()
    hiddenAtRef.current = null
    setVeiled(false)
    if (decision) setLocked(true)
  }, [config])

  // Arm the native iOS cover alongside the JS veil, and disarm it when the lock
  // is turned off so a snapshot isn't blanked for someone with no lock at all.
  useEffect(() => {
    if (!APP_LOCK_ENABLED || config === undefined) return
    void setPrivacyScreen(config !== null)
  }, [config])

  useEffect(() => {
    // No lock configured — no listeners, no veil, nothing to pay for.
    if (!APP_LOCK_ENABLED || !config) return

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onAway()
      else onBack()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onAway)
    window.addEventListener('blur', onAway)
    window.addEventListener('focus', onBack)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onAway)
      window.removeEventListener('blur', onAway)
      window.removeEventListener('focus', onBack)
    }
  }, [config, onAway, onBack])

  if (!APP_LOCK_ENABLED) return <>{children}</>

  // No answer yet on a device with no mirror. A neutral shell, never content.
  if (config === undefined) {
    return (
      <div className="app-shell">
        <SurfaceLoader label="One moment…" />
      </div>
    )
  }

  if (locked && config) {
    return (
      <LockScreen
        config={config}
        ownerId={ownerId}
        onOpen={() => {
          hiddenAtRef.current = null
          setVeiled(false)
          setLocked(false)
        }}
      />
    )
  }

  return (
    <>
      {children}
      {veiled && <Veil />}
    </>
  )
}

/**
 * The opaque sheet. Solid `--bg` rather than a blur: a backdrop-filter still
 * shows the shape of the text underneath, and on a screenshot of an app
 * switcher card a blurred paragraph is still recognisably that paragraph.
 */
function Veil() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        // Above every surface, sheet and toast in the app.
        zIndex: 100_000,
      }}
    />
  )
}
