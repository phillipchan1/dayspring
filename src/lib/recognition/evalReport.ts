/**
 * Helpers for recognition-eval reports. Lab only — not imported by production paths.
 */

export function mean(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

export function meanScore<
  T extends { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number },
>(rows: T[]): T {
  if (rows.length === 0) {
    return { tp: 0, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 } as T
  }
  if (rows.length === 1) return { ...rows[0]! }
  const n = rows.length
  const avg = (k: 'tp' | 'fp' | 'fn' | 'precision' | 'recall' | 'f1') =>
    rows.reduce((s, r) => s + r[k], 0) / n
  return {
    ...rows[0]!,
    tp: avg('tp'),
    fp: avg('fp'),
    fn: avg('fn'),
    precision: avg('precision'),
    recall: avg('recall'),
    f1: avg('f1'),
  }
}

/** Tokens accumulate across reruns; $/1k and $/2k must be per corpus pass. */
export function costPerPass(
  totalDollars: number,
  entries: number,
  passes: number,
): { total: number; per1k: number; per2000: number; allPasses: number; passes: number } {
  const p = Math.max(1, passes)
  const total = totalDollars / p
  const per = entries ? total / entries : 0
  return { total, per1k: per * 1000, per2000: per * 2000, allPasses: totalDollars, passes: p }
}
