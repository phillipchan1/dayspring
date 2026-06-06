import { describe, expect, it } from 'vitest'
import { altFromFile, isMeaningfulCaption } from './attachmentCaption'

describe('isMeaningfulCaption', () => {
  it('rejects macOS Photos export ids', () => {
    expect(isMeaningfulCaption('3771707B-2E6A-4B47-BEFF-3F75866F8F42_1_105_c')).toBe(false)
  })

  it('accepts human captions', () => {
    expect(isMeaningfulCaption('Coffee and journal')).toBe(true)
  })

  it('rejects camera defaults', () => {
    expect(isMeaningfulCaption('IMG_1234')).toBe(false)
  })
})

describe('altFromFile', () => {
  it('returns empty for ugly export names', () => {
    const file = new File([''], '3771707B-2E6A-4B47-BEFF-3F75866F8F42_1_105_c.jpeg', {
      type: 'image/jpeg',
    })
    expect(altFromFile(file)).toBe('')
  })
})
