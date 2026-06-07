import { describe, expect, it } from 'vitest'
import {
  ensureBlockSeparation,
  formatSpiritualBlock,
  isSpiritualFenceLine,
  parseSpiritualBlocks,
  stripSpiritualBlocks,
} from './spiritualBlocks'

const UUID = '0123abcd-0123-0123-0123-0123456789ab'

describe('formatSpiritualBlock', () => {
  it('round-trips a prayer block', () => {
    const md = formatSpiritualBlock('prayer', UUID, 'help me focus')
    const [block] = parseSpiritualBlocks(md)
    expect(block).toMatchObject({ type: 'prayer', id: UUID, content: 'help me focus', reference: null })
  })

  it('carries a scripture reference on its own line', () => {
    const md = formatSpiritualBlock('scripture', UUID, 'For God so loved…', 'John 3:16')
    const [block] = parseSpiritualBlocks(md)
    expect(block).toMatchObject({ type: 'scripture', content: 'For God so loved…', reference: 'John 3:16' })
  })
})

describe('parseSpiritualBlocks', () => {
  it('reports byte-accurate offsets into the source', () => {
    const block = formatSpiritualBlock('sense', UUID, 'a still small voice')
    const md = `before\n\n${block}\n\nafter`
    const [parsed] = parseSpiritualBlocks(md)
    // `from` is the fence start; `to` runs through the closing fence (and, for a
    // mid-document block, the newline that terminates it).
    expect(md.slice(parsed!.from, parsed!.from + block.length)).toBe(block)
    expect(md.slice(parsed!.from, parsed!.to).trimEnd()).toBe(block)
  })

  it('clamps `to` to the document length for a block at EOF', () => {
    // Regression: an overshoot here crashed CM selection ("outside of document").
    const md = formatSpiritualBlock('prayer', UUID, 'amen')
    const [parsed] = parseSpiritualBlocks(md)
    expect(parsed!.to).toBe(md.length)
  })

  it('finds multiple blocks', () => {
    const a = formatSpiritualBlock('prayer', UUID, 'one')
    const b = formatSpiritualBlock('sense', '0123abcd-0123-0123-0123-0123456789ac', 'two')
    expect(parseSpiritualBlocks(`${a}\n\n${b}`)).toHaveLength(2)
  })

  it('ignores non-dayspring fences', () => {
    expect(parseSpiritualBlocks('```js\ncode\n```')).toHaveLength(0)
  })
})

describe('stripSpiritualBlocks', () => {
  it('removes blocks and collapses the gap', () => {
    const block = formatSpiritualBlock('prayer', UUID, 'amen')
    expect(stripSpiritualBlocks(`Hello\n\n${block}\n\nWorld`)).toBe('Hello\n\nWorld')
  })
  it('leaves block-free markdown intact', () => {
    expect(stripSpiritualBlocks('just words')).toBe('just words')
  })
})

describe('ensureBlockSeparation', () => {
  const block = `\`\`\`dayspring-scripture ${UUID}\nBe still\nPsalm 46:10\n\`\`\``
  it('inserts a blank line between a block and a following practice token', () => {
    const doc = `<!-- practice:section:Lectio -->\n${block}\n<!-- practice:section:Meditatio -->\n`
    const out = ensureBlockSeparation(doc)
    expect(out).toContain('```\n\n<!-- practice:section:Meditatio -->')
  })
  it('is idempotent — a separated block is left untouched', () => {
    const doc = `<!-- practice:section:Lectio -->\n${block}\n<!-- practice:section:Meditatio -->\n`
    expect(ensureBlockSeparation(ensureBlockSeparation(doc))).toBe(ensureBlockSeparation(doc))
  })
  it('leaves non-practice documents alone', () => {
    const doc = `${block}\nsome prose`
    expect(ensureBlockSeparation(doc)).toBe(doc)
  })
})

describe('isSpiritualFenceLine', () => {
  it('recognizes an opening fence', () => {
    expect(isSpiritualFenceLine(`\`\`\`dayspring-pray ${UUID}`)).toBe(true)
    expect(isSpiritualFenceLine('```js')).toBe(false)
  })
})
