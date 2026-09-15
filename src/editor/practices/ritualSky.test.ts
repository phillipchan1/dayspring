import { describe, expect, it } from 'vitest'
import { SKIES, bandForHour, skyFor, type SkyBand } from './ritualSky'
import { PRACTICES, SHELF } from './practicesData'

describe('bandForHour', () => {
  it('covers all twenty-four hours with no gap', () => {
    for (let h = 0; h < 24; h++) {
      expect(SKIES[bandForHour(h)]).toBeDefined()
    }
  })

  it('puts the boundaries where the copy claims they are', () => {
    // 3am is still night — the band that says "if you want them".
    expect(bandForHour(3)).toBe('night')
    expect(bandForHour(4)).toBe('dawn')
    expect(bandForHour(10)).toBe('dawn')
    expect(bandForHour(11)).toBe('midday')
    expect(bandForHour(16)).toBe('midday')
    expect(bandForHour(17)).toBe('evening')
    expect(bandForHour(21)).toBe('evening')
    expect(bandForHour(22)).toBe('night')
  })

  it('wraps midnight into night rather than falling through to dawn', () => {
    expect(bandForHour(23)).toBe('night')
    expect(bandForHour(0)).toBe('night')
    expect(bandForHour(1)).toBe('night')
  })
})

describe('skyFor', () => {
  it('reads local time, not UTC', () => {
    // Constructed from local parts on purpose: a writer's 6am is their own.
    const sixAm = new Date(2026, 8, 10, 6, 0, 0)
    expect(skyFor(sixAm).band).toBe('dawn')
    const elevenPm = new Date(2026, 8, 10, 23, 30, 0)
    expect(skyFor(elevenPm).band).toBe('night')
  })
})

describe('the skies themselves', () => {
  const bands = Object.keys(SKIES) as SkyBand[]

  it('each carries a complete token set', () => {
    for (const band of bands) {
      const { tokens } = SKIES[band]
      expect(tokens['--sky-pos']).toBeTruthy()
      expect(tokens['--sky-size']).toBeTruthy()
      expect(tokens['--sky-near']).toBeTruthy()
      expect(tokens['--sky-far']).toBeTruthy()
    }
  })

  it('opens on a rhythm that actually has rituals on the shelf', () => {
    for (const band of bands) {
      const filter = SKIES[band].filter
      const matching = SHELF.filter((p) => p.rhythm.includes(filter))
      expect(matching.length, `${band} → ${filter}`).toBeGreaterThan(0)
    }
  })

  it('never opens on `weekly` — The Round belongs to no hour', () => {
    for (const band of bands) {
      expect(SKIES[band].filter).not.toBe('weekly')
    }
  })

  it('greets the clock without making a claim about the writer', () => {
    // A guard against the copy drifting into habit language, which is the
    // streak Principle 2 refuses. If a greeting ever needs one of these words,
    // that is a product decision and belongs in DECISIONS.md first.
    const forbidden = /\b(streak|usually|always|again|still|haven'?t|never|days? in a row|missed)\b/i
    for (const band of bands) {
      const { greeting, because } = SKIES[band]
      expect(forbidden.test(greeting), `${band} greeting: ${greeting}`).toBe(false)
      expect(forbidden.test(because), `${band} because: ${because}`).toBe(false)
    }
  })
})

describe('the shelf', () => {
  it('hides retired practices from the library', () => {
    expect(SHELF.some((p) => p.retired)).toBe(false)
    expect(SHELF.length).toBeLessThan(PRACTICES.length)
  })

  it('keeps retired practices in PRACTICES so old entries still render', () => {
    // The whole point of the flag: the archive reads its questions out of
    // PRACTICE_BY_NAME, which is built from PRACTICES.
    const retired = PRACTICES.filter((p) => p.retired).map((p) => p.name)
    expect(retired).toContain('Emotionally Healthy Examen')
    expect(retired).toContain('Then vs. Now')
    for (const name of retired) {
      const practice = PRACTICES.find((p) => p.name === name)
      expect(practice?.prompts.length).toBeGreaterThan(0)
    }
  })

  it('offers a morning ritual that needs no passage in hand', () => {
    // The gap this whole change exists to close: every morning ritual used to
    // open by asking what passage you were bringing.
    const morning = SHELF.filter((p) => p.rhythm.includes('morning'))
    const scriptureFirst = /passage|scripture|verse|commandment|line are you praying/i
    const standalone = morning.filter((p) => !scriptureFirst.test(p.prompts[0]!.question))
    expect(standalone.length).toBeGreaterThanOrEqual(2)
  })
})
