// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RitualComposer, gistOf } from './RitualComposer'
import { composeRitualMarkdown } from './ritualDocument'
import { writePassage } from './passage'

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

// No network in a test: the chapter is John 15:4–5, and the light is dark.
const JOHN = [
  { n: 4, text: 'Remain in me, and I in you.' },
  { n: 5, text: 'I am the vine. You are the branches.' },
]
vi.mock('./passageSource', () => ({
  loadChapter: async () => JOHN,
  loadLight: async () => ({ books: new Map(), chapters: new Map(), max: 0, returning: [] }),
  searchTopic: async () => [],
}))

const LECTIO = ['Lectio — Read', 'Meditatio — Meditate', 'Oratio — Pray', 'Contemplatio — Rest']
const ID = '7c1e0b52-9a0b-4f1e-8c3d-2b6a1f0e9d44'
const PASSAGE = writePassage({ book: 'John', chapter: 15, from: 4, to: 5 }, JOHN, ID)

let host: HTMLDivElement
let root: Root
let doc: string

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  viewport.desk = true
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.body.innerHTML = ''
})

function open(answers: string[]) {
  doc = composeRitualMarkdown('Lectio Divina', LECTIO, answers)
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
      }),
    )
  })
}
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

describe('a scripture ritual with nothing written', () => {
  it('opens on the finder, not the first question', () => {
    open([])
    expect(document.querySelector('.passage-finder')).not.toBeNull()
    expect(document.querySelector('.pf__title')?.textContent).toBe('What will you read?')
  })
})

describe('a scripture ritual with its passage', () => {
  it('widens the rail into a leaf that holds the passage', async () => {
    open([PASSAGE])
    await flush()
    const composer = document.querySelector('.ritual-composer')!
    expect(composer.classList.contains('rc--facing')).toBe(true)
    expect(document.querySelector('.rc__leaf-ref span')?.textContent).toBe('John 15:4–5')
    expect(document.querySelectorAll('.rc__leaf-text .psg__v')).toHaveLength(2)
  })

  it('resumes where the writing stops, and asks for no box on the Read movement', async () => {
    open([PASSAGE])
    await flush()
    // The passage is the Read movement's answer, so a return lands on Meditate.
    expect(document.querySelector('.rc__page .rc__label')?.textContent).toBe('Meditatio — Meditate')
    act(() => (document.querySelector('.rc__path button') as HTMLButtonElement).click())
    await flush()
    expect(document.querySelector('.rc__page .rc__label')?.textContent).toBe('Lectio — Read')
    expect(document.querySelector('.rc__page textarea')).toBeNull()
    expect(document.querySelector('.rc__desk .rc__next')?.textContent).toBe('I’ve read it')
  })

  it('writes a touched word as the quote line at the head of Meditatio', async () => {
    open([PASSAGE])
    await flush()
    const vine = [...document.querySelectorAll('.rc__leaf-text .psg__w')].find((w) => w.textContent === 'vine.')!
    // A press and release on one word, with nothing selected, takes the word.
    act(() => {
      vine.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      vine.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450))
    })
    expect(document.querySelector('.rc__caught q')?.textContent).toBe('vine')
    expect(doc).toContain('<!-- ritual:section:Meditatio — Meditate -->\n> vine\n')
  })

  it('rests on the caught word with nothing to write', async () => {
    open([PASSAGE, '> Remain in me\n\nIt keeps coming back.', 'Teach me to stay.', ''])
    await flush()
    // Walked to, the way a writer gets there: ⌥↵ three times.
    for (let n = 0; n < 3; n++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', altKey: true }))
      })
      await flush()
    }
    expect(document.querySelector('.rc__dwell-word')?.textContent).toBe('Remain in me')
    expect(document.querySelector('.rc__page textarea')).toBeNull()
    expect(document.querySelector('.rc__desk .rc__next')?.textContent).toBe('Amen')
  })

  it('reopens a finished Lectio at its beginning, though Rest holds no words', async () => {
    open([PASSAGE, '> Remain in me', 'Teach me to stay.', ''])
    await flush()
    expect(document.querySelector('.rc__page .rc__label')?.textContent).toBe('Lectio — Read')
  })

  it('asks before changing a passage something has been written under', async () => {
    open([PASSAGE, '> Remain in me\n\nIt keeps coming back.'])
    await flush()
    act(() => (document.querySelector('.rc__path button') as HTMLButtonElement).click())
    await flush()
    act(() => (document.querySelector('.rc__leaf-ref button') as HTMLButtonElement).click())
    expect(document.querySelector('.rc__ask')).not.toBeNull()
    expect(document.querySelector('.passage-finder')).toBeNull()
  })
})

