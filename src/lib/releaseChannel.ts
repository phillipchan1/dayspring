/**
 * Internal-only UI must be removed at build time from binaries submitted to
 * App Review. A TestFlight build promoted to the App Store is the same binary,
 * so distribution status cannot be used as a runtime gate.
 */
export function allowsInternalUi(releaseChannel: string | undefined): boolean {
  return releaseChannel === 'alpha'
}

export function isAppStoreRelease(releaseChannel: string | undefined): boolean {
  return releaseChannel === 'appstore'
}

export const ALLOWS_INTERNAL_UI = allowsInternalUi(import.meta.env.VITE_RELEASE_CHANNEL)
export const IS_APP_STORE_RELEASE = isAppStoreRelease(import.meta.env.VITE_RELEASE_CHANNEL)
