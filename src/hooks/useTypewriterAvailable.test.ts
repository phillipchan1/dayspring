import { describe, expect, it } from 'vitest'
import { canTypewrite, isPhysicalKey } from './useTypewriterAvailable'

describe('canTypewrite', () => {
  const desktop = { isMobile: false, coarsePointer: false, physicalKey: false }

  it('is on for a Mac, or a browser on one', () => {
    expect(canTypewrite(desktop)).toBe(true)
  })

  it('is on for an iPad with a trackpad, which makes the pointer fine', () => {
    expect(canTypewrite({ ...desktop, coarsePointer: false })).toBe(true)
  })

  it('is on for an iPad with a keyboard but no trackpad, once a key is pressed', () => {
    expect(canTypewrite({ isMobile: false, coarsePointer: true, physicalKey: true })).toBe(true)
  })

  it('is off for an iPad on glass', () => {
    expect(canTypewrite({ isMobile: false, coarsePointer: true, physicalKey: false })).toBe(false)
  })

  it('is off for a phone, even with a keyboard attached', () => {
    expect(canTypewrite({ isMobile: true, coarsePointer: true, physicalKey: false })).toBe(false)
    expect(canTypewrite({ isMobile: true, coarsePointer: true, physicalKey: true })).toBe(false)
  })
})

describe('isPhysicalKey', () => {
  it('counts a key that reports where it is on a keyboard', () => {
    expect(isPhysicalKey({ code: 'KeyA', isTrusted: true })).toBe(true)
    expect(isPhysicalKey({ code: 'Enter', isTrusted: true })).toBe(true)
  })

  it('does not count the on-screen keyboard, which reports no position', () => {
    expect(isPhysicalKey({ code: '', isTrusted: true })).toBe(false)
    expect(isPhysicalKey({ code: 'Unidentified', isTrusted: true })).toBe(false)
  })

  it('does not count a key a script made up', () => {
    expect(isPhysicalKey({ code: 'KeyA', isTrusted: false })).toBe(false)
  })
})
