import { describe, expect, it } from 'vitest'
import { revealRitualsForDisplay, ritualNamesIn } from './ritualDisplay'

const examen = [
  '<!-- ritual:name:Emotionally Healthy Examen -->',
  '<!-- ritual:section:Feel -->',
  'i felt happy that we are going ot be off this project',
  '<!-- ritual:section:Reveal -->',
  '<!-- ritual:section:Encounter -->',
].join('\n')

describe('revealRitualsForDisplay', () => {
  it('puts the name and the answered movement back, and leaves the rest silent', () => {
    const out = revealRitualsForDisplay(examen)
    expect(out).toContain('<p class="read-ritual-name">Emotionally Healthy Examen</p>')
    expect(out).toContain('<p class="read-ritual-label">Feel</p>')
    expect(out).toContain('i felt happy that we are going ot be off this project')
    expect(out).not.toContain('Reveal')
    expect(out).not.toContain('Encounter')
    expect(out).not.toContain('ritual:name')
    expect(out).not.toContain('ritual:section')
  })

  it('still names an untouched ritual, so the page is not blank', () => {
    const out = revealRitualsForDisplay(
      '<!-- ritual:name:The Daily Examen -->\n<!-- ritual:section:Gratitude -->\n',
    )
    expect(out).toContain('<p class="read-ritual-name">The Daily Examen</p>')
    expect(out).not.toContain('Gratitude')
  })

  it('escapes a name so markup in an old token cannot break the page', () => {
    const out = revealRitualsForDisplay('<!-- ritual:name:A <script> -->\n')
    expect(out).toContain('A &lt;script&gt;')
    expect(out).not.toContain('<script>')
  })

  it('leaves ordinary prose alone', () => {
    expect(revealRitualsForDisplay('just a morning')).toBe('just a morning')
  })
})

describe('ritualNamesIn', () => {
  it('reads every ritual on the page, in order', () => {
    const two = `${examen}\n\n<!-- ritual:name:The Daily Examen -->\n`
    expect(ritualNamesIn(two)).toEqual(['Emotionally Healthy Examen', 'The Daily Examen'])
  })
})
