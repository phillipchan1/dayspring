// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { printMarkdown } from './entryActions'

afterEach(() => {
  document.querySelectorAll('iframe').forEach((f) => f.remove())
  vi.restoreAllMocks()
})

describe('printing an entry', () => {
  it('prints from a hidden same-origin frame, never window.open', () => {
    const open = vi.spyOn(window, 'open')
    printMarkdown('Morning\n\nThe light came <early>.', 'Morning <1>')
    const frame = document.querySelector('iframe')
    expect(open).not.toHaveBeenCalled()
    expect(frame).toBeTruthy()
    expect(frame!.getAttribute('aria-hidden')).toBe('true')
    // Its own document — no `src`, so it is the app's origin.
    expect(frame!.hasAttribute('src')).toBe(false)
    expect(frame!.srcdoc).toContain('<title>Morning &lt;1&gt;</title>')
    expect(frame!.srcdoc).toContain('The light came')
  })

  it('a second print replaces the first frame', () => {
    printMarkdown('One', 'One')
    printMarkdown('Two', 'Two')
    const frames = document.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    expect(frames[0]!.srcdoc).toContain('Two')
  })
})
