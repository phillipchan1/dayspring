// @vitest-environment jsdom
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { forceParsing } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { afterEach, describe, expect, it } from 'vitest'
import { concealMarkersExtension } from './concealMarkers'
import { markdownHighlight } from './highlight'
import { HighlightExtension, UnderlineExtension } from './markdownMarks'
import { proseHighlighting } from './proseHighlighting'
import { spiritualBlocksField } from './spiritualBlocksField'

/**
 * The live-formatting battery: type a line one keystroke at a time, the way a
 * writer does, and assert what the line LOOKS like after each keystroke —
 * which characters are painted, which are hidden, and which styles cover them.
 *
 * This exists because every piece here passed its own unit tests while the
 * whole still felt broken: `## ` stayed plain until Enter because the heading
 * style was a mark decoration, and marks wait for the caret to leave the word
 * (Safari autocorrect). Asserting the composed result per keystroke is what
 * catches that class of bug.
 */

const mdExtension = markdown({
  base: markdownLanguage,
  codeLanguages: [],
  extensions: [{ remove: ['IndentedCode', 'SetextHeading'] }, HighlightExtension, UnderlineExtension],
})

const STYLE: Record<string, string> = {
  strong: markdownHighlight.style([tags.strong])!,
  em: markdownHighlight.style([tags.emphasis])!,
  strike: markdownHighlight.style([tags.strikethrough])!,
  underline: markdownHighlight.style([tags.special(tags.emphasis)])!,
  code: markdownHighlight.style([tags.monospace])!,
  link: markdownHighlight.style([tags.link])!,
}

/** Lines above the one being typed, so nothing depends on being line 1. */
const PRELUDE = 'Before.\n\n'

/**
 * Every view is destroyed after its test. A live one left in the document
 * gets a CodeMirror measure frame later, which jsdom can't lay out
 * (`getClientRects is not a function`) — an uncaught error that fails whatever
 * file happens to be running.
 */
const mounted: EditorView[] = []
afterEach(() => {
  for (const view of mounted.splice(0)) view.destroy()
})

function mount(doc: string, caret = doc.length): EditorView {
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: caret },
      extensions: [spiritualBlocksField, mdExtension, proseHighlighting(), concealMarkersExtension()],
    }),
    parent: document.body,
  })
  mounted.push(view)
  return view
}

/** Types `text` at the caret, one character per transaction. */
function type(view: EditorView, text: string): void {
  for (const ch of text) {
    const at = view.state.selection.main.head
    view.dispatch({
      changes: { from: at, insert: ch },
      selection: { anchor: at + ch.length },
      userEvent: 'input.type',
    })
    // The parser works to a time budget; under a loaded test run it can stop
    // short and finish on a later tick, as it would in the app. Finish now so
    // each snapshot is of a settled keystroke.
    forceParsing(view, view.state.doc.length, 5000)
  }
}

function key(view: EditorView, name: string): boolean {
  const event = new KeyboardEvent('keydown', { key: name })
  return runScopeHandlers(view, event, 'editor')
}

interface Painted {
  /** The caret line as the writer sees it: hidden markers removed. */
  visible: string
  /** Per style, the visible text it covers (runs joined with `|`). */
  styles: Record<string, string>
  /** Line-decoration classes on the caret line. */
  lineClasses: string[]
}

function paint(view: EditorView, lineNo?: number): Painted {
  const { state } = view
  const line = lineNo ? state.doc.line(lineNo) : state.doc.lineAt(state.selection.main.head)
  const n = line.to - line.from
  const hidden = new Array<boolean>(n).fill(false)
  const classes: Set<string>[] = Array.from({ length: n }, () => new Set())
  const lineClasses: string[] = []

  for (const provider of state.facet(EditorView.atomicRanges)) {
    const iter = provider(view).iter(line.from)
    while (iter.value && iter.from <= line.to) {
      for (let p = Math.max(iter.from, line.from); p < Math.min(iter.to, line.to); p++) hidden[p - line.from] = true
      iter.next()
    }
  }
  for (const source of state.facet(EditorView.decorations)) {
    const set = typeof source === 'function' ? source(view) : source
    const iter = set.iter(line.from)
    while (iter.value && iter.from <= line.to) {
      const spec = iter.value.spec as { class?: string }
      if (iter.from === iter.to && iter.from === line.from && spec.class && (iter.value as { point?: boolean }).point) {
        lineClasses.push(...spec.class.split(' '))
      } else if (spec.class) {
        for (let p = Math.max(iter.from, line.from); p < Math.min(iter.to, line.to); p++) {
          for (const c of spec.class.split(' ')) classes[p - line.from]!.add(c)
        }
      }
      iter.next()
    }
  }

  let visible = ''
  const styles: Record<string, string> = {}
  for (const [name, cls] of Object.entries(STYLE)) {
    const runs: string[] = []
    let run = ''
    for (let i = 0; i < n; i++) {
      if (hidden[i]) continue
      if (cls.split(' ').every((c) => classes[i]!.has(c))) run += line.text[i]
      else if (run) (runs.push(run), (run = ''))
    }
    if (run) runs.push(run)
    if (runs.length) styles[name] = runs.join('|')
  }
  for (let i = 0; i < n; i++) if (!hidden[i]) visible += line.text[i]
  return { visible, styles, lineClasses }
}

