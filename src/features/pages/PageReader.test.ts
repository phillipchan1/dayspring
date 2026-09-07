// @vitest-environment jsdom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Entry } from '@/lib/types'
import { PageReader } from './PageReader'

const { hydrate } = vi.hoisted(() => ({
  hydrate: vi.fn(() => () => {}),
}))

vi.mock('./readAttachments', () => ({
  hydrateReadAttachments: hydrate,
}))

const HASH = 'a'.repeat(64)
const entry: Entry = {
  id: 'entry-1',
  created_at: '2021-06-10T12:00:00.000Z',
  updated_at: '2021-06-10T12:00:00.000Z',
  body_markdown: `A sentence I marked for later.\n\n![Morning light](attachment:${HASH}.jpg)`,
  title: null,
  mood: null,
  tags: [],
  word_count: 8,
  source: 'native',
  external_id: null,
}

let root: Root | null = null
let host: HTMLDivElement | null = null

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  host?.remove()
  host = null
  hydrate.mockClear()
})

function renderReader(onEdit = vi.fn()) {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => {
    root!.render(
      createElement(PageReader, {
        bar: null,
        entry,
        markQuotes: ['A sentence I marked for later.'],
        markings: [],
        match: null,
        firstLineTitle: false,
        onEdit,
        onBack: vi.fn(),
        newer: null,
        older: null,
        onTurn: vi.fn(),
        leaves: false,
      }),
    )
  })
  return { onEdit }
}

describe('PageReader', () => {
  it('hydrates private images and paints saved marks like the editor', () => {
    renderReader()
    const body = host!.querySelector<HTMLElement>('.pg-read1__body')!
    expect(hydrate).toHaveBeenCalledWith(body, entry.body_markdown)
    expect(body.querySelector('.pg-read1__saved-mark')?.textContent).toBe(
      'A sentence I marked for later.',
    )
    expect(body.querySelector('img[alt="Morning light"]')).not.toBeNull()
  })

  it('opens the same entry for writing on pointer devices', () => {
    const onEdit = vi.fn()
    renderReader(onEdit)
    act(() => {
      host!.querySelector<HTMLElement>('.pg-read1__page')!.click()
    })
    expect(onEdit).toHaveBeenCalledWith(entry.id)
  })
})
