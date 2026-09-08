import { describe, expect, it } from 'vitest'
import {
  circumstancesFromDayOne,
  dropLiveSnapshot,
  formatColophon,
  formatHourBand,
  isCircumstances,
  isLocalToday,
  liftDiarlyCircumstances,
  mergeCircumstances,
  placeLabel,
  roundCoord,
  weatherFromWmo,
} from './circumstances'

describe('roundCoord', () => {
  it('rounds to about a kilometer', () => {
    expect(roundCoord(39.739236)).toBe(39.74)
    expect(roundCoord(-104.9903)).toBe(-104.99)
  })
})

describe('formatHourBand', () => {
  it('names the part of the day in the given zone', () => {
    expect(formatHourBand('2026-01-14T13:14:00.000Z', 'America/Denver')).toBe('early morning')
    expect(formatHourBand('2026-01-14T15:00:00.000Z', 'America/Denver')).toBe('morning')
    expect(formatHourBand('2026-01-14T08:00:00.000Z', 'America/Denver')).toBe('night')
  })
})

describe('formatColophon', () => {
  it('prints nothing when there is nothing to say', () => {
    expect(formatColophon('2026-01-14T13:14:00.000Z', undefined)).toBeNull()
    expect(formatColophon('2026-01-14T13:14:00.000Z', { timezone: 'UTC', source: 'live' })).toBe(
      'afternoon',
    )
  })

  it('joins hour, place, and weather', () => {
    const line = formatColophon('2026-01-14T13:14:00.000Z', {
      timezone: 'America/Denver',
      source: 'import',
      location: { lat: 39.74, lon: -104.99, label: 'Denver' },
      weather: {
        temp_c: -2.2,
        condition: 'snow',
        summary: 'light snow',
        observed_at: '2026-01-14T13:14:00.000Z',
        source: 'import',
      },
    })
    expect(line).toMatch(/^early morning · Denver · light snow, /)
  })

  it('omits an empty place label', () => {
    const line = formatColophon('2026-01-14T13:14:00.000Z', {
      timezone: 'America/Denver',
      source: 'live',
      location: { lat: 39.74, lon: -104.99, label: '  ' },
    })
    expect(line).toBe('early morning')
  })
})

describe('weatherFromWmo', () => {
  it('maps the codes we care about', () => {
    expect(weatherFromWmo(0).condition).toBe('clear')
    expect(weatherFromWmo(3).condition).toBe('cloud')
    expect(weatherFromWmo(71).condition).toBe('snow')
    expect(weatherFromWmo(95).condition).toBe('storm')
  })
})

describe('circumstancesFromDayOne', () => {
  it('reads location, weather, and timezone', () => {
    const c = circumstancesFromDayOne({
      timeZone: 'America/Denver',
      location: {
        latitude: 39.7392,
        longitude: -104.9903,
        localityName: 'Denver',
        administrativeArea: 'CO',
        country: 'United States',
        placeName: 'Home',
      },
      weather: {
        temperatureCelsius: -2,
        weatherCode: 'snow',
        conditionsDescription: 'Light snow',
      },
    })
    expect(c?.timezone).toBe('America/Denver')
    expect(c?.location?.label).toBe('Home, Denver')
    expect(c?.location?.locality).toBe('Denver')
    expect(c?.weather?.condition).toBe('snow')
    expect(c?.weather?.summary).toBe('Light snow')
    expect(c?.source).toBe('import')
  })

  it('returns nothing when Day One sent none of it', () => {
    expect(circumstancesFromDayOne({})).toBeUndefined()
  })
})

describe('liftDiarlyCircumstances', () => {
  it('lifts a map link and a weather footer out of the body', () => {
    const raw = 'A good day.\n\n[Capitol Hill, Denver](diarly://map/39.7392,-104.9903)\n\n57.2°F Mostly Cloudy\n'
    const { body, circumstances } = liftDiarlyCircumstances(raw)
    expect(body).toBe('A good day.')
    expect(circumstances?.location?.label).toBe('Capitol Hill, Denver')
    expect(circumstances?.location?.lat).toBe(39.74)
    expect(circumstances?.weather?.condition).toBe('cloud')
    expect(circumstances?.weather?.summary).toBe('Mostly Cloudy')
    expect(circumstances?.weather?.temp_c).toBeCloseTo((57.2 - 32) * (5 / 9), 1)
  })

  it('leaves ordinary writing alone', () => {
    const raw = 'Prayed about Esther 10.\n\nNothing else.'
    const { body, circumstances } = liftDiarlyCircumstances(raw)
    expect(body).toBe(raw)
    expect(circumstances).toBeUndefined()
  })
})

describe('dropLiveSnapshot', () => {
  it('keeps timezone and drops a live place/weather after a date change', () => {
    const next = dropLiveSnapshot({
      timezone: 'America/Denver',
      source: 'live',
      location: { lat: 39.74, lon: -104.99, label: 'Denver' },
      weather: {
        temp_c: 1,
        condition: 'snow',
        summary: 'snow',
        observed_at: '2026-01-14T13:00:00.000Z',
        source: 'open-meteo',
      },
    })
    expect(next).toEqual({ timezone: 'America/Denver', source: 'live' })
  })

  it('leaves imported circumstance intact', () => {
    const imported = {
      timezone: 'America/Denver',
      source: 'import' as const,
      location: { lat: 39.74, lon: -104.99, label: 'Denver' },
    }
    expect(dropLiveSnapshot(imported)).toEqual(imported)
  })
})

describe('mergeCircumstances', () => {
  it('fills missing fields without erasing a place we already have', () => {
    const merged = mergeCircumstances(
      { timezone: 'UTC', source: 'live', location: { lat: 1, lon: 2, label: 'Home' } },
      { timezone: 'America/Denver', source: 'live' },
    )
    expect(merged.timezone).toBe('America/Denver')
    expect(merged.location?.label).toBe('Home')
  })
})

describe('placeLabel', () => {
  it('prefers neighbourhood plus city', () => {
    expect(placeLabel({ neighbourhood: 'Capitol Hill', locality: 'Denver', region: 'CO' })).toEqual({
      label: 'Capitol Hill, Denver',
      locality: 'Denver',
      region: 'CO',
    })
  })

  it('returns null when there is no name', () => {
    expect(placeLabel({})).toBeNull()
  })
})

describe('isCircumstances / isLocalToday', () => {
  it('rejects an empty object', () => {
    expect(isCircumstances({})).toBe(false)
    expect(isCircumstances({ timezone: 'UTC', source: 'live' })).toBe(true)
  })

  it('recognises today', () => {
    const now = new Date('2026-09-08T18:00:00.000Z')
    expect(isLocalToday(now.toISOString(), now)).toBe(true)
    expect(isLocalToday('2020-01-01T12:00:00.000Z', now)).toBe(false)
  })
})
