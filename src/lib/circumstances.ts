// Circumstances of writing — the room you were in, not a title we invented.
//
// Date is already printed on every page. Hour, place, and weather are the same
// class: facts about when and where the page was written. The editor never
// waits on them; they land on the row after save, or arrive with an import.

export type CircumstanceSource = 'live' | 'import' | 'exif' | 'manual'

export type WeatherCondition = 'snow' | 'rain' | 'clear' | 'cloud' | 'fog' | 'storm'

export interface CircumstanceLocation {
  lat: number
  lon: number
  accuracy_m?: number
  label: string
  locality?: string
  region?: string
  country?: string
}

export interface CircumstanceWeather {
  temp_c: number
  condition: WeatherCondition
  summary: string
  observed_at: string
  source: 'open-meteo' | 'import'
}

export interface EntryCircumstances {
  timezone: string
  source: CircumstanceSource
  location?: CircumstanceLocation
  weather?: CircumstanceWeather
}

/** ~1.1 km — coarse enough that a home is a neighborhood, not a pin. */
export const COORD_PRECISION = 2

const CONDITIONS: readonly WeatherCondition[] = [
  'snow',
  'rain',
  'clear',
  'cloud',
  'fog',
  'storm',
]

export function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function timezoneOnly(source: CircumstanceSource): EntryCircumstances {
  return { timezone: currentTimezone(), source }
}

export function roundCoord(n: number): number {
  const f = 10 ** COORD_PRECISION
  return Math.round(n * f) / f
}

export function isCircumstances(value: unknown): value is EntryCircumstances {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.timezone === 'string' && v.timezone.length > 0
}

/** Keep timezone; drop a live snap that no longer matches a changed date. */
export function dropLiveSnapshot(current: EntryCircumstances | undefined): EntryCircumstances | undefined {
  if (!current) return current
  if (current.source !== 'live') return current
  if (!current.location && !current.weather) return current
  return { timezone: current.timezone, source: current.source }
}

export function mergeCircumstances(
  base: EntryCircumstances | undefined,
  patch: EntryCircumstances,
): EntryCircumstances {
  const next: EntryCircumstances = {
    timezone: patch.timezone || base?.timezone || currentTimezone(),
    source: patch.source || base?.source || 'live',
  }
  const location = patch.location ?? base?.location
  const weather = patch.weather ?? base?.weather
  if (location) next.location = location
  if (weather) next.weather = weather
  return next
}

/** True when `iso` falls on the viewer's calendar today. */
export function isLocalToday(iso: string, now = new Date()): boolean {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function localHour(iso: string, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date(iso))
    const raw = parts.find((p) => p.type === 'hour')?.value
    if (raw == null) return null
    const hour = Number(raw)
    return Number.isFinite(hour) ? hour : null
  } catch {
    return null
  }
}

