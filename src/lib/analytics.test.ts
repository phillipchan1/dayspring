import { describe, expect, it } from 'vitest'
import { lengthBucket } from './analytics'

describe('lengthBucket', () => {
  it('buckets zero and negative counts as empty', () => {
    expect(lengthBucket(0)).toBe('empty')
    expect(lengthBucket(-1)).toBe('empty')
  })

  it('covers each boundary on both sides', () => {
    expect(lengthBucket(1)).toBe('1_50')
    expect(lengthBucket(50)).toBe('1_50')
    expect(lengthBucket(51)).toBe('51_200')
    expect(lengthBucket(200)).toBe('51_200')
    expect(lengthBucket(201)).toBe('201_500')
    expect(lengthBucket(500)).toBe('201_500')
    expect(lengthBucket(501)).toBe('500_plus')
    expect(lengthBucket(10_000)).toBe('500_plus')
  })
})
