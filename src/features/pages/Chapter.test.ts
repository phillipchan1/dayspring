// @vitest-environment jsdom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry } from '@/lib/types'
import { buildSubjectIndex, type Subject } from './subjects'
import { Chapter } from './Chapter'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function entry(id: string, body: string, date: string): Entry {
  const createdAt = new Date(`${date}T12:00:00`).toISOString()
  return {
    id,
    created_at: createdAt,
    updated_at: createdAt,
    body_markdown: body,
    title: null,
    mood: null,
    tags: [],
    word_count: body.split(/\s+/).length,
    source: 'native',
    external_id: null,
  }
}

describe('Chapter density band', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it('makes populated months jump to their first matching page', () => {
    const entries = [
      entry('sep-new', 'Nova again', '2026-09-20'),
      entry('sep-old', 'Nova arrived', '2026-09-02'),
      entry('aug', 'Something else', '2026-08-10'),
    ]
    const subject: Subject = { key: 'nova', label: 'Nova', terms: ['Nova'], kind: 'word' }
    const onJump = vi.fn()

    act(() => {
      root.render(
        createElement(Chapter, {
          subjects: [subject],
          entries,
          index: buildSubjectIndex(entries),
          kept: new Set<string>(),
          onJump,
        }),
      )
    })

    const jumps = host.querySelectorAll<HTMLButtonElement>('.pg-band__jump')
    expect(jumps).toHaveLength(1)
    expect(jumps[0]?.getAttribute('aria-label')).toContain('Jump to this month')

    act(() => jumps[0]?.click())
    expect(onJump).toHaveBeenCalledWith(2026, 8, 'sep-new')
  })
})
