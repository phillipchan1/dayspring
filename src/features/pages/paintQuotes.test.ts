// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { paintQuotes } from './paintQuotes'

function root(html: string): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('paintQuotes', () => {
  it('paints the writer’s rendered words without touching markup', () => {
    const el = root('<p class="ordinary">He met me in the middle of that week.</p>')
    expect(paintQuotes(el, ['He met me in the middle'], 'saved')).toBe(1)
    expect(el.querySelector('p')?.className).toBe('ordinary')
    expect(el.querySelector('.saved')?.textContent).toBe('He met me in the middle')
  })

  it('unwraps stored markdown markers before matching rendered prose', () => {
    const el = root('<p>This was <strong>completely undone</strong> in me.</p>')
    expect(paintQuotes(el, ['**completely undone**'], 'saved')).toBe(1)
    expect(el.querySelector('strong .saved')?.textContent).toBe('completely undone')
  })

  it('allows subject lighting to nest inside its span', () => {
    const el = root('<p>Chicago was where the answer came.</p>')
    paintQuotes(el, ['Chicago was where the answer came.'], 'saved')
    expect(el.querySelector('.saved')?.tagName).toBe('SPAN')
  })

  it('does not paint code or attribute values', () => {
    const el = root('<p data-note="Chicago">ordinary prose</p><code>Chicago</code>')
    expect(paintQuotes(el, ['Chicago'], 'saved')).toBe(0)
    expect(el.innerHTML).toContain('data-note="Chicago"')
  })
})
