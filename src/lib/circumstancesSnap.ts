// Silent create-time snap. Never blocks save. Never paints in the editor.
//
// Timezone is already on the row from createEntry. This asks the OS for a
// position (one permission, then silence) and fills place + weather through
// /api/circumstances/snap. Denied / unavailable / backdated → leave the row
// as timezone-only.

import { apiPost } from './api'
import { isDesktopTauri, isMobileTauri } from './platform'
import {
  isLocalToday,
  mergeCircumstances,
  roundCoord,
  type CircumstanceLocation,
  type CircumstanceWeather,
  type EntryCircumstances,
} from './circumstances'
import * as cache from './db'
import { updateEntryCircumstances } from './repo'
import { settingsStore } from './settings'

interface SnapResponse {
  location?: CircumstanceLocation
  weather?: CircumstanceWeather | null
}

export async function snapCircumstances(entryId: string): Promise<void> {
  const entry = await cache.cacheGet(entryId)
  if (!entry) return
  if (!isLocalToday(entry.created_at)) return
  if (entry.circumstances?.location?.label) return
  if (!settingsStore.get().rememberWhereYouWrite) return

  const pos = await readPosition()
  if (!pos) return

  const still = await cache.cacheGet(entryId)
  if (!still || !isLocalToday(still.created_at)) return

  let snapped: SnapResponse
  try {
    snapped = await apiPost<SnapResponse>('/api/circumstances/snap', {
      lat: roundCoord(pos.lat),
      lon: roundCoord(pos.lon),
      at: still.created_at,
    })
  } catch {
    return
  }

  const location = snapped.location
    ? {
        ...snapped.location,
        ...(pos.accuracy != null ? { accuracy_m: pos.accuracy } : {}),
      }
    : undefined
  if (!location && !snapped.weather) return

  const patch: EntryCircumstances = mergeCircumstances(still.circumstances, {
    timezone: still.circumstances?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    source: 'live',
    ...(location ? { location } : {}),
    ...(snapped.weather ? { weather: snapped.weather } : {}),
  })
  await updateEntryCircumstances(entryId, patch)
}

/**
 * Fill place (and historical weather) from a photo's GPS when the entry has
 * none yet — the path that still works when live location was denied.
 */
export async function seedCircumstancesFromExif(
  entryId: string,
  gps: { lat: number; lon: number },
  at?: string,
): Promise<void> {
  const entry = await cache.cacheGet(entryId)
  if (!entry) return
  if (entry.circumstances?.location?.label) return

  let snapped: SnapResponse = {}
  try {
    snapped = await apiPost<SnapResponse>('/api/circumstances/snap', {
      lat: roundCoord(gps.lat),
      lon: roundCoord(gps.lon),
      at: at ?? entry.created_at,
    })
  } catch {
    snapped = {
      location: { lat: roundCoord(gps.lat), lon: roundCoord(gps.lon), label: '' },
    }
  }

  const location = snapped.location
  if (!location && !snapped.weather) return
  await updateEntryCircumstances(entryId, {
    timezone: entry.circumstances?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    source: 'exif',
    ...(location ? { location } : {}),
    ...(snapped.weather ? { weather: snapped.weather } : {}),
  })
}

interface Fix {
  lat: number
  lon: number
  accuracy?: number
}

/**
 * ── Who is doing the asking ─────────────────────────────────────────────────
 *
 * `navigator.geolocation` is a page asking, so whoever puts the permission
 * dialog on screen labels it with the page's ORIGIN. On the web that origin is
 * the site, which is what people expect. Inside the Mac and iPhone apps the
 * page is served out of the app bundle, so the origin is `localhost` — and the
 * writer, who opened a journal, is asked whether "localhost" may know where
 * they are. That is not a wording problem. The operating system was never told
 * Dayspring wanted anything; the sentence we wrote for this exact moment (it is
 * in `src-tauri/Info.ios.plist`) is never the one shown.
 *
 * So in the native apps we do not ask as a page. `getCurrentPosition` below
 * goes through CoreLocation, which asks in the app's own name and reads that
 * sentence out. The web keeps the browser path, where the origin is the truth.
 *
 * `isMobileTauri()` and not `isTauri()` because the plugin is mobile-only — see
 * the note in `src-tauri/Cargo.toml`.
 *
 * The Mac asks CoreLocation too, through a command of its own
 * (`src-tauri/src/mac_location.rs`). It could not use the webview: a WKWebView
 * on macOS turns every geolocation request down unless its UI delegate says
 * otherwise, so for months every page written on the Mac was saved with its
 * hour and no place and no weather, and nothing ever prompted.
 */
async function readPosition(): Promise<Fix | null> {
  // No fallback. A native "no" — declined, or Location Services off — must end
  // it: falling through to the webview would put the `localhost` dialog in
  // front of someone who has already answered this question once.
  if (isMobileTauri()) return readPositionNatively()
  if (isDesktopTauri()) return readPositionOnMac()
  return readPositionFromWebview()
}

async function readPositionOnMac(): Promise<Fix | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const fix = await invoke<Fix | null>('mac_current_position')
    if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return null
    return fix
  } catch {
    // A build from before the command existed. The webview would only say no,
    // so there is nothing to fall back to.
    return null
  }
}

async function readPositionNatively(): Promise<Fix | null> {
  try {
    const geo = await import('@tauri-apps/plugin-geolocation')
    let status = await geo.checkPermissions()
    if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
      status = await geo.requestPermissions(['location'])
    }
    if (status.location !== 'granted') return null
    const pos = await geo.getCurrentPosition({
      // A page is a neighbourhood, not a pin — the coordinate is rounded to two
      // places before it ever leaves the device. Asking for GPS would cost
      // battery and a colder start to buy precision we immediately throw away.
      enableHighAccuracy: false,
      maximumAge: 5 * 60 * 1000,
      timeout: 8000,
    })
    const { latitude, longitude, accuracy } = pos.coords
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return {
      lat: latitude,
      lon: longitude,
      ...(Number.isFinite(accuracy) ? { accuracy } : {}),
    }
  } catch {
    // An older build of the app has no such plugin registered, and a page that
    // cannot say where it was written is the normal, quiet case. Fall through.
    return null
  }
}

function readPositionFromWebview(): Promise<Fix | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          ...(Number.isFinite(p.coords.accuracy) ? { accuracy: p.coords.accuracy } : {}),
        }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 8000 },
    )
  })
}
