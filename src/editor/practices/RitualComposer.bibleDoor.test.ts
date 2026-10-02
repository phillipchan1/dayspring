// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RitualComposer } from './RitualComposer'
import { GuestModeProvider } from '@/context/GuestMode'
import { composeRitualMarkdown } from './ritualDocument'
import { writePassage, type PassageRef } from './passage'
import { PRACTICE_BY_NAME } from './practicesData'
import { RITUAL_END_TOKEN } from '@/lib/practiceTokens'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Embla's browser needs, as in RitualComposer.test.ts.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
Object.defineProperty(window, 'IntersectionObserver', { writable: true, configurable: true, value: NoopObserver })
Element.prototype.scrollIntoView = () => {}
Object.defineProperty(window, 'ResizeObserver', { writable: true, configurable: true, value: NoopObserver })
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})

vi.mock('@/lib/analytics', () => ({ track: () => {} }))
const viewport = vi.hoisted(() => ({ desk: true }))
vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => !viewport.desk,
  useTouchPrimary: () => !viewport.desk,
  useMediaQuery: () => viewport.desk,
}))

// No network in a test.
const JOHN = [
  { n: 4, text: 'Remain in me, and I in you.' },
  { n: 5, text: 'I am the vine. You are the branches.' },
]
// Any chapter opens, with enough verses for any suggestion on the shelf.
const CHAPTER = Array.from({ length: 40 }, (_, k) => ({ n: k + 1, text: `Verse ${k + 1}.` }))
const source = vi.hoisted(() => ({ fail: false }))
vi.mock('./passageSource', () => ({
  peekChapter: () => null,
  loadChapter: async () => (source.fail ? [] : CHAPTER),
  loadLight: async () => ({ books: new Map(), chapters: new Map(), max: 0, returning: [] }),
  searchTopic: async () => [],
}))

const ID = '7c1e0b52-9a0b-4f1e-8c3d-2b6a1f0e9d44'

let host: HTMLDivElement
let root: Root
let doc: string

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  viewport.desk = true
  source.fail = false
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ''
})

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

const OPEN = PRACTICE_BY_NAME.get('Open Reading')!
const labelsOf = (name: string) => PRACTICE_BY_NAME.get(name)!.prompts.map((p) => p.label)

/** A ritual PAGE, as the Bible door begins one: a blank document and a seed. */
function begin(opts: { passage?: PassageRef; onSwitch?: () => void; start?: string } = {}) {
  doc = opts.start ?? ''
  act(() => {
    root.render(
      createElement(RitualComposer, {
        blockIndex: 0,
        getDoc: () => doc,
        replaceRange: (from: number, to: number, text: string) => {
          doc = doc.slice(0, from) + text + doc.slice(to)
        },
        onClose: () => {},
        onAbout: () => {},
        entry: {
          seed: {
            name: OPEN.name,
            labels: labelsOf(OPEN.name),
            ...(opts.passage ? { passage: opts.passage } : {}),
          },
          backTo: 'your journal',
          backShort: 'Journal',
          onDelete: () => {},
          ...(opts.onSwitch ? { onSwitch: opts.onSwitch } : {}),
        },
      }),
    )
  })
}

describe('the Bible door', () => {
  it('begins on a passage it arrives with — no finder step, straight to writing', async () => {
    begin({ passage: { book: 'John', chapter: 15, from: null, to: null } })
    await flush()
    await flush()
    expect(document.querySelector('.passage-finder')).toBeNull()
    expect(document.querySelector('.ritual-composer')?.classList.contains('rc--facing')).toBe(true)
    expect(document.querySelector('.rc__leaf-ref span')?.textContent).toBe('John 15')
    expect(document.querySelector('.rc__page .rc__label')?.textContent).toBe('Reflect')
  })

  it('begins on a suggestion the moment it is chosen, without a preview to confirm', async () => {
    begin()
    await flush()
    act(() => (document.querySelector('.pf__pick') as HTMLButtonElement).click())
    await flush()
    await flush()
    expect(document.querySelector('.passage-finder')).toBeNull()
    expect(document.querySelector('.pf__begin')).toBeNull()
    expect(document.querySelector('.ritual-composer')?.classList.contains('rc--facing')).toBe(true)
  })
})