/** A spoken band, not a clock — the colophon is a folio line, not a timestamp. */
export function formatHourBand(iso: string, timeZone: string): string | null {
  const hour = localHour(iso, timeZone)
  if (hour == null) return null
  if (hour >= 5 && hour < 8) return 'early morning'
  if (hour >= 8 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

function usesFahrenheit(): boolean {
  try {
    return typeof navigator !== 'undefined' && navigator.language.startsWith('en-US')
  } catch {
    return false
  }
}

export function formatTemperature(tempC: number): string {
  if (usesFahrenheit()) return `${Math.round((tempC * 9) / 5 + 32)}°`
  return `${Math.round(tempC)}°`
}

export function formatWeather(weather: CircumstanceWeather): string {
  const summary = weather.summary.trim() || weather.condition
  return `${summary}, ${formatTemperature(weather.temp_c)}`
}

/**
 * One quiet folio line. Empty circumstances print nothing — no
 * "location unknown."
 */
export function formatColophon(
  createdAt: string,
  circumstances: EntryCircumstances | undefined | null,
): string | null {
  if (!circumstances) return null
  const parts: string[] = []
  const hour = formatHourBand(createdAt, circumstances.timezone)
  if (hour) parts.push(hour)
  const place = circumstances.location?.label.trim()
  if (place) parts.push(place)
  if (circumstances.weather) parts.push(formatWeather(circumstances.weather))
  return parts.length > 0 ? parts.join(' · ') : null
}

export function weatherFromWmo(code: number): { condition: WeatherCondition; summary: string } {
  if (code === 0 || code === 1) return { condition: 'clear', summary: 'clear' }
  if (code === 2 || code === 3) return { condition: 'cloud', summary: 'cloudy' }
  if (code === 45 || code === 48) return { condition: 'fog', summary: 'fog' }
  if (code >= 51 && code <= 67) return { condition: 'rain', summary: 'rain' }
  if (code >= 71 && code <= 77) return { condition: 'snow', summary: 'snow' }
  if (code >= 80 && code <= 82) return { condition: 'rain', summary: 'rain' }
  if (code === 85 || code === 86) return { condition: 'snow', summary: 'snow' }
  if (code >= 95) return { condition: 'storm', summary: 'storm' }
  return { condition: 'cloud', summary: 'cloudy' }
}

const DAY_ONE_WEATHER: Record<string, { condition: WeatherCondition; summary: string }> = {
  sunny: { condition: 'clear', summary: 'clear' },
  mostlysunny: { condition: 'clear', summary: 'mostly clear' },
  clear: { condition: 'clear', summary: 'clear' },
  partlycloudy: { condition: 'cloud', summary: 'partly cloudy' },
  mostlycloudy: { condition: 'cloud', summary: 'mostly cloudy' },
  cloudy: { condition: 'cloud', summary: 'cloudy' },
  rain: { condition: 'rain', summary: 'rain' },
  lightrain: { condition: 'rain', summary: 'light rain' },
  drizzle: { condition: 'rain', summary: 'drizzle' },
  snow: { condition: 'snow', summary: 'snow' },
  lightsnow: { condition: 'snow', summary: 'light snow' },
  sleet: { condition: 'snow', summary: 'sleet' },
  hail: { condition: 'storm', summary: 'hail' },
  thunderstorm: { condition: 'storm', summary: 'storm' },
  storm: { condition: 'storm', summary: 'storm' },
  fog: { condition: 'fog', summary: 'fog' },
  foggy: { condition: 'fog', summary: 'fog' },
  windy: { condition: 'cloud', summary: 'windy' },
}

function conditionFromWords(text: string): { condition: WeatherCondition; summary: string } {
  const t = text.toLowerCase()
  if (/thunder|storm|hail/.test(t)) return { condition: 'storm', summary: text.trim() || 'storm' }
  if (/snow|sleet|blizzard/.test(t)) return { condition: 'snow', summary: text.trim() || 'snow' }
  if (/rain|drizzle|shower/.test(t)) return { condition: 'rain', summary: text.trim() || 'rain' }
  if (/fog|mist/.test(t)) return { condition: 'fog', summary: text.trim() || 'fog' }
  if (/clear|sunny/.test(t)) return { condition: 'clear', summary: text.trim() || 'clear' }
  if (/cloud/.test(t)) return { condition: 'cloud', summary: text.trim() || 'cloudy' }
  return { condition: 'cloud', summary: text.trim() || 'cloudy' }
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function dayOneLocation(raw: unknown): CircumstanceLocation | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const loc = raw as Record<string, unknown>
  const lat = asFiniteNumber(loc.latitude)
  const lon = asFiniteNumber(loc.longitude)
  if (lat == null || lon == null) return undefined
  const locality = typeof loc.localityName === 'string' ? loc.localityName.trim() : ''
  const place = typeof loc.placeName === 'string' ? loc.placeName.trim() : ''
  const region = typeof loc.administrativeArea === 'string' ? loc.administrativeArea.trim() : ''
  const country = typeof loc.country === 'string' ? loc.country.trim() : ''
  const label =
    place && place.toLowerCase() !== locality.toLowerCase()
      ? locality
        ? `${place}, ${locality}`
        : place
      : locality || place || region || country
  if (!label) return { lat: roundCoord(lat), lon: roundCoord(lon), label: '' }
  return {
    lat: roundCoord(lat),
    lon: roundCoord(lon),
    label,
    ...(locality ? { locality } : {}),
    ...(region ? { region } : {}),
    ...(country ? { country } : {}),
  }
}

function dayOneWeather(raw: unknown, observedAt: string): CircumstanceWeather | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const w = raw as Record<string, unknown>
  const temp = asFiniteNumber(w.temperatureCelsius)
  if (temp == null) return undefined
  const code = typeof w.weatherCode === 'string' ? w.weatherCode.replace(/[\s_-]/g, '').toLowerCase() : ''
  const desc = typeof w.conditionsDescription === 'string' ? w.conditionsDescription.trim() : ''
  const mapped = (code && DAY_ONE_WEATHER[code]) || conditionFromWords(desc || code)
  return {
    temp_c: temp,
    condition: mapped.condition,
    summary: desc || mapped.summary,
    observed_at: observedAt,
    source: 'import',
  }
}

/** Lift Day One's JSON location / weather / timeZone into our shape. */
export function circumstancesFromDayOne(
  raw: {
    timeZone?: unknown
    location?: unknown
    weather?: unknown
  },
  observedAt?: string,
): EntryCircumstances | undefined {
  const timezone = typeof raw.timeZone === 'string' && raw.timeZone.trim() ? raw.timeZone.trim() : ''
  const location = dayOneLocation(raw.location)
  const weather = dayOneWeather(raw.weather, observedAt ?? new Date().toISOString())
  if (!timezone && !location && !weather) return undefined
  return {
    timezone: timezone || 'UTC',
    source: 'import',
    ...(location ? { location } : {}),
    ...(weather ? { weather } : {}),
  }
}

const DIARLY_MAP_RE = /\[([^\]]*)\]\(diarly:\/\/map\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/gi
const DIARLY_WEATHER_LINE_RE = /^[ \t]*(\d+(?:\.\d+)?)\s*°\s*([CF])\b([^\n]*)$/gim

function parseDiarlyWeatherLine(
  temp: number,
  unit: string,
  rest: string,
  observedAt: string,
): CircumstanceWeather {
  const c = unit.toUpperCase() === 'F' ? ((temp - 32) * 5) / 9 : temp
  const mapped = conditionFromWords(rest)
  return {
    temp_c: Math.round(c * 10) / 10,
    condition: mapped.condition,
    summary: rest.trim() || mapped.summary,
    observed_at: observedAt,
    source: 'import',
  }
}

/**
 * Pull Diarly's geotag links and weather footers out of the body so they
 * become structured circumstance — and stop being mistaken for scripture.
 */
export function liftDiarlyCircumstances(
  body: string,
  observedAt = new Date().toISOString(),
): {
  body: string
  circumstances?: EntryCircumstances
} {
  let location: CircumstanceLocation | undefined
  const strippedMaps = body.replace(DIARLY_MAP_RE, (_all, label: string, latS: string, lonS: string) => {
    const lat = Number(latS)
    const lon = Number(lonS)
    if (Number.isFinite(lat) && Number.isFinite(lon) && !location) {
      const name = String(label).trim()
      const locality = name.includes(',') ? name.split(',').pop()?.trim() : name || undefined
      location = {
        lat: roundCoord(lat),
        lon: roundCoord(lon),
        label: name,
        ...(locality ? { locality } : {}),
      }
    }
    return ''
  })

  let weather: CircumstanceWeather | undefined
  const strippedWeather = strippedMaps.replace(DIARLY_WEATHER_LINE_RE, (_all, tempS: string, unit: string, rest: string) => {
    const temp = Number(tempS)
    if (Number.isFinite(temp) && !weather) {
      weather = parseDiarlyWeatherLine(temp, unit, rest, observedAt)
    }
    return ''
  })

  const cleaned = strippedWeather.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!location && !weather) return { body: cleaned === body.trim() ? body : cleaned }

  return {
    body: cleaned,
    circumstances: {
      timezone: 'UTC',
      source: 'import',
      ...(location ? { location } : {}),
      ...(weather ? { weather } : {}),
    },
  }
}

/** Build a colophon place from reverse-geocode parts. Empty if we have nothing to say. */
export function placeLabel(parts: {
  neighbourhood?: string
  locality?: string
  region?: string
  country?: string
}): { label: string; locality?: string; region?: string; country?: string } | null {
  const neighbourhood = parts.neighbourhood?.trim() || ''
  const locality = parts.locality?.trim() || ''
  const region = parts.region?.trim() || ''
  const country = parts.country?.trim() || ''
  const label =
    neighbourhood && locality && neighbourhood.toLowerCase() !== locality.toLowerCase()
      ? `${neighbourhood}, ${locality}`
      : locality || neighbourhood || region || country
  if (!label) return null
  return {
    label,
    ...(locality ? { locality } : {}),
    ...(region ? { region } : {}),
    ...(country ? { country } : {}),
  }
}

export function isWeatherCondition(value: unknown): value is WeatherCondition {
  return typeof value === 'string' && (CONDITIONS as readonly string[]).includes(value)
}
