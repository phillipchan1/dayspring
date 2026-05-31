// Auto-update for the Tauri desktop build.
//
// The same `dist/` bundle is served on the web (Vercel) AND wrapped by Tauri,
// so this must no-op when running in a normal browser. We detect the desktop
// runtime via the Tauri internals global and only then dynamically import the
// plugins — keeping the Tauri code out of the web bundle's hot path.
export async function initAutoUpdate(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('__TAURI_INTERNALS__' in window)) return // plain browser, not the desktop app

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const { relaunch } = await import('@tauri-apps/plugin-process')

    const update = await check()
    if (!update) {
      console.log('[updater] up to date')
      return
    }

    console.log(
      `[updater] ${update.version} available (current ${update.currentVersion}) — downloading…`,
    )
    await update.downloadAndInstall()
    console.log('[updater] installed — relaunching')
    await relaunch()
  } catch (err) {
    // Never let an update failure break app startup.
    console.error('[updater] check/install failed', err)
  }
}