describe('a Lectio begun before the finder', () => {
  it('keeps the plain composer, and the passage it typed out', async () => {
    open(['Remain in me — John 15. The word was “remain”.'])
    await flush()
    expect(document.querySelector('.passage-finder')).toBeNull()
    expect(document.querySelector('.ritual-composer')?.classList.contains('rc--facing')).toBe(false)
    expect(doc).toContain('Remain in me — John 15.')
  })
})

describe('the rail’s gist', () => {
  it('says a caught word as a quote, and a passage by its reference', () => {
    expect(gistOf('> Remain in me\n\nIt keeps coming back.')).toBe('“Remain in me” — It keeps coming back.')
    expect(gistOf(PASSAGE)).toBe('John 15:4–5 · ESV')
  })
})

const SOAP = ['Scripture', 'Observation', 'Application', 'Prayer']
function openSoap(answers: string[]) {
  doc = composeRitualMarkdown('SOAP', SOAP, answers)
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
      }),
    )
  })
}
/** Select from one word to another in the leaf, the way a drag would. */
function select(fromWord: string, toWord: string) {
  const words = [...document.querySelectorAll<HTMLElement>('.rc__leaf-text .psg__w')]
  const a = words.find((w) => w.textContent === fromWord)!
  const b = words.find((w) => w.textContent === toWord)!
  const r = document.createRange()
  r.setStart(a.firstChild!, 0)
  r.setEnd(b.firstChild!, b.textContent!.length)
  const sel = window.getSelection()!
  sel.removeAllRanges()
  sel.addRange(r)
  act(() => {
    a.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    b.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
  })
}

describe('drawing a line from the passage', () => {
  it('shows where the words will land, and brings them in on Enter as a quote line', async () => {
    openSoap([PASSAGE, 'He keeps saying remain.'])
    await flush()
    expect(document.querySelector('.rc__page .rc__label')?.textContent).toBe('Application')
    // Back to Observation, where something is already written.
    act(() => ([...document.querySelectorAll<HTMLButtonElement>('.rc__path button')][1]!).click())
    await flush()
    select('Remain', 'you.')
    expect(document.querySelector('.rc__ghost')?.textContent).toContain('Remain in me, and I in you')
    expect(document.querySelector('.rc__chip')).not.toBeNull()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450))
    })
    expect(doc).toContain('He keeps saying remain.\n\n> Remain in me, and I in you (v. 4)\n')
    // The words stay lit in the passage, drawn from the quote.
    const lit = [...document.querySelectorAll('.rc__leaf-text .psg__w[data-hl]')].map((w) => w.textContent)
    expect(lit).toEqual(['Remain', 'in', 'me,', 'and', 'I', 'in', 'you.'])
  })

  it('runs across a verse break', async () => {
    openSoap([PASSAGE, ''])
    await flush()
    select('you.', 'vine.')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450))
    })
    expect(doc).toContain('> you. I am the vine (vv. 4–5)')
  })

  it('lets go on Escape without leaving the ritual', async () => {
    openSoap([PASSAGE, ''])
    await flush()
    select('Remain', 'me,')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(document.querySelector('.rc__chip')).toBeNull()
    expect(document.querySelector('.ritual-composer')).not.toBeNull()
  })

  it('takes a whole verse by its number', async () => {
    openSoap([PASSAGE, ''])
    await flush()
    act(() => (document.querySelector<HTMLButtonElement>('.psg__n--cite')!).click())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450))
    })
    expect(doc).toContain('> Remain in me, and I in you (v. 4)')
  })
})
