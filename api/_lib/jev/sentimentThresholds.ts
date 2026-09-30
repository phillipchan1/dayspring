/**
 * Per-emotion probability thresholds for Jev sentiment.
 * Fit on the **dev** split only; apply to test. Lab only.
 */

import { EMOTIONS, type Emotion } from '../keepingRead.js'

export const DEFAULT_EMOTION_THRESHOLD = 0.5
/** Denial is asked for any emotion at or above this floor so later re-thresholding stays honest. */
export const DENIAL_CANDIDATE_FLOOR = 0.25
export const MIN_POSITIVES_TO_FIT = 3

export const THRESHOLD_GRID: readonly number[] = [
  0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9,
]

export interface EmotionThresholdRow {
  threshold: number
  f1: number
  precision: number
  recall: number
  tp: number
  fp: number
  fn: number
  positives: number
  fitted: boolean
}

export interface FittedEmotionThresholds {
  fittedOn: 'dev'
  variant: string
  default: number
  minPositives: number
  nDev: number
  fittedAt: string
  byEmotion: Record<Emotion, EmotionThresholdRow>
}

export interface EmotionProbSample {
  id: string
  gold: readonly string[]
  probs: Partial<Record<string, number>>
}

export function f1FromCounts(tp: number, fp: number, fn: number): {
  precision: number
  recall: number
  f1: number
} {
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn)
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  return { precision, recall, f1 }
}

export function countsAtThreshold(
  labels: readonly { p: number; gold: boolean }[],
  threshold: number,
): { tp: number; fp: number; fn: number } {
  let tp = 0
  let fp = 0
  let fn = 0
  for (const row of labels) {
    const pred = row.p >= threshold
    if (row.gold && pred) tp++
    else if (!row.gold && pred) fp++
    else if (row.gold && !pred) fn++
  }
  return { tp, fp, fn }
}

/**
 * Max-F1 threshold on `labels`. Ties: closer to the default bar, then higher
 * (more conservative). Fewer than `minPositives` gold hits keeps the default.
 */
export function bestThreshold(
  labels: readonly { p: number; gold: boolean }[],
  opts: { defaultThreshold?: number; grid?: readonly number[]; minPositives?: number } = {},
): EmotionThresholdRow {
  const defaultThreshold = opts.defaultThreshold ?? DEFAULT_EMOTION_THRESHOLD
  const grid = opts.grid ?? THRESHOLD_GRID
  const minPositives = opts.minPositives ?? MIN_POSITIVES_TO_FIT
  const positives = labels.filter((r) => r.gold).length
  const empty: EmotionThresholdRow = {
    threshold: defaultThreshold,
    f1: 0,
    precision: 1,
    recall: positives === 0 ? 1 : 0,
    tp: 0,
    fp: 0,
    fn: positives,
    positives,
    fitted: false,
  }
  if (positives < minPositives) {
    const c = countsAtThreshold(labels, defaultThreshold)
    const s = f1FromCounts(c.tp, c.fp, c.fn)
    return { ...empty, ...c, ...s, fitted: false }
  }

  let best: EmotionThresholdRow | null = null
  for (const threshold of grid) {
    const c = countsAtThreshold(labels, threshold)
    const s = f1FromCounts(c.tp, c.fp, c.fn)
    const row: EmotionThresholdRow = { threshold, ...s, ...c, positives, fitted: true }
    if (!best || betterThreshold(row, best, defaultThreshold)) best = row
  }
  return best ?? empty
}

function betterThreshold(a: EmotionThresholdRow, b: EmotionThresholdRow, fallback: number): boolean {
  if (a.f1 !== b.f1) return a.f1 > b.f1
  const da = Math.abs(a.threshold - fallback)
  const db = Math.abs(b.threshold - fallback)
  if (da !== db) return da < db
  return a.threshold > b.threshold
}

