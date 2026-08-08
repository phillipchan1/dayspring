// @vitest-environment jsdom
//
// Render smoke tests.
//
// The pure modules are covered elsewhere; what these catch is the other failure
// mode — a component that typechecks and then throws on the first paint, which is
// exactly what a wall built from `Map.get(...)!` lookups is prone to.
//
// Server rendering runs the render path without effects, so `cols` is 1 and the
// windowing sits at its initial range. That's the point: it exercises the first
// frame, which is the one a user sees before anything has measured itself.
//
// jsdom rather than the default node environment because the Spread renders
// through DOMPurify, which needs a window to sanitize against.

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Entry } from '@/lib/types'
import { PagesView } from './PagesView'
import { PageWall } from './PageWall'
import { Spread } from './Spread'
import { settingsStore } from '@/lib/settings'

let n = 0
function entry(body: string, dateLocal = '2021-06-10'): Entry {
  const [y, m, d] = dateLocal.split('-').map(Number)
  const iso = new Date(y!, m! - 1, d!, 12).toISOString()
  return {
    id: `e${++n}`,
    created_at: iso,
    updated_at: iso,
    body_markdown: body,
    title: null,
    mood: null,
    tags: [],
    word_count: body.split(/\s+/).length,
    source: 'native',
    external_id: null,
  }
}

const noop = () => {}

/** What the wall needs from the shell to browse, edit, rename and delete. */
const wallActions = {
  onOpen: noop,
  onEdit: noop,
  onMenuAction: noop,
  onDeleteEntries: noop,
}
const settings = settingsStore.get()

describe('PageWall', () => {
  it('renders pages without a measured layout', () => {
    const entries = [entry('# A day\n\nSomething I wrote down'), entry('> A line I kept for later')]
    const html = renderToString(
      createElement(PageWall, {
        entries,
        density: 'shelf' as const,
        markQuotes: new Map(),
        lit: null,
        activeId: null,
        echoes: true,
        ...wallActions,
      }),
    )
    expect(html).toContain('Something I wrote down')
    expect(html).toContain('A line I kept for later')
  })

  it('dims rather than removes the pages a subject misses', () => {
    const hit = entry('a page that mentions Martha plainly')
    const miss = entry('a page about something else entirely')
    const html = renderToString(
      createElement(PageWall, {
        entries: [hit, miss],
        density: 'wall' as const,
        markQuotes: new Map(),
        lit: new Set([hit.id]),
        activeId: null,
        echoes: false,
        ...wallActions,
      }),
    )
    // Both pages are on the wall — the unlit one is faded, never dropped.
    expect(html).toContain('something else entirely')
    expect(html).toContain('data-dim="true"')
  })

  it('survives an entry with no prose at all', () => {
    const html = renderToString(
      createElement(PageWall, {
        entries: [entry('')],
        density: 'shelf' as const,
        markQuotes: new Map(),
        lit: null,
        activeId: null,
        echoes: true,
        ...wallActions,
      }),
    )
    expect(html).toContain('Blank page')
  })
})

describe('Spread', () => {
  it('renders two leaves with their marginalia', () => {
    const a = entry('Left page body text')
    const b = entry('Right page body text')
    const html = renderToString(
      createElement(Spread, {
        entries: [a, b],
        index: 0,
        onIndex: noop,
        onClose: noop,
        single: false,
        markQuotes: new Map([[a.id, ['a note I set apart on this page']]]),
        firstLineTitle: true,
        onEdit: noop,
      }),
    )
    expect(html).toContain('Left page body text')
    expect(html).toContain('Right page body text')
    expect(html).toContain('a note I set apart on this page')
  })
})

describe('PagesView', () => {
  const base = {
    marks: [],
    ready: true,
    activeId: null,
    subjectKey: null,
    onSubject: noop,
    spreadId: null,
    onSpread: noop,
    onOpenEntry: noop,
    onEntryMenuAction: noop,
    onDeleteEntries: noop,
    single: false,
    settings,
    updateSettings: noop,
  }

  it('tells the truth when there is nothing to read back', () => {
    const html = renderToString(createElement(PagesView, { ...base, entries: [] }))
    expect(html).toContain('Nothing to read back yet')
  })

  it('shows the loader rather than an empty wall before the corpus lands', () => {
    const html = renderToString(
      createElement(PagesView, { ...base, entries: [], ready: false }),
    )
    expect(html).toContain('Opening your pages')
  })

  it('renders the wall, the grid, and the facts', () => {
    const entries = [
      entry('First thing I wrote', '2021-06-10'),
      entry('Second thing I wrote', '2019-03-02'),
    ]
    const html = renderToString(createElement(PagesView, { ...base, entries }))
    expect(html).toContain('First thing I wrote')
    expect(html).toContain('Your own, side by side')
    expect(html).toContain('pages') // the facts row counts them
  })

  it('carries no streak, goal, or total — the D-017 override licenses none of those', () => {
    const entries = [entry('anything at all', '2021-06-10')]
    const html = renderToString(createElement(PagesView, { ...base, entries }))
    expect(html.toLowerCase()).not.toContain('streak')
    expect(html.toLowerCase()).not.toContain('goal')
    expect(html.toLowerCase()).not.toContain("haven't written")
  })
})
