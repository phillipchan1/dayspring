// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { pressClosesPalette } from './slashDismiss'

describe('pressClosesPalette', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const mount = (html: string) => {
    document.body.innerHTML = html
  }

  it('closes on a press anywhere that is not the palette', () => {
    mount('<div class="cm-line" id="line"></div><div class="slash-palette"></div>')
    // The line the `+` was pressed beside is the case that used to stay open.
    expect(pressClosesPalette(document.getElementById('line'))).toBe(true)
    expect(pressClosesPalette(document.body)).toBe(true)
  })

  it('stays open for a press on the palette or anything inside it', () => {
    mount('<div class="slash-palette"><button class="row" id="row"></button></div>')
    expect(pressClosesPalette(document.getElementById('row'))).toBe(false)
    expect(pressClosesPalette(document.querySelector('.slash-palette'))).toBe(false)
  })

  it('closes for a target that is not an element at all', () => {
    mount('<div class="slash-palette"></div>')
    expect(pressClosesPalette(null)).toBe(true)
    expect(pressClosesPalette(document)).toBe(true)
  })

  it('leaves the touch sheet to its own scrim', () => {
    // The scrim's cancel takes the `/command` text with it; closing here first
    // would strand a `/` in the entry.
    mount(
      '<div class="command-popover__scrim" id="scrim"></div><div class="slash-palette slash-palette--sheet"></div>',
    )
    expect(pressClosesPalette(document.getElementById('scrim'))).toBe(false)
    expect(pressClosesPalette(document.body)).toBe(false)
  })
})
