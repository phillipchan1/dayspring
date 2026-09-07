import type { ImageSize } from './attachments'

// Crop only genuinely extreme aspect ratios. Normal phone photos render whole;
// tall screenshots and panoramas are reined in at Small and Medium sizes.
const MAX_PORTRAIT_RATIO = 2 / 3
const MAX_LANDSCAPE_RATIO = 16 / 9

export type CropPlan = { aspect: string; axis: 'height' | 'width' } | null

/** Shared by the editor widget and the rendered page reader. */
export function cropFor(
  size: ImageSize,
  width?: number,
  height?: number,
): CropPlan {
  if (size === 'f' || !width || !height) return null
  const ratio = width / height
  if (ratio < MAX_PORTRAIT_RATIO) return { aspect: '2 / 3', axis: 'height' }
  if (ratio > MAX_LANDSCAPE_RATIO) return { aspect: '16 / 9', axis: 'width' }
  return null
}
