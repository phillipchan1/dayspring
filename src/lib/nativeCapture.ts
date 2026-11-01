// Native capture on iOS (NATIVE_FEEL_AUDIT §5): VisionKit's document camera
// for page scans and PhotosUI's picker for photos, in place of WebKit's
// `<input type="file">` sheet. Commands live in src-tauri/src/ios_capture.rs.
//
// Both hand back what the web paths already take — `File`s — so the scan
// still goes through `transcribePages` and the photos through the inline
// image popover's `handleFiles`, unchanged.
//
// `null` means "no native path here, use the web one": not the iOS app, a
// device without the scanner (the simulator), or a build whose native side
// predates these commands. An empty array means the writer cancelled.

import { invoke } from '@tauri-apps/api/core'
import { isIOSTauri } from './platform'

export interface CapturedItem {
  mime: string
  bytes: Uint8Array
}

/**
 * Unpack the commands' binary reply: a little-endian u32 count, then for each
 * item a u32-prefixed MIME type and a u32-prefixed body. Raw bytes rather than
 * JSON so a handful of full-size JPEGs cross the bridge without base64.
 */
export function decodeCaptured(payload: ArrayBuffer | Uint8Array | number[]): CapturedItem[] {
  const bytes =
    payload instanceof Uint8Array
      ? payload
      : payload instanceof ArrayBuffer
        ? new Uint8Array(payload)
        : Uint8Array.from(payload)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const items: CapturedItem[] = []
  if (bytes.byteLength < 4) return items
  const count = view.getUint32(0, true)
  let at = 4
  const decoder = new TextDecoder()
  for (let i = 0; i < count; i++) {
    if (at + 4 > bytes.byteLength) break
    const mimeLen = view.getUint32(at, true)
    at += 4
    if (at + mimeLen + 4 > bytes.byteLength) break
    const mime = decoder.decode(bytes.subarray(at, at + mimeLen))
    at += mimeLen
    const bodyLen = view.getUint32(at, true)
    at += 4
    if (at + bodyLen > bytes.byteLength) break
    items.push({ mime, bytes: bytes.slice(at, at + bodyLen) })
    at += bodyLen
  }
  return items
}

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/** Name them the way the alt-text rules already ignore (attachmentCaption.ts). */
export function toFiles(items: CapturedItem[], stem: string): File[] {
  return items.map(
    (item, i) =>
      new File([item.bytes as BlobPart], `${stem}_${i + 1}.${EXTENSION[item.mime] ?? 'jpg'}`, {
        type: item.mime,
      }),
  )
}

/** True where the native capture commands exist: the iOS app. */
export function hasNativeCapture(): boolean {
  return isIOSTauri()
}

let unsupportedScan = false
let scanInFlight: Promise<File[] | null> | null = null
let pickInFlight: Promise<File[] | null> | null = null

/** Whether a scan should even be tried natively (false after one said "unsupported"). */
export function canScanNatively(): boolean {
  return hasNativeCapture() && !unsupportedScan
}

/**
 * Open VisionKit's document camera. Resolves to the scanned pages as JPEG
 * `File`s (deskewed and cropped by VisionKit), `[]` if cancelled, or `null`
 * when the web `<input capture>` path should be used instead.
 */
export function scanPagesNatively(): Promise<File[] | null> {
  if (!canScanNatively()) return Promise.resolve(null)
  scanInFlight ??= invoke<ArrayBuffer>('scan_document_pages')
    .then((reply) => toFiles(decodeCaptured(reply), 'page'))
    .catch((err: unknown) => {
      if (String(err).includes('unsupported')) unsupportedScan = true
      console.warn('[scan] native document camera unavailable', err)
      return null
    })
    .finally(() => {
      scanInFlight = null
    })
  return scanInFlight
}

/**
 * Open the system photo picker (multi-select, images only, in the order
 * tapped). Resolves to the photos as `File`s, `[]` if cancelled, or `null`
 * when the web file input should be used instead. `limit` 0 is unlimited.
 */
export function pickPhotosNatively(limit = 0): Promise<File[] | null> {
  if (!hasNativeCapture()) return Promise.resolve(null)
  pickInFlight ??= invoke<ArrayBuffer>('pick_photos', { limit })
    .then((reply) => toFiles(decodeCaptured(reply), 'photo'))
    .catch((err: unknown) => {
      console.warn('[photos] native picker unavailable', err)
      return null
    })
    .finally(() => {
      pickInFlight = null
    })
  return pickInFlight
}
