// POST /api/circumstances/snap
//
// Authenticated. The client sends rounded coordinates and an optional timestamp;
// we return a place label and the weather at that time. Coords leave the device
// here — Open-Meteo for weather, BigDataCloud for reverse geocode — and are
// never logged.

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { preflight, withCors } from '../_lib/cors.js'
import {
  placeLabel,
  roundCoord,
  weatherFromWmo,
  type CircumstanceLocation,
  type CircumstanceWeather,
} from '../../src/lib/circumstances.js'

const FETCH_MS = 8000

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return withCors(req, Response.json({ error: 'invalid json' }, { status: 400 }))
  }

  const lat = roundCoord(Number((body as { lat?: unknown })?.lat))
  const lon = roundCoord(Number((body as { lon?: unknown })?.lon))
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return withCors(req, Response.json({ error: 'lat and lon required' }, { status: 400 }))
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return withCors(req, Response.json({ error: 'coordinates out of range' }, { status: 400 }))
  }

  const atRaw = (body as { at?: unknown })?.at
  const at = typeof atRaw === 'string' && !Number.isNaN(Date.parse(atRaw)) ? new Date(atRaw) : new Date()

  const [location, weather] = await Promise.all([
    reverseGeocode(lat, lon),
    fetchWeather(lat, lon, at),
  ])

  return withCors(
    req,
    Response.json({
      location: location ?? { lat, lon, label: '' },
      weather,
    }),
  )
}

async function reverseGeocode(lat: number, lon: number): Promise<CircumstanceLocation | null> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${lat}&longitude=${lon}&localityLanguage=en`
  const json = await getJson(url)
  if (!json) return null
  const neighbourhood =
    str(json.locality) && str(json.city) && json.locality !== json.city ? str(json.locality) : ''
  const locality = str(json.city) || str(json.locality)
  const region = str(json.principalSubdivision)
  const country = str(json.countryName)
  const named = placeLabel({ neighbourhood, locality, region, country })
  if (!named) return { lat, lon, label: '' }
  return { lat, lon, ...named }
}

async function fetchWeather(
  lat: number,
  lon: number,
  at: Date,
): Promise<CircumstanceWeather | null> {
  const ageMs = Date.now() - at.getTime()
  const recent = ageMs > -6 * 3600_000 && ageMs < 5 * 86400_000
  try {
    if (recent) {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weather_code&timezone=auto`
      const json = await getJson(url)
      const current = json?.current as Record<string, unknown> | undefined
      const temp = num(current?.temperature_2m)
      const code = num(current?.weather_code)
      if (temp == null || code == null) return null
      const mapped = weatherFromWmo(code)
      return {
        temp_c: temp,
        condition: mapped.condition,
        summary: mapped.summary,
        observed_at: at.toISOString(),
        source: 'open-meteo',
      }
    }

    const day = at.toISOString().slice(0, 10)
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&start_date=${day}&end_date=${day}&hourly=temperature_2m,weather_code&timezone=auto`
    const json = await getJson(url)
    const hourly = json?.hourly as { time?: unknown; temperature_2m?: unknown; weather_code?: unknown } | undefined
    const times = Array.isArray(hourly?.time) ? hourly.time : []
    const temps = Array.isArray(hourly?.temperature_2m) ? hourly.temperature_2m : []
    const codes = Array.isArray(hourly?.weather_code) ? hourly.weather_code : []
    if (times.length === 0) return null
    const target = at.toISOString().slice(0, 13)
    let idx = times.findIndex((t) => typeof t === 'string' && t.startsWith(target))
    if (idx < 0) idx = Math.min(times.length - 1, at.getUTCHours())
    const temp = num(temps[idx])
    const code = num(codes[idx])
    if (temp == null || code == null) return null
    const mapped = weatherFromWmo(code)
    return {
      temp_c: temp,
      condition: mapped.condition,
      summary: mapped.summary,
      observed_at: at.toISOString(),
      source: 'open-meteo',
    }
  } catch {
    return null
  }
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_MS),
    })
    if (!res.ok) return null
    const json = (await res.json()) as unknown
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
