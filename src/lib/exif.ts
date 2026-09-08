// Best-effort JPEG EXIF — DateTimeOriginal and GPS. Other formats (HEIC)
// return empty and the caller falls back to File.lastModified.

export interface PhotoExif {
  takenAt?: string
  gps?: { lat: number; lon: number }
}

const SOI = 0xffd8
const APP1 = 0xffe1
const SOS = 0xffda

export async function readPhotoExif(file: Blob): Promise<PhotoExif> {
  if (!file.type.includes('jpeg') && !file.type.includes('jpg') && !/\.jpe?g$/i.test(nameOf(file))) {
    return {}
  }
  try {
    const buf = new Uint8Array(await file.slice(0, 65_536).arrayBuffer())
    return parseJpegExif(buf)
  } catch {
    return {}
  }
}

function nameOf(file: Blob): string {
  return 'name' in file && typeof (file as File).name === 'string' ? (file as File).name : ''
}

export function parseJpegExif(bytes: Uint8Array): PhotoExif {
  if (bytes.length < 4 || ((bytes[0]! << 8) | bytes[1]!) !== SOI) return {}
  let i = 2
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) break
    const marker = (bytes[i]! << 8) | bytes[i + 1]!
    const size = (bytes[i + 2]! << 8) | bytes[i + 3]!
    if (size < 2 || i + 2 + size > bytes.length) break
    if (marker === APP1) {
      const payload = bytes.subarray(i + 4, i + 2 + size)
      if (ascii(payload, 0, 6) === 'Exif\0\0') {
        return parseTiff(payload.subarray(6))
      }
    }
    if (marker === SOS) break
    i += 2 + size
  }
  return {}
}

function parseTiff(tiff: Uint8Array): PhotoExif {
  if (tiff.length < 8) return {}
  const le = tiff[0] === 0x49 && tiff[1] === 0x49
  const be = tiff[0] === 0x4d && tiff[1] === 0x4d
  if (!le && !be) return {}
  const u16 = (o: number) => (le ? tiff[o]! | (tiff[o + 1]! << 8) : (tiff[o]! << 8) | tiff[o + 1]!)
  const u32 = (o: number) =>
    le
      ? tiff[o]! | (tiff[o + 1]! << 8) | (tiff[o + 2]! << 16) | (tiff[o + 3]! << 24)
      : (tiff[o]! << 24) | (tiff[o + 1]! << 16) | (tiff[o + 2]! << 8) | tiff[o + 3]!

  if (u16(2) !== 0x002a) return {}
  const ifd0 = readIfd(tiff, u32(4), u16, u32)
  const out: PhotoExif = {}

  const exifPtr = ifd0.get(0x8769)
  if (typeof exifPtr === 'number') {
    const exif = readIfd(tiff, exifPtr, u16, u32)
    const raw = exif.get(0x9003)
    if (typeof raw === 'string') {
      const iso = exifDateToIso(raw)
      if (iso) out.takenAt = iso
    }
  }

  const gpsPtr = ifd0.get(0x8825)
  if (typeof gpsPtr === 'number') {
    const gps = readIfd(tiff, gpsPtr, u16, u32)
    const lat = gpsRational(gps.get(0x0002), gps.get(0x0001) === 'S' ? -1 : 1)
    const lon = gpsRational(gps.get(0x0004), gps.get(0x0003) === 'W' ? -1 : 1)
    if (lat != null && lon != null) out.gps = { lat, lon }
  }

  return out
}

type IfdValue = number | string | number[]
type U16 = (o: number) => number
type U32 = (o: number) => number

function readIfd(tiff: Uint8Array, offset: number, u16: U16, u32: U32): Map<number, IfdValue> {
  const map = new Map<number, IfdValue>()
  if (offset < 0 || offset + 2 > tiff.length) return map
  const count = u16(offset)
  for (let i = 0; i < count; i++) {
    const e = offset + 2 + i * 12
    if (e + 12 > tiff.length) break
    const tag = u16(e)
    const type = u16(e + 2)
    const n = u32(e + 4)
    const inline = e + 8
    const valueOff = n * sizeOf(type) <= 4 ? inline : u32(inline)
    const val = decode(tiff, type, n, valueOff, u16, u32)
    if (val !== undefined) map.set(tag, val)
  }
  return map
}

function sizeOf(type: number): number {
  if (type === 1 || type === 2 || type === 6 || type === 7) return 1
  if (type === 3 || type === 8) return 2
  if (type === 4 || type === 9 || type === 11) return 4
  if (type === 5 || type === 10 || type === 12) return 8
  return 1
}

function decode(
  tiff: Uint8Array,
  type: number,
  count: number,
  offset: number,
  u16: U16,
  u32: U32,
): IfdValue | undefined {
  if (offset < 0 || offset >= tiff.length) return undefined
  if (type === 2) {
    const end = Math.min(tiff.length, offset + count)
    let s = ''
    for (let i = offset; i < end; i++) {
      const c = tiff[i]!
      if (c === 0) break
      s += String.fromCharCode(c)
    }
    return s
  }
  if (type === 3 && count === 1) return u16(offset)
  if (type === 4 && count === 1) return u32(offset)
  if (type === 5) {
    const nums: number[] = []
    for (let i = 0; i < count; i++) {
      const o = offset + i * 8
      if (o + 8 > tiff.length) break
      const num = u32(o)
      const den = u32(o + 4) || 1
      nums.push(num / den)
    }
    return nums
  }
  return undefined
}

function gpsRational(value: IfdValue | undefined, sign: number): number | null {
  if (!Array.isArray(value) || value.length < 3) return null
  const deg = value[0]!
  const min = value[1]!
  const sec = value[2]!
  const n = deg + min / 60 + sec / 3600
  if (!Number.isFinite(n)) return null
  return sign * n
}

/** EXIF dates are `YYYY:MM:DD HH:MM:SS` with no timezone. Treat as local-wall, emit ISO. */
export function exifDateToIso(raw: string): string | undefined {
  const m = raw.trim().match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (!m) return undefined
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  )
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function ascii(bytes: Uint8Array, start: number, len: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + len))
}
