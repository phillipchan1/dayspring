// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommandToolbar } from './CommandToolbar'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('CommandToolbar', () => {
  let root: Root
  let host: HTMLDivElement

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  const render = () => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => {
      root.render(
        createElement(CommandToolbar, {
          onCommand: vi.fn(),
          onFormat: vi.fn(),
          visible: true,
        }),
      )
    })
  }

  const labels = () =>
    [...host.querySelectorAll('.command-toolbar__label')].map((el) => el.textContent)

  it('carries every capture verb', () => {
    render()
    expect(labels()).toContain('Scripture')
    expect(labels()).toContain('Pray')
    expect(labels()).toContain('Sense')
    expect(labels()).toContain('Image')
  })

  /*
   * This used to assert the opposite — that Ritual stayed OFF this bar, on the
   * reasoning that it is a shape for the whole page and `/` and `+` still
   * reached it. On a phone neither held: `lineMenu.ts` drops the `+` below
   * 767px *because* this bar was supposed to name the same commands, and the
   * touch placeholder never mentions `/`. That left no door at all once the
   * writer had typed a word.
   */
  it('carries Ritual too — on a phone this bar is the only door left', () => {
    render()
    expect(labels()).toContain('Ritual')
  })

  it('sets Ritual apart, because it is not an insert like the others', () => {
    render()
    const ritual = [...host.querySelectorAll('.command-toolbar__btn')].find((el) =>
      el.querySelector('.command-toolbar__label')?.textContent === 'Ritual',
    )
    expect(ritual).toBeTruthy()
    expect(ritual!.className).toContain('command-toolbar__btn--sep')
  })
})
