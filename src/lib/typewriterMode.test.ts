import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, migrateSettings } from './settings'
import {
  flipTypewriter,
  resolveTypewriter,
  typewriterMode,
  typewriterPatch,
  typewriterWanted,
  type TypewriterMode,
} from './typewriterMode'

const MODES: TypewriterMode[] = ['off', 'focus', 'always']

describe('typewriterMode', () => {
  it('is In focus for everyone who has never touched it', () => {
    expect(typewriterMode(DEFAULT_SETTINGS)).toBe('focus')
    // What a stable client wrote: no typewriterAlways key at all.
    expect(typewriterMode(migrateSettings({ v: 4, typewriter: true }))).toBe('focus')
    expect(typewriterMode(migrateSettings({ v: 4, typewriter: false }))).toBe('off')
  })

  it('round-trips every mode through its patch', () => {
    for (const mode of MODES) expect(typewriterMode(typewriterPatch(mode))).toBe(mode)
  })

  it('keeps `typewriter` a plain boolean an older client reads correctly', () => {
    expect(typewriterPatch('off').typewriter).toBe(false)
    expect(typewriterPatch('focus').typewriter).toBe(true)
    expect(typewriterPatch('always').typewriter).toBe(true)
  })

  it('lets off win over a stale typewriterAlways', () => {
    // An older client switched typewriter off without knowing the later key.
    expect(typewriterMode({ typewriter: false, typewriterAlways: true })).toBe('off')
  })
})

describe('typewriterWanted', () => {
  const at = (mode: TypewriterMode, focus: boolean) => typewriterWanted(typewriterPatch(mode), focus)

  it('never centres when off', () => {
    expect(at('off', false)).toBe(false)
    expect(at('off', true)).toBe(false)
  })

  it('centres only inside focus mode when In focus', () => {
    expect(at('focus', false)).toBe(false)
    expect(at('focus', true)).toBe(true)
  })

  it('centres everywhere when Always', () => {
    expect(at('always', false)).toBe(true)
    expect(at('always', true)).toBe(true)
  })
})

describe('resolveTypewriter', () => {
  const ctx = { focusActive: false, available: true, focusEditorReady: false }
  const resolve = (mode: TypewriterMode, over: Partial<typeof ctx> = {}) =>
    resolveTypewriter(typewriterPatch(mode), { ...ctx, ...over })

  it('never centres on a device that cannot, whatever was synced to it', () => {
    for (const mode of MODES) {
      for (const focusActive of [false, true]) {
        const r = resolve(mode, { available: false, focusActive, focusEditorReady: true })
        expect(r).toEqual({ shown: false, on: false })
      }
    }
  })

  it('centres the normal editor from the first frame under Always', () => {
    expect(resolve('always')).toEqual({ shown: true, on: true })
  })

  it('does not centre the normal editor under the default', () => {
    expect(resolve('focus')).toEqual({ shown: false, on: false })
  })

  it('waits for focus mode to be ready under In focus, but reports it shown at once', () => {
    expect(resolve('focus', { focusActive: true })).toEqual({ shown: true, on: false })
    expect(resolve('focus', { focusActive: true, focusEditorReady: true })).toEqual({
      shown: true,
      on: true,
    })
  })

  it('does not make Always wait when focus mode opens over it', () => {
    expect(resolve('always', { focusActive: true, focusEditorReady: false }).on).toBe(true)
  })
})

describe('flipTypewriter', () => {
  const flip = (mode: TypewriterMode, focus: boolean) =>
    typewriterMode(flipTypewriter(typewriterPatch(mode), focus))

  it('turns off whatever is centring where you are', () => {
    expect(flip('always', false)).toBe('off')
    expect(flip('always', true)).toBe('off')
    expect(flip('focus', true)).toBe('off')
  })

  it('turns on for the normal editor as Always', () => {
    expect(flip('off', false)).toBe('always')
    // The default is In focus, which does nothing here — so the switch reads off
    // in the normal editor, and one press turns it on.
    expect(flip('focus', false)).toBe('always')
  })

  it('turns on inside focus mode as In focus, leaving the normal editor alone', () => {
    expect(flip('off', true)).toBe('focus')
  })
})
