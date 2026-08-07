// @vitest-environment jsdom
//
// The Entries view switcher mixes two kinds of control: three grouping radios
// that persist in settings, and one navigation action that leaves the panel.
// These pin that distinction down, because the tempting simplification — making
// "Pages" a fourth EntriesGroupBy value — puts a value in the panel's state that
// the panel cannot render.

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EntriesGroupToggle } from './EntriesGroupToggle'

const noop = () => {}

describe('EntriesGroupToggle', () => {
  it('offers Pages as a way out of the panel', () => {
    const html = renderToString(
      createElement(EntriesGroupToggle, { value: 'flat' as const, onChange: noop, onPages: noop }),
    )
    expect(html).toContain('Pages')
  })

  it('never marks Pages as the active grouping', () => {
    // Pages is an action, not a mode the panel can be in — so whichever grouping
    // is selected, the Pages segment must not carry the active pill.
    for (const value of ['flat', 'month', 'year'] as const) {
      const html = renderToString(
        createElement(EntriesGroupToggle, { value, onChange: noop, onPages: noop }),
      )
      const pagesSegment = html.slice(html.indexOf('--go'))
      expect(pagesSegment).not.toContain('data-active')
    }
  })

  it('omits Pages entirely when no handler is given', () => {
    // The App Store listing captures render the switcher without onPages so the
    // marketing shots keep showing shipped navigation only.
    const html = renderToString(
      createElement(EntriesGroupToggle, { value: 'flat' as const, onChange: noop }),
    )
    expect(html).not.toContain('Pages')
    expect(html).toContain('List')
  })
})
