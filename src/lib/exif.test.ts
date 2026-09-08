import { describe, expect, it } from 'vitest'
import { exifDateToIso, parseJpegExif } from './exif'

function le16(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff]
}
function le32(n: number): number[] {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]
}

/** A tiny JPEG whose APP1 carries DateTimeOriginal and a Denver GPS pin. */
function jpegWithExif(): Uint8Array {
  const date = '2024:03:02 08:14:00\0'
  const dateBytes = [...date].map((c) => c.charCodeAt(0))

  // Layout after TIFF header (offset 0):
  // 0  II * + IFD0 offset 8
  // 8  IFD0: 2 entries (ExifIFD, GPSIFD) + next=0
  // 8+2+24+4 = 38  Exif IFD
  // Exif IFD: 1 entry (DateTimeOriginal) + next=0
  // then date string
  // then GPS IFD: 4 entries + rationals

  const ifd0At = 8
  const exifIfdAt = 8 + 2 + 2 * 12 + 4 // 38
  const dateAt = exifIfdAt + 2 + 12 + 4 // 56
  const gpsIfdAt = dateAt + dateBytes.length // 77
  const gpsRatsAt = gpsIfdAt + 2 + 4 * 12 + 4 // 77+54=131

  const tiff = new Uint8Array(gpsRatsAt + 48)
  tiff[0] = 0x49
  tiff[1] = 0x49
  tiff.set(le16(0x002a), 2)
  tiff.set(le32(ifd0At), 4)

  // IFD0
  tiff.set(le16(2), ifd0At)
  // ExifIFD pointer tag 0x8769 type=4 count=1 value=exifIfdAt
  tiff.set(le16(0x8769), ifd0At + 2)
  tiff.set(le16(4), ifd0At + 4)
  tiff.set(le32(1), ifd0At + 6)
  tiff.set(le32(exifIfdAt), ifd0At + 10)
  // GPS IFD tag 0x8825
  tiff.set(le16(0x8825), ifd0At + 14)
  tiff.set(le16(4), ifd0At + 16)
  tiff.set(le32(1), ifd0At + 18)
  tiff.set(le32(gpsIfdAt), ifd0At + 22)
  tiff.set(le32(0), ifd0At + 26)

  // Exif IFD
  tiff.set(le16(1), exifIfdAt)
  tiff.set(le16(0x9003), exifIfdAt + 2)
  tiff.set(le16(2), exifIfdAt + 4)
  tiff.set(le32(dateBytes.length), exifIfdAt + 6)
  tiff.set(le32(dateAt), exifIfdAt + 10)
  tiff.set(le32(0), exifIfdAt + 14)
  tiff.set(dateBytes, dateAt)

  // GPS IFD: latRef, lat, lonRef, lon
  tiff.set(le16(4), gpsIfdAt)
  // 0x0001 GPSLatitudeRef = 'N'
  tiff.set(le16(0x0001), gpsIfdAt + 2)
  tiff.set(le16(2), gpsIfdAt + 4)
  tiff.set(le32(2), gpsIfdAt + 6)
  tiff[gpsIfdAt + 10] = 0x4e
  tiff[gpsIfdAt + 11] = 0
  // 0x0002 GPSLatitude — 3 rationals at gpsRatsAt
  tiff.set(le16(0x0002), gpsIfdAt + 14)
  tiff.set(le16(5), gpsIfdAt + 16)
  tiff.set(le32(3), gpsIfdAt + 18)
  tiff.set(le32(gpsRatsAt), gpsIfdAt + 22)
  // 0x0003 GPSLongitudeRef = 'W'
  tiff.set(le16(0x0003), gpsIfdAt + 26)
  tiff.set(le16(2), gpsIfdAt + 28)
  tiff.set(le32(2), gpsIfdAt + 30)
  tiff[gpsIfdAt + 34] = 0x57
  tiff[gpsIfdAt + 35] = 0
  // 0x0004 GPSLongitude
  tiff.set(le16(0x0004), gpsIfdAt + 38)
  tiff.set(le16(5), gpsIfdAt + 40)
  tiff.set(le32(3), gpsIfdAt + 42)
  tiff.set(le32(gpsRatsAt + 24), gpsIfdAt + 46)
  tiff.set(le32(0), gpsIfdAt + 50)

  // 39° 44' 21.25" N  ≈ 39.7392
  const rats = (off: number, d: number, m: number, sNum: number, sDen: number) => {
    tiff.set(le32(d), off)
    tiff.set(le32(1), off + 4)
    tiff.set(le32(m), off + 8)
    tiff.set(le32(1), off + 12)
    tiff.set(le32(sNum), off + 16)
    tiff.set(le32(sDen), off + 20)
  }
  rats(gpsRatsAt, 39, 44, 2125, 100)
  rats(gpsRatsAt + 24, 104, 59, 2508, 100)

  const payload = new Uint8Array(6 + tiff.length)
  payload.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00])
  payload.set(tiff, 6)
  const size = payload.length + 2
  const jpeg = new Uint8Array(2 + 2 + 2 + payload.length + 2)
  jpeg[0] = 0xff
  jpeg[1] = 0xd8
  jpeg[2] = 0xff
  jpeg[3] = 0xe1
  jpeg[4] = (size >> 8) & 0xff
  jpeg[5] = size & 0xff
  jpeg.set(payload, 6)
  jpeg[6 + payload.length] = 0xff
  jpeg[7 + payload.length] = 0xd9
  return jpeg
}

describe('exifDateToIso', () => {
  it('parses an EXIF datetime', () => {
    const iso = exifDateToIso('2024:03:02 08:14:00')
    expect(iso).toBeTruthy()
    expect(new Date(iso!).getFullYear()).toBe(2024)
  })

  it('rejects junk', () => {
    expect(exifDateToIso('nope')).toBeUndefined()
  })
})

describe('parseJpegExif', () => {
  it('reads DateTimeOriginal and GPS from a JPEG', () => {
    const parsed = parseJpegExif(jpegWithExif())
    expect(parsed.takenAt).toBeTruthy()
    expect(parsed.gps).toBeTruthy()
    expect(parsed.gps!.lat).toBeCloseTo(39.7392, 3)
    expect(parsed.gps!.lon).toBeCloseTo(-104.9903, 3)
  })

  it('returns empty for a non-JPEG', () => {
    expect(parseJpegExif(new Uint8Array([0, 1, 2, 3]))).toEqual({})
  })
})
