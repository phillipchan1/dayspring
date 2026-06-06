// Caption helpers — keep Photos.app export names out of the writing surface.

/** True when alt text is worth showing under a photo (user-written, not a blob id). */
export function isMeaningfulCaption(alt: string): boolean {
  const t = alt.trim()
  if (!t) return false
  // macOS Photos / UUID export stems: 3771707B-2E6A-4B47-BEFF-3F75866F8F42_1_105_c
  if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/i.test(t)) return false
  if (/^(?:IMG_|DSC|PXL_|photo_|image_?\d)/i.test(t)) return false
  // Long machine-ish tokens without spaces
  if (t.length > 36 && /^[a-zA-Z0-9_-]+$/.test(t)) return false
  return true
}

/** Alt text for a new upload — empty unless the filename is human-readable. */
export function altFromFile(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, '').trim()
  return isMeaningfulCaption(base) ? base : ''
}

/** Best-effort capture time: EXIF would be ideal; lastModified beats a UUID caption. */
export function takenAtFromFile(file: File): string | undefined {
  if (file.lastModified > 0) return new Date(file.lastModified).toISOString()
  return undefined
}

export interface AttachmentPhotoMeta {
  takenAt?: string
}

/** Mono subtitle under a photo — weekday, date, and time in the user's locale. */
export function formatPhotoMetaLine(meta: AttachmentPhotoMeta | undefined): string | null {
  if (!meta?.takenAt) return null
  const d = new Date(meta.takenAt)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