describe('reading from your own Bible', () => {
  const ownButtons = () =>
    [...document.querySelectorAll('button')].filter((b) => /own Bible/i.test(b.textContent ?? ''))

  it('is never offered as a choice — a page with only a reference has nothing to draw from', async () => {
    begin()
    await flush()
    expect(document.querySelector('.passage-finder')).not.toBeNull()
    expect(ownButtons()).toHaveLength(0)
  })

  it('is not offered when changing the passage either', async () => {
    const PSG = writePassage({ book: 'John', chapter: 15, from: 4, to: 5 }, JOHN, ID)
    begin({
      start: `${composeRitualMarkdown(OPEN.name, labelsOf(OPEN.name), [PSG, ''])}\n${RITUAL_END_TOKEN}`,
      onSwitch: () => {},
    })
    await flush()
    act(() => (document.querySelector('.rc__leaf-ref button') as HTMLButtonElement).click())
    await flush()
    expect(document.querySelector('.pf__begin')).not.toBeNull()
    expect(ownButtons()).toHaveLength(0)
  })
})

describe('a page already kept as a reference only', () => {
  const REF_ONLY = writePassage({ book: 'John', chapter: 15, from: null, to: null }, null, ID)
  const refOnlyPage = () =>
    `${composeRitualMarkdown(OPEN.name, labelsOf(OPEN.name), [REF_ONLY, ''])}\n${RITUAL_END_TOKEN}`

  it('opens with its passage beside it, ready to draw from, and keeps the words from then on', async () => {
    begin({ start: refOnlyPage(), onSwitch: () => {} })
    await flush()
    await flush()
    expect(document.querySelector('.rc__leaf-own')).toBeNull()
    expect(document.querySelectorAll('.rc__leaf-text .psg__v').length).toBe(CHAPTER.length)
    // Scripture beside the page is always scripture you can select.
    expect(document.querySelector('.rc__leaf-text .psg')?.getAttribute('data-mode')).toBe('quote')
    // The same fence, now holding the words — once the debounced write lands.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450))
    })
    expect(doc).toContain(ID)
    expect(doc).toContain('Verse 1.')
  })

  it('says so, and offers to try again, when the chapter will not open — never "your own Bible"', async () => {
    source.fail = true
    begin({ start: refOnlyPage(), onSwitch: () => {} })
    await flush()
    await flush()
    const box = document.querySelector('.rc__leaf-own')
    expect(box?.textContent).toMatch(/wouldn’t open just now/)
    expect(box?.textContent).not.toMatch(/own Bible/i)
    // The connection comes back: asked again, the words arrive.
    source.fail = false
    act(() => (document.querySelector('.rc__leaf-retry') as HTMLButtonElement).click())
    await flush()
    await flush()
    expect(document.querySelector('.rc__leaf-own')).toBeNull()
    expect(document.querySelectorAll('.rc__leaf-text .psg__v').length).toBe(CHAPTER.length)
  })
})

describe('a guest, who has no session for the chapter', () => {
  it('is told the passage needs a sign-in, with the way to do it — not that a feature is missing', async () => {
    const requestSignIn = vi.fn()
    const onClose = vi.fn()
    const REF_ONLY = writePassage({ book: 'John', chapter: 15, from: null, to: null }, null, ID)
    doc = `${composeRitualMarkdown(OPEN.name, labelsOf(OPEN.name), [REF_ONLY, 'A line.'])}\n${RITUAL_END_TOKEN}`
    // A guest's chapter never loads: there is no session to ask with.
    source.fail = true
    act(() => {
      root.render(
        createElement(GuestModeProvider, {
          requestSignIn,
          children: createElement(RitualComposer, {
            blockIndex: 0,
            getDoc: () => doc,
            replaceRange: (from: number, to: number, text: string) => {
              doc = doc.slice(0, from) + text + doc.slice(to)
            },
            onClose,
            onAbout: () => {},
            entry: { backTo: 'your journal', backShort: 'Journal', onDelete: () => {} },
          }),
        }),
      )
    })
    await flush()
    await flush()
    const box = document.querySelector('.rc__leaf-own')
    expect(box?.textContent).toMatch(/not signed in/)
    expect(box?.textContent).not.toMatch(/own Bible/i)
    act(() => (box!.querySelector('button') as HTMLButtonElement).click())
    // Leaves the ritual (keeping what is written), then asks to sign in.
    expect(onClose).toHaveBeenCalled()
    expect(requestSignIn).toHaveBeenCalledOnce()
    expect(doc).toContain('A line.')
  })
})

