import { describe, expect, it } from 'vitest'
import { EXCERPT_RADIUS, excerptAround } from './excerpt'

describe('excerptAround', () => {
  it('drops ritual markers in front of the writer’s words (the Ascent drill-in bug)', () => {
    const body = [
      '<!-- ritual:name:New Every Morning -->',
      '<!-- ritual:section:Awake -->',
      'I’m thankful for dinner last night. Lamentations 3:22-23 again this morning.',
    ].join('\n')
    const out = excerptAround(body, body.indexOf('Lamentations'))
    expect(out).toBe('I’m thankful for dinner last night. Lamentations 3:22-23 again this morning.')
  })

  it('drops a comment the window cut in half, at either end', () => {
    const pad = 'x'.repeat(EXCERPT_RADIUS)
    const body = `<!-- ritual:section:${pad} -->\nPsalm 23 held me.\n<!-- ritual:section:${pad} -->`
    const out = excerptAround(body, body.indexOf('Psalm'))
    expect(out).not.toMatch(/ritual|<!--|-->/)
    expect(out).toContain('Psalm 23 held me.')
  })

  it('keeps the words inside a block but not its fence, and strips markdown syntax', () => {
    const body = [
      '## Morning',
      '**Still** here. Romans 8:28',
      '```dayspring-prayer 0f1e2d3c-0000-4000-8000-000000000001',
      'Let me trust you with Thursday.',
      '```',
    ].join('\n')
    const out = excerptAround(body, body.indexOf('Romans'))
    expect(out).toBe('Morning Still here. Romans 8:28 Let me trust you with Thursday.')
  })

  it('marks a window that does not reach the ends of the page', () => {
    const body = `${'a '.repeat(200)}John 3:16${' b'.repeat(200)}`
    const out = excerptAround(body, body.indexOf('John'))
    expect(out.startsWith('…')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
  })

  it('is empty for an empty body', () => {
    expect(excerptAround('', 0)).toBe('')
  })
})
