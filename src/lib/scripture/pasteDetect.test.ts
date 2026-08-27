import { describe, expect, it } from 'vitest'
import { detectScripturePaste } from './pasteDetect'

const JAMES = 'Draw near to God, and he will draw near to you. Cleanse your hands, you sinners, and purify your hearts, you double-minded.'

describe('detectScripturePaste', () => {
  it('wraps a bible.com-shaped paste (verse then citation)', () => {
    const hit = detectScripturePaste(`${JAMES}\n\nJames 4:8 ESV`)
    expect(hit).toEqual({ body: JAMES, reference: 'James 4:8' })
  })

  it('wraps a YouVersion-shaped paste with a translation footer', () => {
    const raw = `${JAMES}\n\nJames 4:8\nEnglish Standard Version\n© Crossway`
    expect(detectScripturePaste(raw)).toEqual({ body: JAMES, reference: 'James 4:8' })
  })

  it('keeps NIV wording and does not claim ESV', () => {
    const niv =
      'Come near to God and he will come near to you. Wash your hands, you sinners, and purify your hearts, you double-minded.'
    expect(detectScripturePaste(`${niv}\n\nJames 4:8 NIV`)).toEqual({
      body: niv,
      reference: 'James 4:8',
    })
  })

  it('accepts citation-first pastes', () => {
    expect(detectScripturePaste(`James 4:8\n${JAMES}`)).toEqual({
      body: JAMES,
      reference: 'James 4:8',
    })
  })

  it('refuses a chapter-only dump', () => {
    const body = 'In the beginning, God created the heavens and the earth. '.repeat(8)
    expect(detectScripturePaste(`${body}\n\nGenesis 1 ESV`)).toBeNull()
  })

  it('refuses a body that is too long to be a verse paste', () => {
    const body = `${JAMES} `.repeat(40)
    expect(body.length).toBeGreaterThan(2000)
    expect(detectScripturePaste(`${body}\nJames 4:8`)).toBeNull()
  })

  it('refuses prose that merely mentions a verse', () => {
    expect(
      detectScripturePaste('I sat with James 4:8 this morning and thought about drawing near.'),
    ).toBeNull()
    expect(
      detectScripturePaste(
        'I sat with James 4:8 this morning.\n\nSomething else happened at work later.',
      ),
    ).toBeNull()
  })
})
