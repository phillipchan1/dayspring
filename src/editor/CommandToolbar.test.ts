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

  it('keeps Ritual off the keyboard bar — it lives on the blank-page top bar', () => {
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
    const labels = [...host.querySelectorAll('.command-toolbar__label')].map(
      (el) => el.textContent,
    )
    expect(labels).toContain('Scripture')
    expect(labels).toContain('Pray')
    expect(labels).toContain('Sense')
    expect(labels).toContain('Image')
    expect(labels).not.toContain('Ritual')
  })
})
