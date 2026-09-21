// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { ritualMovementAt } from './readerRitual'

const LABELS = ['Gratitude', 'Awareness', 'Examination', 'Prayer']

function body(html: string): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

const PAGE = body(
  [
    '<p class="read-ritual-name">The Daily Examen</p>',
    '<p class="read-ritual-label">Gratitude</p>',
    '<p id="g">Bread.</p>',
    '<p id="g2">And the rain holding off.</p>',
    '<p class="read-ritual-label">Prayer</p>',
    '<p id="p">Patience.</p>',
    '<p id="after">A quiet evening after all.</p>',
  ].join(''),
)
const at = (id: string) => ritualMovementAt(PAGE.querySelector(`#${id}`), PAGE, LABELS)

describe('ritualMovementAt', () => {
  it('finds the movement an answer belongs to', () => {
    expect(at('g')).toBe(0)
    // A middle movement keeps every paragraph it was written in.
    expect(at('g2')).toBe(0)
    expect(at('p')).toBe(3)
  })

  it('gives what follows the last answer to After', () => {
    expect(at('after')).toBe(4)
  })

  it('opens where it always does from the name', () => {
    expect(ritualMovementAt(PAGE.querySelector('.read-ritual-name'), PAGE, LABELS)).toBeUndefined()
  })

  it('reaches the block from something nested inside it', () => {
    const page = body('<p class="read-ritual-label">Awareness</p><p><em id="x">far</em> today</p>')
    expect(ritualMovementAt(page.querySelector('#x'), page, LABELS)).toBe(1)
  })
})
