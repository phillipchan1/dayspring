import { describe, expect, it } from 'vitest'
import { tabRootPatch } from './tabRoot'

const at = {
  surface: 'journal' as const,
  pagesSpreadId: null,
  scriptureBook: null,
  ascentDrill: null,
}

describe('tabRootPatch', () => {
  it('closes the Pages reader back to the wall', () => {
    expect(tabRootPatch({ ...at, surface: 'pages', pagesSpreadId: 'e1' }, 'pages')).toEqual({
      pagesSpreadId: null,
    })
  })

  it('closes an open Lamp book back to the canon map', () => {
    expect(tabRootPatch({ ...at, surface: 'scripture', scriptureBook: 'John' }, 'scripture')).toEqual({
      scriptureBook: null,
      scriptureVerse: null,
    })
  })

  it('closes an Ascent drill-in', () => {
    const drill = { kind: 'scripture' as const, osisRef: 'John.3.16' }
    expect(tabRootPatch({ ...at, surface: 'reflections', ascentDrill: drill }, 'reflections')).toEqual({
      ascentDrill: null,
    })
  })

  it('has nothing to close at a surface root', () => {
    expect(tabRootPatch({ ...at, surface: 'pages' }, 'pages')).toBeNull()
    expect(tabRootPatch({ ...at, surface: 'scripture' }, 'scripture')).toBeNull()
    expect(tabRootPatch({ ...at, surface: 'reflections' }, 'reflections')).toBeNull()
    expect(tabRootPatch({ ...at, surface: 'altar' }, 'altar')).toBeNull()
  })

  it('never acts for a surface you are not on', () => {
    expect(tabRootPatch({ ...at, surface: 'scripture', pagesSpreadId: 'e1' }, 'pages')).toBeNull()
  })
})
