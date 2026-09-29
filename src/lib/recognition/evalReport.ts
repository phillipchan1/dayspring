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
): { total: number; per1k: number; per2000: number; perItem: number; allPasses: number; passes: number } {
  const p = Math.max(1, passes)
  const total = totalDollars / p
  const per = entries ? total / entries : 0
  return {
    total,
    per1k: per * 1000,
    per2000: per * 2000,
    perItem: per,
    allPasses: totalDollars,
    passes: p,
  }
}

export type PricedCall = {
  name: string
  model: string
  in: number
  cached: number
  out: number
  reasoning: number
  ms: number
}

export type ModelRates = { inn: number; out: number; cached: number }

export type CostTask = 'harvest' | 'subjects' | 'sentiment' | 'entities' | 'embed' | 'other'

/** Map a `[tokens] name=` to the eval axis that spent it. */
export function taskOf(name: string): CostTask {
  if (name.startsWith('jev_harvest') || name === 'altar_harvest') return 'harvest'
  if (name.startsWith('jev_tag') || name === 'declared_tag') return 'subjects'
  if (name.startsWith('jev_sentiment') || name === 'lab_sentiment') return 'sentiment'
  if (name.startsWith('concordance') || name.includes('extract')) return 'entities'
  if (name.startsWith('embed')) return 'embed'
  return 'other'
}

/**
 * Price one `[tokens]` line.
 * `out` already includes reasoning tokens (OpenAI completion_tokens); do not add them again.
 * Cached input is billed at `rates.cached`, the rest of `in` at `rates.inn`.
 */
export function dollarsForCall(call: PricedCall, rates: ModelRates): number {
  const cached = Math.min(Math.max(0, call.cached), Math.max(0, call.in))
  const uncached = Math.max(0, call.in - cached)
  return (uncached * rates.inn + cached * rates.cached + call.out * rates.out) / 1_000_000
}

export type TaskModelRow = {
  task: CostTask
  model: string
  calls: number
  in: number
  cached: number
  out: number
  reasoning: number
  dollars: number
}

export function breakdownByTaskAndModel(
  calls: PricedCall[],
  ratesFor: (model: string) => ModelRates,
): TaskModelRow[] {
  const acc = new Map<string, TaskModelRow>()
  for (const call of calls) {
    const task = taskOf(call.name)
    const key = `${task}::${call.model}`
    const row = acc.get(key) ?? {
      task,
      model: call.model,
      calls: 0,
      in: 0,
      cached: 0,
      out: 0,
      reasoning: 0,
      dollars: 0,
    }
    row.calls++
    row.in += call.in
    row.cached += call.cached
    row.out += call.out
    row.reasoning += call.reasoning
    row.dollars += dollarsForCall(call, ratesFor(call.model))
    acc.set(key, row)
  }
  return [...acc.values()].sort((a, b) => a.task.localeCompare(b.task) || a.model.localeCompare(b.model))
}

export function dollarsForCalls(
  calls: PricedCall[],
  ratesFor: (model: string) => ModelRates,
  opts: { exclude?: CostTask[] } = {},
): number {
  const skip = new Set(opts.exclude ?? [])
  return calls
    .filter((c) => !skip.has(taskOf(c.name)))
    .reduce((sum, c) => sum + dollarsForCall(c, ratesFor(c.model)), 0)
}
