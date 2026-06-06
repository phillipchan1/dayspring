import { describe, expect, it } from 'vitest'
import { buildPracticeBlock } from './usePracticeInsertion'
import { PRACTICES } from './practicesData'

const examen = PRACTICES.find((p) => p.name === 'The Daily Examen')!

describe('buildPracticeBlock', () => {
  it('embeds the practice name and a section token per prompt', () => {
    const { text } = buildPracticeBlock(examen, '', 0)
    expect(text).toContain('<!-- practice:name:The Daily Examen -->')
    for (const prompt of examen.prompts) {
      expect(text).toContain(`<!-- practice:section:${prompt.label} -->`)
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
    const firstSection = `<!-- practice:section:${examen.prompts[0]!.label} -->\n`
    const expected = `<!-- practice:name:The Daily Examen -->\n`.length + firstSection.length
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
    expect(text.startsWith('<!-- practice:name:')).toBe(true)
  })
})
