// Origin-independent session storage for Supabase auth.
//
// The bug this fixes: in the Tauri macOS webview the OAuth round-trip lands the
// completed session under a *different* webview origin than the one the app
// loads under (localStorage is origin-scoped), so on next launch the app can't
// see the session and shows the sign-in screen again.
//
// Fix: on desktop, persist the session via the Tauri store plugin — a single
// file keyed by the app identifier, not the webview origin — so every origin
// shares one durable session. On web we keep plain localStorage.
//
// Supabase accepts an async storage adapter (getItem/setItem/removeItem may
// return promises), which is exactly what the Tauri store gives us.

import type { SupabaseClientOptions } from '@supabase/supabase-js'

type GoTrueStorage = NonNullable<
  NonNullable<SupabaseClientOptions<string>['auth']>['storage']
>

function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Lazily-loaded singleton handle to the Tauri store file. Importing the plugin
// dynamically keeps it out of the web bundle's hot path.
let storePromise: Promise<{
  get: (k: string) => Promise<unknown>
  set: (k: string, v: unknown) => Promise<void>
  delete: (k: string) => Promise<boolean>
  save: () => Promise<void>
}> | null = null

async function getStore() {
  if (!storePromise) {
    // We call save() explicitly after each write, so no autoSave needed.
    storePromise = import('@tauri-apps/plugin-store').then(({ load }) => load('auth.json'))
  }
  return storePromise
}

const tauriStorage: GoTrueStorage = {
  async getItem(key) {
    try {
      const store = await getStore()
      const val = await store.get(key)
      return typeof val === 'string' ? val : null
    } catch (err) {
      console.error('[authStorage] getItem failed', err)
      return null
    }
  },
  async setItem(key, value) {
    try {
      const store = await getStore()
      await store.set(key, value)
      await store.save()
    } catch (err) {
      console.error('[authStorage] setItem failed', err)
    }
  },
  async removeItem(key) {
    try {
      const store = await getStore()
      await store.delete(key)
      await store.save()
    } catch (err) {
      console.error('[authStorage] removeItem failed', err)
    }
  },
}

/**
 * The storage adapter Supabase should use for the auth session. Tauri store on
 * desktop (origin-independent + durable), default localStorage on web (returned
 * as undefined so Supabase uses its own default).
 */
export const authStorage: GoTrueStorage | undefined = isDesktop() ? tauriStorage : undefined
