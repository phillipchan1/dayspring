// Silent create-time snap. Never blocks save. Never paints in the editor.
//
// Timezone is already on the row from createEntry. This asks the OS for a
// position (one permission, then silence) and fills place + weather through
// /api/circumstances/snap. Denied / unavailable / backdated → leave the row
// as timezone-only.

import { apiPost } from './api'
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

function readPosition(): Promise<{ lat: number; lon: number; accuracy?: number } | null> {
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