describe('the ways through a passage', () => {
  const PSG = writePassage({ book: 'John', chapter: 15, from: 4, to: 5 }, JOHN, ID)
  const page = (name: string, texts: string[]) =>
    `${composeRitualMarkdown(name, labelsOf(name), texts)}\n${RITUAL_END_TOKEN}`

  it('are offered beside the reference until something is written', async () => {
    begin({ start: page('Open Reading', [PSG, '']), onSwitch: () => {} })
    await flush()
    const ways = [...document.querySelectorAll('.rc__ways button')].map((b) => b.textContent)
    expect(ways).toEqual(['Open', 'Lectio', 'SOAP', 'Discovery'])
    expect(document.querySelector('.rc__ways [aria-pressed="true"]')?.textContent).toBe('Open')
    // "change" is reachable from the writing movement, not only from Read.
    expect(document.querySelector('.rc__leaf-ref button')?.textContent).toBe('change')
  })

  it('rewrite the page under the new practice, keeping the passage', async () => {
    const onSwitch = vi.fn()
    begin({ start: page('Open Reading', [PSG, '']), onSwitch })
    await flush()
    const lectio = [...document.querySelectorAll('.rc__ways button')].find((b) => b.textContent === 'Lectio')!
    act(() => (lectio as HTMLButtonElement).click())
    expect(onSwitch).toHaveBeenCalledOnce()
    expect(doc).toBe(page('Lectio Divina', [PSG, '', '', '']))
    // The old composer's unmount flush must not write Open Reading back.
    act(() => root.unmount())
    root = createRoot(host)
    expect(doc).toContain('<!-- ritual:name:Lectio Divina -->')
  })

  it('sit beside the ritual’s name, not under the passage reference', async () => {
    begin({ start: page('Open Reading', [PSG, '']), onSwitch: () => {} })
    await flush()
    expect(document.querySelector('.rc__head .rc__title')?.textContent).toBe('Open Reading')
    expect(document.querySelector('.rc__head .rc__ways')).not.toBeNull()
    expect(document.querySelector('.rc__leaf-text .rc__ways')).toBeNull()
  })

  it('go once the writer has written', async () => {
    begin({ start: page('Open Reading', [PSG, 'Remain.']), onSwitch: () => {} })
    await flush()
    expect(document.querySelector('.rc__ways')).toBeNull()
  })
})

describe('changing the passage', () => {
  it('opens the finder on the chapter already chosen, its verses marked', async () => {
    const PSG = writePassage({ book: 'John', chapter: 15, from: 4, to: 5 }, JOHN, ID)
    begin({
      start: `${composeRitualMarkdown(OPEN.name, labelsOf(OPEN.name), [PSG, ''])}\n${RITUAL_END_TOKEN}`,
      onSwitch: () => {},
    })
    await flush()
    act(() => (document.querySelector('.rc__leaf-ref button') as HTMLButtonElement).click())
    await flush()
    expect(document.querySelector('.pf__chapter')?.textContent).toBe('John 15')
    expect(document.querySelectorAll('.pf__reading [data-sel="true"]').length).toBeGreaterThan(0)
    expect(document.querySelector('.pf__begin')?.textContent).toBe('Use this passage')
  })
})
