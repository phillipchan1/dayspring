import { describe, expect, it } from 'vitest'
import {
  buildPracticeBlock,
  describeRitualLanding,
  dissolvePracticeProse,
  findPracticeBlockAt,
} from './usePracticeInsertion'
import { PRACTICES } from './practicesData'

const examen = PRACTICES.find((p) => p.name === 'The Daily Examen')!

/** The raw markdown a freshly-begun practice produces, at the doc start. */
function seeded(practice = examen): string {
  return buildPracticeBlock(practice, '', 0).text
}

describe('buildPracticeBlock', () => {
  it('embeds the practice name and a section token per prompt', () => {
    const { text } = buildPracticeBlock(examen, '', 0)
    expect(text).toContain('<!-- ritual:name:The Daily Examen -->')
    for (const prompt of examen.prompts) {
      expect(text).toContain(`<!-- ritual:section:${prompt.label} -->`)
    }
  })

  it('never persists the prompt label or question as plain text', () => {
    const { text } = buildPracticeBlock(examen, '', 0)
    // Questions are display-only decorations — only tokens reach the document.
    for (const prompt of examen.prompts) {
      expect(text).not.toContain(prompt.question)
      expect(text).not.toContain(prompt.placeholder)
    }
  })

  it('places the caret on the first blank answer line', () => {
    const { text, cursorOffset } = buildPracticeBlock(examen, '', 0)
    const firstSection = `<!-- ritual:section:${examen.prompts[0]!.label} -->\n`
    const expected = `<!-- ritual:name:The Daily Examen -->\n`.length + firstSection.length
    expect(cursorOffset).toBe(expected)
    // The character at the caret is the newline of the (empty) answer line.
    expect(text[cursorOffset]).toBe('\n')
  })

  it('prepends a newline when inserting mid-line, shifting the caret', () => {
    const doc = 'some words'
    const flush = buildPracticeBlock(examen, doc, doc.length)
    expect(flush.text.startsWith('\n')).toBe(true)
    // Caret offset accounts for the leading break.
    expect(flush.text[flush.cursorOffset]).toBe('\n')
  })

  it('does not prepend a newline at the start of a line', () => {
    const { text } = buildPracticeBlock(examen, 'line\n', 5)
    expect(text.startsWith('<!-- ritual:name:')).toBe(true)
  })
})

describe('findPracticeBlockAt', () => {
  it('reports an untouched template as empty (so re-/practice swaps it)', () => {
    const doc = seeded()
    const block = findPracticeBlockAt(doc, 0)
    expect(block).not.toBeNull()
    expect(block!.empty).toBe(true)
    expect(block!.from).toBe(0)
  })

  it('reports a started template as non-empty (so re-/practice appends)', () => {
    const base = seeded()
    // Write into the first answer line (right after the first section token).
    const at = base.indexOf('\n', base.indexOf('section:Gratitude')) + 1
    const doc = base.slice(0, at) + 'thankful for coffee' + base.slice(at)
    const block = findPracticeBlockAt(doc, at)
    expect(block!.empty).toBe(false)
  })

  it('returns null outside any practice block', () => {
    expect(findPracticeBlockAt('just some free writing', 4)).toBeNull()
  })
})

describe('dissolvePracticeProse', () => {
  it('keeps only the written words, dropping all scaffolding', () => {
    const lines = [
      '<!-- practice:name:The Daily Examen -->',
      '<!-- practice:section:Gratitude -->',
      'grateful for the rain',
      '<!-- practice:section:Awareness -->',
      'felt distant at lunch',
    ]
    expect(dissolvePracticeProse(lines)).toBe('grateful for the rain\n\nfelt distant at lunch')
  })

  it('drops skipped (empty) sections entirely', () => {
    const lines = [
      '<!-- practice:name:The Daily Examen -->',
      '<!-- practice:section:Gratitude -->',
      'grateful for the rain',
      '<!-- practice:section:Awareness -->',
      '',
      '<!-- practice:section:Prayer -->',
      'help me rest',
    ]
    expect(dissolvePracticeProse(lines)).toBe('grateful for the rain\n\nhelp me rest')
  })

  it('returns empty prose when nothing was written', () => {
    expect(dissolvePracticeProse(seeded().split('\n'))).toBe('')
  })
})

describe('describeRitualLanding', () => {
  it('says nothing on a page with nothing on it', () => {
    expect(describeRitualLanding('', 0)).toBeNull()
    expect(describeRitualLanding('   \n\n', 2)).toBeNull()
  })

  it('names the seam when there is writing above', () => {
    const doc = 'Third night in a row I have woken at three.\n'
    expect(describeRitualLanding(doc, doc.length)).toBe(
      'Begins below what you’ve written, where the entry turned.',
    )
  })

  it('names the ritual it will append below', () => {
    const doc = `${seeded()}`.replace(
      '<!-- ritual:section:Gratitude -->\n',
      '<!-- ritual:section:Gratitude -->\nThe long walk.\n',
    )
    expect(describeRitualLanding(doc, doc.length - 1)).toBe('Begins below The Daily Examen.')
  })

  it('says it will replace a ritual nobody has written in', () => {
    const doc = seeded()
    expect(describeRitualLanding(doc, doc.length - 1)).toBe(
      'Replaces the ritual you haven’t written in yet.',
    )
  })
})
