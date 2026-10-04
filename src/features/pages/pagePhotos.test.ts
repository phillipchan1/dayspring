import { describe, expect, it } from 'vitest'
import { NO_PHOTOS, pagePhotos } from './pagePhotos'

const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

describe('pagePhotos', () => {
  it('is the shared empty list for a page with none', () => {
    expect(pagePhotos('just words')).toBe(NO_PHOTOS)
    expect(pagePhotos(null)).toBe(NO_PHOTOS)
  })

  it('reads every photo, in the order she put them there', () => {
    const md = `![](attachment:${A}.jpg)\n![](attachment:${B}.png?size=s)\n\nlater\n\n![](attachment:${A}.jpg)`
    expect(pagePhotos(md).map((p) => [p.hash, p.ext])).toEqual([
      [A, 'jpg'],
      [B, 'png'],
      [A, 'jpg'],
    ])
  })

  it('keeps her caption and drops a filename the camera made up', () => {
    const md = `![First fire of the fall](attachment:${A}.jpg)\n![IMG_4410](attachment:${B}.jpg)`
    expect(pagePhotos(md).map((p) => p.caption)).toEqual(['First fire of the fall', null])
  })

  it('does not count a photo still uploading', () => {
    expect(pagePhotos('![](attachment-pending:00000000-0000-0000-0000-000000000000)')).toBe(NO_PHOTOS)
  })
})
