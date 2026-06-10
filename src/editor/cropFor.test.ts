import { describe, expect, it } from 'vitest'
import { cropFor } from './attachmentImageExtension'

describe('cropFor', () => {
  it('crops a tall screenshot to 2:3 by height', () => {
    // 9:16 phone screenshot (ratio 0.5625 < 0.667)
    expect(cropFor('m', 1080, 1920)).toEqual({ aspect: '2 / 3', axis: 'height' })
  })

  it('crops a too-wide panorama to 16:9 by width', () => {
    // 21:9 ultrawide (ratio 2.33 > 1.78)
    expect(cropFor('m', 2100, 900)).toEqual({ aspect: '16 / 9', axis: 'width' })
  })

  it('leaves a normal 3:4 phone portrait whole (no people trimmed)', () => {
    // 3:4 (ratio 0.75 > 0.667) — within bounds
    expect(cropFor('m', 1500, 2000)).toBeNull()
  })

  it('leaves a standard landscape whole', () => {
    // 3:2 (ratio 1.5 < 1.78)
    expect(cropFor('m', 1500, 1000)).toBeNull()
  })

  it('crops Small the same way as Medium', () => {
    expect(cropFor('s', 1080, 1920)).toEqual({ aspect: '2 / 3', axis: 'height' })
  })

  it('never crops Full size (whole image)', () => {
    expect(cropFor('f', 1080, 1920)).toBeNull()
  })

  it('never crops when dimensions are unknown', () => {
    expect(cropFor('m', undefined, undefined)).toBeNull()
  })
})