export function fitEmotionThresholds(
  samples: readonly EmotionProbSample[],
  opts: { variant?: string; defaultThreshold?: number; minPositives?: number } = {},
): FittedEmotionThresholds {
  const defaultThreshold = opts.defaultThreshold ?? DEFAULT_EMOTION_THRESHOLD
  const minPositives = opts.minPositives ?? MIN_POSITIVES_TO_FIT
  const byEmotion = {} as Record<Emotion, EmotionThresholdRow>
  for (const emo of EMOTIONS) {
    const labels = samples.map((s) => ({
      p: s.probs[emo] ?? 0,
      gold: s.gold.includes(emo),
    }))
    byEmotion[emo] = bestThreshold(labels, { defaultThreshold, minPositives })
  }
  return {
    fittedOn: 'dev',
    variant: opts.variant ?? 'baseline',
    default: defaultThreshold,
    minPositives,
    nDev: samples.length,
    fittedAt: new Date().toISOString(),
    byEmotion,
  }
}

export function thresholdFor(
  emo: Emotion,
  fitted: FittedEmotionThresholds | null | undefined,
  fallback = DEFAULT_EMOTION_THRESHOLD,
): number {
  return fitted?.byEmotion[emo]?.threshold ?? fitted?.default ?? fallback
}

export function applyEmotionThresholds(
  probs: Partial<Record<string, number>>,
  fitted: FittedEmotionThresholds | null | undefined,
  fallback = DEFAULT_EMOTION_THRESHOLD,
): Emotion[] {
  const out: Emotion[] = []
  for (const emo of EMOTIONS) {
    const p = probs[emo] ?? 0
    if (p >= thresholdFor(emo, fitted, fallback)) out.push(emo)
  }
  return out
}

export function finalizeEmotions(opts: {
  present: boolean
  probs: Partial<Record<string, number>>
  denied?: readonly string[]
  primary?: string | null
  thresholds?: FittedEmotionThresholds | null
  defaultThreshold?: number
  max?: number
}): Emotion[] {
  const max = opts.max ?? 4
  if (!opts.present) return []
  const denied = new Set(opts.denied ?? [])
  const fallback = opts.defaultThreshold ?? DEFAULT_EMOTION_THRESHOLD
  const ranked: { emo: Emotion; p: number }[] = []
  for (const emo of EMOTIONS) {
    if (denied.has(emo)) continue
    const p = opts.probs[emo] ?? 0
    if (p >= thresholdFor(emo, opts.thresholds, fallback)) ranked.push({ emo, p })
  }
  ranked.sort((a, b) => b.p - a.p)
  const out = ranked.map((r) => r.emo)
  const primary = opts.primary
  if (
    primary &&
    primary !== 'none' &&
    (EMOTIONS as readonly string[]).includes(primary) &&
    !out.includes(primary as Emotion) &&
    !denied.has(primary)
  ) {
    out.unshift(primary as Emotion)
  }
  return out.slice(0, max)
}

export function emptyFittedThresholds(
  overrides: Partial<Record<Emotion, number>> = {},
  meta: Partial<Pick<FittedEmotionThresholds, 'variant' | 'nDev' | 'fittedAt'>> = {},
): FittedEmotionThresholds {
  const byEmotion = {} as Record<Emotion, EmotionThresholdRow>
  for (const emo of EMOTIONS) {
    const threshold = overrides[emo] ?? DEFAULT_EMOTION_THRESHOLD
    byEmotion[emo] = {
      threshold,
      f1: 0,
      precision: 1,
      recall: 1,
      tp: 0,
      fp: 0,
      fn: 0,
      positives: 0,
      fitted: overrides[emo] !== undefined,
    }
  }
  return {
    fittedOn: 'dev',
    variant: meta.variant ?? 'thresholds',
    default: DEFAULT_EMOTION_THRESHOLD,
    minPositives: MIN_POSITIVES_TO_FIT,
    nDev: meta.nDev ?? 0,
    fittedAt: meta.fittedAt ?? '2026-09-29T00:00:00.000Z',
    byEmotion,
  }
}

export function barsFromFitted(
  fitted: FittedEmotionThresholds | null | undefined,
  fallback = DEFAULT_EMOTION_THRESHOLD,
): Record<Emotion, number> {
  const out = {} as Record<Emotion, number>
  for (const emo of EMOTIONS) out[emo] = thresholdFor(emo, fitted, fallback)
  return out
}
