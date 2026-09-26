import { describe, expect, it } from 'vitest'
import {
  LIBRARY_UPDATES,
  SHELF,
  formatLibraryGrowth,
  isRecentlyAdded,
  latestLibraryUpdate,
} from './practicesData'

describe('rituals library growth', () => {
  it('exposes a dated cadence a reviewer can see', () => {
    expect(LIBRARY_UPDATES.length).toBeGreaterThan(2)
    expect(latestLibraryUpdate().name.length).toBeGreaterThan(0)
    expect(formatLibraryGrowth(new Date('2026-09-24T12:00:00Z'))).toMatch(
      new RegExp(`${SHELF.length} rituals · last added`, 'i'),
    )
  })

  it('marks only recent shelf items as new', () => {
    const latest = latestLibraryUpdate()
    expect(SHELF.some((p) => p.name === latest.name)).toBe(true)
    expect(isRecentlyAdded(latest.name, 4, new Date('2026-09-24T12:00:00Z'))).toBe(true)
    expect(isRecentlyAdded('The Daily Examen', 4, new Date('2026-09-24T12:00:00Z'))).toBe(false)
  })
})