/** Type `text` on a fresh line, returning the paint after every keystroke. */
function typeAndPaint(text: string): { after: (prefix: string) => Painted; view: EditorView } {
  const view = mount(PRELUDE)
  const snaps = new Map<string, Painted>()
  let typed = ''
  for (const ch of text) {
    type(view, ch)
    typed += ch
    snaps.set(typed, paint(view))
  }
  return {
    view,
    after: (prefix) => {
      const s = snaps.get(prefix)
      if (!s) throw new Error(`never typed ${JSON.stringify(prefix)}`)
      return s
    },
  }
}

describe('live formatting — headings', () => {
  it('turns `## ` into a heading the moment the space lands, hashes hidden', () => {
    const { after } = typeAndPaint('## sample heading')
    // Before the space it's still just two characters being typed.
    expect(after('##').visible).toBe('##')
    expect(after('##').lineClasses).not.toContain('cm-md-h2')
    // The space is the trigger.
    expect(after('## ').visible).toBe('')
    expect(after('## ').lineClasses).toContain('cm-md-h2')
    // …and it stays a heading, hashes hidden, the whole time you type.
    for (const prefix of ['## s', '## sample', '## sample ', '## sample heading']) {
      expect(after(prefix).visible).toBe(prefix.slice(3))
      expect(after(prefix).lineClasses).toContain('cm-md-h2')
    }
  })

  it('handles every level, and not a seventh', () => {
    for (let level = 1; level <= 6; level++) {
      const { after } = typeAndPaint(`${'#'.repeat(level)} Title`)
      const p = after(`${'#'.repeat(level)} Title`)
      expect(p.visible).toBe('Title')
      expect(p.lineClasses).toContain(`cm-md-h${level}`)
    }
    const seven = typeAndPaint('####### Title').after('####### Title')
    expect(seven.visible).toBe('####### Title')
    expect(seven.lineClasses.some((c) => c.startsWith('cm-md-h'))).toBe(false)
  })

  it('leaves a #hashtag at the start of a line as prose', () => {
    const { after } = typeAndPaint('#grateful today')
    expect(after('#').visible).toBe('#')
    expect(after('#grateful today').visible).toBe('#grateful today')
    expect(after('#grateful today').lineClasses.some((c) => c.startsWith('cm-md-h'))).toBe(false)
  })

  it('paints inline marks inside a heading as they close', () => {
    const { view } = typeAndPaint('## a **bold** word')
    const p = paint(view)
    expect(p.visible).toBe('a bold word')
    expect(p.styles.strong).toBe('bold')
    expect(p.lineClasses).toContain('cm-md-h2')
  })

  it('reveals the hashes when the caret goes to the very start of the line', () => {
    const view = mount(PRELUDE + '## Title')
    view.dispatch({ selection: { anchor: PRELUDE.length } })
    expect(paint(view).visible).toBe('## Title')
    view.dispatch({ selection: { anchor: view.state.doc.length } })
    expect(paint(view).visible).toBe('Title')
  })

  it('keeps the hashes hidden with the caret at the start of the heading text', () => {
    const view = mount(PRELUDE + '## Title', PRELUDE.length + 3)
    expect(paint(view).visible).toBe('Title')
  })

  it('Backspace at the start of the heading text turns it back into a paragraph', () => {
    const view = mount(PRELUDE + '## Title', PRELUDE.length + 3)
    expect(key(view, 'Backspace')).toBe(true)
    expect(view.state.doc.toString()).toBe(PRELUDE + 'Title')
    expect(view.state.selection.main.head).toBe(PRELUDE.length)
  })

  it('Backspace on an empty `## ` heading clears it', () => {
    const view = mount(PRELUDE)
    type(view, '## ')
    expect(key(view, 'Backspace')).toBe(true)
    expect(view.state.doc.toString()).toBe(PRELUDE)
  })

  it('Enter at the start of the heading text pushes the heading down, intact', () => {
    const view = mount(PRELUDE + '## Title', PRELUDE.length + 3)
    expect(key(view, 'Enter')).toBe(true)
    expect(view.state.doc.toString()).toBe(PRELUDE + '\n## Title')
    expect(paint(view).visible).toBe('Title')
    expect(paint(view).lineClasses).toContain('cm-md-h2')
  })

  it('Enter at the end of a heading starts a plain paragraph', () => {
    const view = mount(PRELUDE)
    type(view, '## Title')
    view.dispatch(view.state.replaceSelection('\n'))
    type(view, 'body')
    expect(paint(view).lineClasses.some((c) => c.startsWith('cm-md-h'))).toBe(false)
    const heading = paint(view, view.state.doc.lines - 1)
    expect(heading.visible).toBe('Title')
    expect(heading.lineClasses).toContain('cm-md-h2')
  })

  it('does not double the size when a heading is painted on a finished line', () => {
    // Size lives on the line only; a mark carrying it too would compound em.
    const view = mount(PRELUDE + '## Title\n\nafter')
    const p = paint(view, 3)
    expect(p.lineClasses).toContain('cm-md-h2')
    expect(markdownHighlight.style([tags.heading2])).toBeNull()
  })
})

