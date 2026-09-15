// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RitualComposer } from './RitualComposer'
import { composeRitualMarkdown } from './ritualDocument'
import { parseRitualBlocks, isRitualComplete } from './ritualPacing'
import {
  buildPracticeBlock,
  placeholderFor,
  questionFor,
} from './usePracticeInsertion'
import { PRACTICE_BY_NAME, SHELF, resolveMovements } from './practicesData'

/**
 * THE ROUND — the one ritual whose movements are the writer's own life.
 *
 * Two things here are worth guarding beyond the happy path: that a domain label
 * this library has never seen still renders its question (the whole reason
 * `dynamic` exists), and that walking past a domain does not leave a permanent
 * "you didn't finish" in someone's journal.
 */

const round = SHELF.find((p) => p.name === 'The Round')!
const examen = SHELF.find((p) => p.name === 'The Daily Examen')!

// Deliberately awkward: a real Life Map holds proper nouns, not tidy slugs.
const DOMAINS = ['Frontier Church', 'Trading', 'Marriage', 'The kids']

describe('resolveMovements', () => {
  it('returns a static practice’s own prompts untouched', () => {
    expect(resolveMovements(examen, DOMAINS)).toBe(examen.prompts)
  })

  it('builds one movement per domain, in the order given', () => {
    const movements = resolveMovements(round, DOMAINS)
    expect(movements.map((m) => m.label)).toEqual(DOMAINS)
  })

  it('never re-sorts — the Life Map’s chronology is the order', () => {
    // Reversed input must come back reversed. Sorting here would be the app
    // ranking the parts of someone's life, which lifeMap.ts calls a verdict
    // rendered in a sort (D-016).
    const reversed = [...DOMAINS].reverse()
    expect(resolveMovements(round, reversed).map((m) => m.label)).toEqual(reversed)
  })

  it('gives every domain a question, and does not repeat the domain in it', () => {
    // Each surface renders the label directly above the question, so naming the
    // domain twice read as "FRONTIER CHURCH / Frontier Church — what is true…".
    const movements = resolveMovements(round, DOMAINS)
    for (const [n, movement] of movements.entries()) {
      expect(movement.question).toBeTruthy()
      expect(movement.question).not.toContain(DOMAINS[n]!)
    }
  })

  it('resolves to nothing when the Life Map is empty', () => {
    expect(resolveMovements(round, [])).toEqual([])
  })
})

describe('questionFor / placeholderFor', () => {
  it('reads a static practice out of the table', () => {
    expect(questionFor(examen, 'Gratitude')).toBe(examen.prompts[0]!.question)
    expect(placeholderFor(examen, 'Gratitude')).toBe(examen.prompts[0]!.placeholder)
  })

  it('falls through to the template for a label the table never saw', () => {
    // The bug this prevents: a domain movement rendering with a blank question,
    // in the entry and in the composer both.
    expect(questionFor(round, 'Frontier Church')).toBeTruthy()
    expect(placeholderFor(round, 'Frontier Church')).toBe(round.dynamic!.placeholder)
  })

  it('still renders questions for a RETIRED practice', () => {
    // The whole reason PRACTICE_BY_NAME keeps retired rows: entries written
    // with them must not lose the questions they answered.
    const retired = PRACTICE_BY_NAME.get('Then vs. Now')!
    expect(retired.retired).toBe(true)
    expect(questionFor(retired, 'Evidence')).not.toBe('')
  })

  it('is empty rather than throwing for an unknown practice', () => {
    expect(questionFor(undefined, 'Anything')).toBe('')
    expect(placeholderFor(undefined, 'Anything')).toBe('')
  })
})

