// Client-side image prep before upload — resize large photos and re-encode
// heavy JPEG/PNG/WebP files. GIFs are left alone (animation).

const MAX_EDGE = 2400
const COMPRESS_ABOVE_BYTES = 400_000
const JPEG_QUALITY = 0.82

function isCompressibleImage(file: File): boolean {
  if (!file.type.startsWith('image/')) return false
  if (file.type === 'image/gif') return false
  return true
}

/** Resize and re-encode when worthwhile; otherwise return the original file. */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (!isCompressibleImage(file)) return file

  try {
    const bitmap = await createImageBitmap(file)
    const longEdge = Math.max(bitmap.width, bitmap.height)
    const scale = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1
    const needsResize = scale < 1
    const needsCompress = file.size > COMPRESS_ABOVE_BYTES

    if (!needsResize && !needsCompress) {
      bitmap.close()
      return file
    }

    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })
    if (!blob || blob.size >= file.size) return file

    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
