// Guards the two deterministic gates in the Altar's prose harvest.
//
// HARVEST_CUE is a cost control: an entry it doesn't match never reaches the
// model and is marked scanned, so its recall is a HARD CEILING on the Altar.
// No amount of prompt work recovers a prayer the prefilter refused to open.
// That makes its misses worth naming individually rather than tolerating as a
// rounding error.
//
// isVerbatim is the honesty gate. The Altar holds the writer's own words, and
// a paraphrase there would be Dayspring putting words in someone's mouth about
// their own prayers — so this fails closed.
//
// The prose comes from the shared recognition corpus (src/lib/recognition/),
// where the expected prayers are hand-labeled. Categories used here:
//   prayer-clear             — a prayer the cue should catch
//   prayer-cue-blind         — a genuine prayer the cue misses (the ceiling)
//   prayer-cue-false-positive / prayer-distractor — cue fires, no prayer
//   ordinary                 — no prayer, and the cue should stay quiet

import { describe, expect, it } from 'vitest'
import { HARVEST_CUE, isVerbatim } from './altar.js'
import { CORPUS, corpusFor } from '../../src/lib/recognition/corpus/index.js'
import { scoreCuePrefilter } from '../../src/lib/recognition/score.js'

// Raise when a cue miss is fixed. Never lower.
//   2026-07-31  0.774  first measurement
//   2026-08-01  0.839  added father/abba/almighty/saviour
// The remaining ~0.16 is a ceiling, not a gap: those prayers name God nowhere,
// and a regex wide enough to catch them would fire on most of a journal. See the
// note on HARVEST_CUE in altar.ts for the alternative worth considering.
const CUE_RECALL_FLOOR = 0.83

const byId = (id: string) => CORPUS.find((e) => e.id === id)!
const fires = (text: string) => HARVEST_CUE.test(text)

describe('HARVEST_CUE', () => {
  it('opens every entry that holds a prayer it can see', () => {
    const missed = corpusFor('passages')
      .filter((e) => e.category === 'prayer-clear' && (e.passages ?? []).length > 0)
      .filter((e) => !fires(e.body))
      .map((e) => e.id)
    expect(missed).toEqual([])
  })

  it('stays quiet on ordinary prose', () => {
    // Every spurious match is a model call billed for a shopping list.
    const spurious = CORPUS.filter((e) => e.category === 'ordinary')
      .filter((e) => fires(e.body))
      .map((e) => e.id)
    expect(spurious).toEqual([])
  })

  it('REGRESSION (cue-blind-prayer): misses genuine prayers with no cue word', () => {
    // These are real prayers. The prefilter marks each entry scanned and the
    // model never sees it, so they can never reach the Altar. Frozen so that
    // widening the cue is a visible, deliberate act.
    const blind = CORPUS.filter((e) => e.category === 'prayer-cue-blind')
    expect(blind.length).toBeGreaterThan(0)
    for (const e of blind) {
      expect(fires(e.body), `${e.id} should be invisible to the cue`).toBe(false)
      expect((e.passages ?? []).length, `${e.id} should still hold a real prayer`).toBeGreaterThan(0)
    }
  })

  it('opens a prayer addressed to the Father', () => {
    // Until 2026-08-01 the list had 'holy spirit' but no term for 'father', so
    // a prayer opening "Father," was marked scanned and never read while the
    // identical prayer opening "Lord," was kept. Guard against losing it again.
    for (const address of ['Father', 'Abba', 'Almighty God', 'Saviour', 'Savior', 'Lord']) {
      expect(fires(`${address}, I don’t know how to lead this well.`), address).toBe(true)
    }
    expect(fires(byId('pra-clear-03').body)).toBe(true)
  })

  it('meets the recall floor, and names what it costs when it does not', () => {
    const score = scoreCuePrefilter(fires)
    expect(score.recall, `prayers the cue cannot see: ${score.missedIn.join(', ')}`).toBeGreaterThanOrEqual(
      CUE_RECALL_FLOOR,
    )
  })

  it('is generous by design, so its false positives are spend and not error', () => {
    // A cue-positive entry with no prayer costs one model call and yields
    // nothing — that is the intended trade, not a bug. Reported, never gated.
    const score = scoreCuePrefilter(fires)
    expect(score.fp).toBeGreaterThan(0)
    expect(score.precision).toBeLessThan(1)
  })
})

describe('isVerbatim', () => {
  const body = 'Lord, be near her tonight\nin the way she actually needs.'

  it('accepts an exact substring', () => {
    expect(isVerbatim(body, 'be near her tonight')).toBe(true)
  })

  it('accepts a span whose whitespace differs from the body', () => {
    // The corpus relies on this: a prayer that spans a line break is still the
    // writer's own contiguous words.
    expect(isVerbatim(body, 'be near her tonight in the way she actually needs.')).toBe(true)
  })

  it('rejects a paraphrase, however faithful', () => {
    expect(isVerbatim(body, 'be close to her this evening')).toBe(false)
  })

  it('rejects empty text', () => {
    expect(isVerbatim(body, '')).toBe(false)
  })

  it('accepts every hand-labeled passage in the corpus', () => {
    // If this ever fails, the corpus is lying and every prayer score with it —
    // the model would be marked wrong for returning the right span.
    const broken = corpusFor('passages').flatMap((e) =>
      (e.passages ?? []).filter((p) => !isVerbatim(e.body, p.text)).map((p) => `${e.id}: ${p.text.slice(0, 50)}`),
    )
    expect(broken).toEqual([])
  })
})
