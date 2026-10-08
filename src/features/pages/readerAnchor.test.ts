import { describe, expect, it } from 'vitest'
import { anchorKey, findAnchorBlock } from './readerAnchor'

describe('anchorKey', () => {
  it('drops the markers markdown adds to the start of a line', () => {
    expect(anchorKey('## A morning')).toBe('amorning')
    expect(anchorKey('- [ ] call my brother')).toBe('callmybrother')
    expect(anchorKey('> 1. Be still, and know')).toBe('bestillandknow')
  })

  it('keeps a line that only looks like a marker', () => {
    expect(anchorKey('1989 was the year')).toBe('1989wastheyear')
  })
})

describe('findAnchorBlock', () => {
  const page = ['A morning', 'I woke before the light.', 'Mercy, new every morning', 'I woke before the kettle.']

  it('finds the block that opens with the line', () => {
    expect(findAnchorBlock(anchorKey('**Mercy**, new every morning'), page, 0)).toBe(2)
  })

  it('takes the longest shared opening, past a link the page does not spell out', () => {
    const key = anchorKey('I woke before the [light](https://example.com/dawn).')
    expect(findAnchorBlock(key, page, 3)).toBe(1)
  })

  it('breaks a tie toward where the line was expected', () => {
    const refrain = ['Lord, have mercy', 'something else here', 'Lord, have mercy']
    expect(findAnchorBlock(anchorKey('Lord, have mercy'), refrain, 2)).toBe(2)
    expect(findAnchorBlock(anchorKey('Lord, have mercy'), refrain, 0)).toBe(0)
  })

  it('refuses a match too short to trust', () => {
    expect(findAnchorBlock(anchorKey('I woke up late and it was fine'), page, 0)).toBe(-1)
    expect(findAnchorBlock('', page, 0)).toBe(-1)
  })
})