describe('buildPracticeBlock with resolved movements', () => {
  it('writes one section token per domain, with the same grammar as any ritual', () => {
    const movements = resolveMovements(round, DOMAINS)
    const { text } = buildPracticeBlock(round, '', 0, movements)
    expect(text).toContain('<!-- ritual:name:The Round -->')
    for (const domain of DOMAINS) {
      expect(text).toContain(`<!-- ritual:section:${domain} -->`)
    }
    // Parses back as an ordinary block — nothing downstream needs to know this
    // ritual's movements came from anywhere unusual.
    const [block] = parseRitualBlocks(text.split('\n'))
    expect(block!.name).toBe('The Round')
    expect(block!.movements.map((m) => m.label)).toEqual(DOMAINS)
  })

  it('writes nothing but the masthead when there are no domains', () => {
    const { text } = buildPracticeBlock(round, '', 0, [])
    expect(text).not.toContain('ritual:section')
  })
})

// ── The composer: walking past a domain ────────────────────────────────────

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
for (const name of ['IntersectionObserver', 'ResizeObserver']) {
  Object.defineProperty(window, name, {
    writable: true,
    configurable: true,
    value: NoopObserver,
  })
}
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
vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => true,
  useTouchPrimary: () => true,
  useMediaQuery: () => false,
}))

function type(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )!.set!
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('leaving a half-walked Round', () => {
  let root: Root
  let host: HTMLDivElement
  let doc: string
  let onClose: ReturnType<typeof vi.fn<() => void>>

  const render = () => {
    act(() => {
      root.render(
        createElement(RitualComposer, {
          blockIndex: 0,
          getDoc: () => doc,
          replaceRange: (from: number, to: number, text: string) => {
            doc = doc.slice(0, from) + text + doc.slice(to)
          },
          onClose,
          onAbout: () => {},
        }),
      )
    })
  }

  const close = () => {
    const leave = host.ownerDocument.body.querySelector<HTMLButtonElement>('.rc__x')!
    act(() => leave.click())
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    doc = composeRitualMarkdown(round.name, DOMAINS, ['', '', '', ''])
    onClose = vi.fn<() => void>()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.useRealTimers()
  })

  it('drops the domains walked past, and keeps the ones written in', () => {
    render()
    const panes = document.body.querySelectorAll<HTMLTextAreaElement>('.rc__write')
    act(() => type(panes[0]!, 'Sunday went long but the team held it.'))
    act(() => type(panes[2]!, 'Took Esther out. First time in weeks.'))
    close()

    const [block] = parseRitualBlocks(doc.split('\n'))
    expect(block!.movements.map((m) => m.label)).toEqual(['Frontier Church', 'Marriage'])
    expect(doc).not.toContain('Trading')
    expect(doc).not.toContain('The kids')
    // …and the writing survives intact.
    expect(doc).toContain('Sunday went long but the team held it.')
    expect(doc).toContain('Took Esther out. First time in weeks.')
  })

  it('leaves the block COMPLETE, so no "continue" badge is left behind', () => {
    // The actual bug this exists to prevent: isRitualComplete requires every
    // movement filled, and an incomplete block renders a continue button on the
    // entry forever. On a Round deliberately walked past, that is a chore
    // counter — exactly what Principle 2 forbids.
    render()
    const panes = document.body.querySelectorAll<HTMLTextAreaElement>('.rc__write')
    act(() => type(panes[1]!, 'Two green days. Stopped at target both times.'))
    close()

    const [block] = parseRitualBlocks(doc.split('\n'))
    expect(isRitualComplete(block!)).toBe(true)
  })

  it('removes the whole ritual when nothing at all was written', () => {
    // Unchanged behaviour: untouched scaffolding is not a record.
    render()
    close()
    expect(doc.trim()).toBe('')
  })

  it('does NOT prune a static ritual — its movements are the practice’s own', () => {
    // An Examen with one movement answered is genuinely unfinished, and the
    // continue button is the door back in. Pruning here would delete the
    // movements the writer still means to pray.
    doc = composeRitualMarkdown(
      examen.name,
      examen.prompts.map((p) => p.label),
      ['', '', '', ''],
    )
    render()
    const panes = document.body.querySelectorAll<HTMLTextAreaElement>('.rc__write')
    act(() => type(panes[0]!, 'The drive home, with the windows down.'))
    close()

    const [block] = parseRitualBlocks(doc.split('\n'))
    expect(block!.movements).toHaveLength(examen.prompts.length)
    expect(isRitualComplete(block!)).toBe(false)
  })
})
