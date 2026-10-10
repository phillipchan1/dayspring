/**
 * THE CAPTURE CLOCK — every listing shot is taken at the same moment.
 *
 * Imported FIRST by preview.tsx, so it runs before the fixtures (mock.ts, the
 * ledger's synthetic year) read the date. Without it a shot is a function of
 * the day the script happened to run: the year view taken in February has a
 * month in it, and the fixture pages dated "the 27th of this month" land in the
 * future for most of every month.
 *
 * Tuesday 27 October 2026, morning. The 27th is when MOCK_ENTRIES' newest page
 * falls and it is titled "Tuesday", so the date and the title agree wherever a
 * shell shows both. October also closes the synthetic year's prayer for Dad on
 * its answer (Oct 9) rather than mid-wait.
 *
 * Shifted, not frozen: `Date.now()` keeps moving from this instant, so anything
 * that waits on elapsed time (debounces, "saved just now") still behaves.
 * Dev-only — preview.tsx is reached only under `import.meta.env.DEV`.
 */

export const SHOT_NOW = new Date(2026, 9, 27, 7, 40, 0)

const RealDate = Date
const offset = SHOT_NOW.getTime() - RealDate.now()

class ShotDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(RealDate.now() + offset)
    else super(...(args as ConstructorParameters<DateConstructor>))
  }

  static override now(): number {
    return RealDate.now() + offset
  }
}

globalThis.Date = ShotDate as DateConstructor
