// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PassageText } from './PassageText'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const render = (text: string) =>
  act(() => {
    root.render(createElement(PassageText, { verses: [{ n: 16, text }], mode: 'plain' }))
  })

describe('the divine name in the passage', () => {
  it('is set like every other word: LORD as written, no capital-and-small-capitals', () => {
    render('There are six things that the LORD hates,')
    const word = [...host.querySelectorAll('.psg__w')].find((w) => w.textContent === 'LORD')!
    expect(word).toBeDefined()
    // One plain text node: nothing inside it to draw differently.
    expect(word.children).toHaveLength(0)
    expect(word.childNodes).toHaveLength(1)
    expect(host.querySelector('.psg__sc')).toBeNull()
  })

  it('keeps the capitals where the text has them, and Lord where it does not', () => {
    render('O LORD, my Lord and my GOD.')
    const words = [...host.querySelectorAll('.psg__w')].map((w) => w.textContent)
    expect(words).toEqual(['O', 'LORD,', 'my', 'Lord', 'and', 'my', 'GOD.'])
  })
})
