// Settings migrations run once, against preferences a real person chose, and
// there is no undo. These pin the two that matter most: the font bump that must
// not apply twice, and the density steps that became a continuous zoom.

import { describe, expect, it } from 'vitest'
import { FONT_SIZE_DEFAULT, migrateSettings } from './settings'

describe('migrateSettings', () => {
  it('gives a blob with nothing in it the defaults', () => {
    const s = migrateSettings({ v: 4 })
    expect(s.pagesZoom).toBe(0.6)
    expect(s.fontSize).toBe(FONT_SIZE_DEFAULT)
  })

  /**
   * The bug this guards against: the v3 font bump used to be gated on
   * `version < SETTINGS_FORMAT_VERSION`, so raising the version to 4 would have
   * re-run it and silently added another 4px to the writing size of every user
   * who had already been through it once.
   */
  it('does not re-run the v3 font bump for someone already on v3', () => {
    const before = migrateSettings({ v: 3, appearance: 'dark', fontSize: 24 })
    expect(before.fontSize).toBe(24)
  })

  it('still applies the v3 font bump to someone arriving from v2', () => {
    const s = migrateSettings({ v: 2, appearance: 'dark', fontSize: 24 })
    expect(s.fontSize).toBe(28)
  })

  describe('v4 — three density steps became one zoom', () => {
    it('carries each saved step to where it sat on the scale', () => {
      expect(migrateSettings({ v: 3, appearance: 'dark', pagesDensity: 'wall' }).pagesZoom).toBe(0.1)
      expect(migrateSettings({ v: 3, appearance: 'dark', pagesDensity: 'shelf' }).pagesZoom).toBe(
        0.45,
      )
      expect(migrateSettings({ v: 3, appearance: 'dark', pagesDensity: 'open' }).pagesZoom).toBe(
        0.85,
      )
    })

    it('leaves someone who never opened Pages on the default', () => {
      expect(migrateSettings({ v: 3, appearance: 'dark' }).pagesZoom).toBe(0.6)
    })

    it('ignores a value that was never one of the steps', () => {
      const s = migrateSettings({ v: 3, appearance: 'dark', pagesDensity: 'nonsense' as never })
      expect(s.pagesZoom).toBe(0.6)
    })

    it('does not overwrite a zoom the user has since chosen', () => {
      const s = migrateSettings({ v: 4, appearance: 'dark', pagesZoom: 0.72 })
      expect(s.pagesZoom).toBe(0.72)
    })
  })

  // A NaN or out-of-range zoom would render the wall at an impossible height
  // and persist, with no way back short of clearing storage.
  it('clamps a corrupt zoom back into range', () => {
    expect(migrateSettings({ v: 4, pagesZoom: 5 }).pagesZoom).toBe(1)
    expect(migrateSettings({ v: 4, pagesZoom: -2 }).pagesZoom).toBe(0)
  })
})
