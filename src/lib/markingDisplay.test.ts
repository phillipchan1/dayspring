// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'
import { revealMarkingsForDisplay } from './markingDisplay'

const ID = 'a5ffae34-0420-4263-9780-19b843e7ffc5'
const ID2 = 'b5ffae34-0420-4263-9780-19b843e7ffc5'

const render = (md: string) => {
  const el = document.createElement('div')
  el.innerHTML = renderMarkdown(md, { asTitle: false })
  return el
}

describe('revealMarkingsForDisplay', () => {
  it('leaves a page with no markings exactly as it was', () => {
    const md = 'Just a morning.\n\nNothing marked.'
    expect(revealMarkingsForDisplay(md)).toBe(md)
  })

  it('drops an empty block rather than drawing an empty box', () => {
    const md = `Before\n\`\`\`dayspring-pray ${ID}\n\n\`\`\`\nAfter`
    expect(revealMarkingsForDisplay(md)).not.toContain('data-kind')
  })
})

describe('renderMarkdown — marking blocks, read back in place', () => {
  it('sets a verse apart where it was written, with its citation', () => {
    const el = render(
      [
        'thank you for your promises',
        '',
        `\`\`\`dayspring-scripture ${ID}`,
        'The steadfast love of the LORD never ceases; his mercies never come to an end.',
        'Lamentations 3:22–23 · ESV',
        '```',
        'your mercies are new every morning.',
      ].join('\n'),
    )
    const fig = el.querySelector('figure.read-scripture')!
    expect(fig.getAttribute('data-kind')).toBe('scripture')
    expect(fig.querySelector('p')!.textContent).toContain('The steadfast love of the LORD')
    expect(fig.querySelector('figcaption')!.textContent).toBe('Lamentations 3:22–23 · ESV')
    // In order, between the two sentences it was written between.
    const text = el.textContent!
    expect(text.indexOf('promises')).toBeLessThan(text.indexOf('steadfast'))
    expect(text.indexOf('steadfast')).toBeLessThan(text.indexOf('new every morning'))
    // The sentence under the verse is still a paragraph of its own, not
    // swallowed into the HTML block as raw text.
    expect([...el.querySelectorAll(':scope > p')].map((p) => p.textContent)).toContain(
      'your mercies are new every morning.',
    )
    expect(el.innerHTML).not.toContain('dayspring-')
    expect(el.querySelector('code, pre')).toBeNull()
  })

  it('never reads a verse as markdown', () => {
    const el = render(`\`\`\`dayspring-scripture ${ID}\n1. In the *beginning*\nGenesis 1:1 · ESV\n\`\`\``)
    expect(el.querySelector('ol, em')).toBeNull()
    expect(el.querySelector('figure p')!.textContent).toBe('1. In the *beginning*')
  })

  it('escapes a verse rather than trusting it', () => {
    const el = render(`\`\`\`dayspring-scripture ${ID}\n<img src=x onerror=alert(1)>\nPsalm 1:1\n\`\`\``)
    expect(el.querySelector('img')).toBeNull()
  })

  it('keeps a prayer as the writer’s own prose, markdown and all, naming its kind', () => {
    const el = render(`Morning.\n\`\`\`dayspring-pray ${ID}\nLord, give me **patience** today.\n\`\`\`\nThen coffee.`)
    const mark = el.querySelector('.read-mark')!
    expect(mark.getAttribute('data-kind')).toBe('prayer')
    expect(mark.querySelector('strong')!.textContent).toBe('patience')
    expect(el.textContent).toContain('Then coffee.')
  })

  it('reads a marking inside a ritual answer in the right place', () => {
    const el = render(
      [
        '<!-- ritual:name:The Daily Examen -->',
        '<!-- ritual:section:Gratitude -->',
        'For the walk.',
        `\`\`\`dayspring-scripture ${ID}`,
        'Be still, and know that I am God.',
        'Psalm 46:10 · ESV',
        '```',
        '<!-- ritual:section:Prayer -->',
        `\`\`\`dayspring-pray ${ID2}`,
        'Patience for the first hour.',
        '```',
      ].join('\n'),
    )
    const kids = [...el.children]
    const label = kids.findIndex((k) => k.textContent === 'Prayer')
    const fig = kids.findIndex((k) => k.matches('figure'))
    const pray = kids.findIndex((k) => k.matches('.read-mark'))
    expect(fig).toBeGreaterThan(-1)
    expect(fig).toBeLessThan(label)
    expect(pray).toBeGreaterThan(label)
    expect(el.textContent).not.toContain('ritual:')
  })
})