describe('live formatting — quotes', () => {
  it('styles `> ` as a quote as soon as it is typed', () => {
    const { after } = typeAndPaint('> a quiet word')
    expect(after('> ').lineClasses).toContain('cm-md-quote')
    expect(after('> a quiet word').lineClasses).toContain('cm-md-quote')
  })
})

describe('live formatting — inline marks', () => {
  const cases: [string, string, string][] = [
    ['**bold**', 'strong', 'bold'],
    ['__bold__', 'strong', 'bold'],
    ['*italic*', 'em', 'italic'],
    ['_italic_', 'em', 'italic'],
    ['~~gone~~', 'strike', 'gone'],
    ['++under++', 'underline', 'under'],
    ['`code`', 'code', 'code'],
  ]

  for (const [src, style, text] of cases) {
    it(`paints ${src} the moment it closes, and hides the marks once you move on`, () => {
      const { after } = typeAndPaint(`x ${src} y`)
      // Not yet closed: nothing styled.
      expect(after(`x ${src.slice(0, -1)}`).styles[style]).toBeUndefined()
      // Closed: styled immediately (markers still showing under the caret).
      expect(after(`x ${src}`).styles[style]).toContain(text)
      // Moved on: markers gone.
      expect(after(`x ${src} `).visible).toBe(`x ${text} `)
      expect(after(`x ${src} y`).styles[style]).toBe(text)
    })
  }

  it('paints a multi-word span the moment it closes, not just its first words', () => {
    const { after } = typeAndPaint('a **two words** b')
    expect(after('a **two words**').styles.strong).toBe('**two words**')
    expect(after('a **two words** b').visible).toBe('a two words b')
  })

  it('paints ==highlight== (a line-level wash elsewhere) and hides its marks', () => {
    const { after } = typeAndPaint('a ==glow== b')
    expect(after('a ==glow== b').visible).toBe('a glow b')
  })

  it('paints a link down to its label', () => {
    const { after } = typeAndPaint('see [the docs](https://x.com) now')
    const p = after('see [the docs](https://x.com) now')
    expect(p.visible).toBe('see the docs now')
    expect(p.styles.link).toBe('the docs')
  })
})

describe('live formatting — doubled and nested marks', () => {
  it('***both*** is bold and italic, with all six markers hidden', () => {
    const p = typeAndPaint('a ***both*** b').after('a ***both*** b')
    expect(p.visible).toBe('a both b')
    expect(p.styles.strong).toBe('both')
    expect(p.styles.em).toBe('both')
  })

  it('bold wrapping italic keeps both, markers hidden', () => {
    const p = typeAndPaint('**a *b* c** d').after('**a *b* c** d')
    expect(p.visible).toBe('a b c d')
    expect(p.styles.strong).toBe('a b c')
    expect(p.styles.em).toBe('b')
  })

  it('italic wrapping bold keeps both', () => {
    const p = typeAndPaint('*a **b** c* d').after('*a **b** c* d')
    expect(p.visible).toBe('a b c d')
    expect(p.styles.em).toBe('a b c')
    expect(p.styles.strong).toBe('b')
  })

  it('underline and strike stack on bold', () => {
    const p = typeAndPaint('**++~~all~~++** x').after('**++~~all~~++** x')
    expect(p.visible).toBe('all x')
    expect(p.styles.strong).toBe('all')
    expect(p.styles.underline).toBe('all')
    expect(p.styles.strike).toBe('all')
  })

  it('two bold spans side by side stay two spans', () => {
    const p = typeAndPaint('**one** **two** x').after('**one** **two** x')
    expect(p.visible).toBe('one two x')
    expect(p.styles.strong).toBe('one|two')
  })

  it('does not treat code contents as markup', () => {
    const p = typeAndPaint('`**not bold**` x').after('`**not bold**` x')
    expect(p.visible).toBe('**not bold** x')
    expect(p.styles.strong).toBeUndefined()
  })

  it('an escaped marker stays a literal', () => {
    const p = typeAndPaint('\\*not italic\\* x').after('\\*not italic\\* x')
    expect(p.styles.em).toBeUndefined()
  })
})

describe('live formatting — prose that only looks like markup', () => {
  const prose = [
    '2 * 3 * 4 is twenty-four',
    'snake_case_words stay put',
    'a ** b and c ** d',
    'C++ and C++ again',
    'a == b == c',
    '****',
    '**unclosed and still going',
    'price was $5 ~ $6 ~ish',
  ]
  for (const text of prose) {
    it(`leaves ${JSON.stringify(text)} alone`, () => {
      const p = typeAndPaint(text).after(text)
      expect(p.visible).toBe(text)
      expect(p.styles).toEqual({})
      expect(p.lineClasses.filter((c) => c.startsWith('cm-md-'))).toEqual([])
    })
  }
})
