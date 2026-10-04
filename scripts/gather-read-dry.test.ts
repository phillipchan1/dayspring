// The dry run's arithmetic. The numbers it prints decide whether GATHER_READ goes
// on, so the estimator is pinned on its own, away from the database and the model.

import { describe, expect, it } from 'vitest'
import { dollars, estimate, PER_TICK, project, tokensFor } from './gather-read-dry.ts'

describe('estimate', () => {
  it('counts a call per readable page and none for a page too short to read', () => {
    const est = estimate(
      [
        { textChars: 4000, vocabChars: 400 },
        { textChars: 20, vocabChars: 0 },
        { textChars: 800, vocabChars: 0 },
      ],
      8000,
    )
    expect(est).toMatchObject({ pages: 3, free: 1, calls: 2 })
    // the system prompt rides on every call
    expect(est.inputTokens).toBe(tokensFor(8000 + 4000 + 400) + 30 + tokensFor(8000 + 800) + 30)
    expect(est.outputTokensGuess).toBe(Math.round(1000 * 0.5) + 250 + Math.round(200 * 0.5) + 250)
  })

  it('never guesses past the read’s output ceiling', () => {
    expect(estimate([{ textChars: 80_000, vocabChars: 0 }], 0).outputTokensGuess).toBe(4096)
  })

  it('reports how long the engine takes to drain it', () => {
    expect(estimate(Array.from({ length: PER_TICK * 3 + 1 }, () => ({ textChars: 100, vocabChars: 0 })), 0).minutes).toBe(4)
  })
})

describe('project / dollars', () => {
  it('scales what the sample measured to the backlog', () => {
    expect(project({ calls: 10, in: 50_000, cached: 0, out: 20_000, reasoning: 5_000 }, 1000)).toEqual({
      in: 5_000_000,
      out: 2_000_000,
    })
  })

  it('projects nothing from no calls', () => {
    expect(project({ calls: 0, in: 0, cached: 0, out: 0, reasoning: 0 }, 1000)).toEqual({ in: 0, out: 0 })
  })

  it('prices only when both rates are given', () => {
    expect(dollars({ in: 2_000_000, out: 1_000_000 }, 0.5, 2)).toBeCloseTo(3)
    expect(dollars({ in: 2_000_000, out: 1_000_000 }, 0.5)).toBeNull()
  })
})
