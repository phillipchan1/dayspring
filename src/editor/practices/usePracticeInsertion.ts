import { useCallback, type RefObject } from 'react'
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'
import { StateField, type EditorState, type Extension, type Range } from '@codemirror/state'
import type { EditorHandle } from '../Editor'
import { PRACTICE_BY_NAME, type Practice } from './practicesData'

/**
 * Practice entries are written directly into the document as plain markdown, but
 * their scaffolding — the practice name and each section's label + question — is
 * carried only as hidden HTML-comment tokens:
 *
 *   <!-- practice:name:The Daily Examen -->
 *   <!-- practice:section:Gratitude -->
 *   (the writer answers on the blank line here)
 *
 * The tokens never render (they're replaced by decorations) and the prompt text
 * is display-only — only what the writer types is persisted. The tokens are a
 * forward-looking hook so the rollup engine can one day recognise structured
 * practice entries by section. Nothing reads them yet.
 */

export const PRACTICE_NAME_RE = /^<!-- practice:name:(.+) -->$/
export const PRACTICE_SECTION_RE = /^<!-- practice:section:(.+) -->$/

/** Build the raw markdown for a practice, ready to insert at `insertAt`. */
export function buildPracticeBlock(
  practice: Practice,
  doc: string,
  insertAt: number,
): { text: string; cursorOffset: number } {
  const needLead = insertAt > 0 && doc[insertAt - 1] !== '\n'
  let text = needLead ? '\n' : ''
  text += `<!-- practice:name:${practice.name} -->\n`
  let cursorOffset = -1
  for (const prompt of practice.prompts) {
    text += `<!-- practice:section:${prompt.label} -->\n`
    // First blank answer line — where the caret should land after insertion.
    if (cursorOffset < 0) cursorOffset = text.length
    text += '\n'
  }
  // Keep a blank line between the practice and any text that follows.
  if (insertAt < doc.length && doc[insertAt] !== '\n') text += '\n'
  return { text, cursorOffset: cursorOffset < 0 ? text.length : cursorOffset }
}

// ── Decorations ────────────────────────────────────────────────────────────

/** A `practice:name` line — rendered to nothing so the token never shows. */
class HiddenTokenWidget extends WidgetType {
  eq(): boolean {
    return true
  }
  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-practice-hidden'
    el.setAttribute('aria-hidden', 'true')
    return el
  }
}

/** A `practice:section` line — rendered as the amber label + italic question. */
class PracticePromptWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly question: string,
    readonly filled: boolean,
  ) {
    super()
  }
  eq(other: PracticePromptWidget): boolean {
    return (
      other.label === this.label &&
      other.question === this.question &&
      other.filled === this.filled
    )
  }
  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = `cm-practice-prompt${this.filled ? ' cm-practice-prompt--filled' : ''}`
    root.setAttribute('contenteditable', 'false')
    root.setAttribute('aria-hidden', 'true')

    const label = document.createElement('span')
    label.className = 'cm-practice-prompt__label'
    label.textContent = this.label

    if (this.question) {
      const question = document.createElement('p')
      question.className = 'cm-practice-prompt__question'
      question.textContent = this.question
      root.append(label, question)
    } else {
      root.append(label)
    }
    return root
  }
  ignoreEvent(): boolean {
    return false
  }
}

/** Example phrasing on an empty answer line — fades out as the writer types. */
class PracticePlaceholderWidget extends WidgetType {
  constructor(readonly text: string) {
    super()
  }
  eq(other: PracticePlaceholderWidget): boolean {
    return other.text === this.text
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-practice-placeholder'
    span.setAttribute('aria-hidden', 'true')
    span.textContent = this.text
    return span
  }
  ignoreEvent(): boolean {
    return false
  }
}

interface ParsedToken {
  /** 1-based line number. */
  line: number
  kind: 'name' | 'section'
  value: string
}

interface PracticeDecorations {
  /** All practice decorations (hidden tokens, prompts, placeholders). */
  deco: DecorationSet
  /** Just the hidden token lines — kept atomic so the caret skips the markup. */
  atomic: DecorationSet
}

const EMPTY: PracticeDecorations = { deco: Decoration.none, atomic: Decoration.none }

function buildDecorations(state: EditorState): PracticeDecorations {
  const { doc } = state
  // Cheap bail-out: practice entries are rare, so most docs do nothing here.
  if (!doc.toString().includes('<!-- practice:')) return EMPTY

  const tokens: ParsedToken[] = []
  for (let n = 1; n <= doc.lines; n++) {
    const text = doc.line(n).text
    const name = PRACTICE_NAME_RE.exec(text)
    if (name) {
      tokens.push({ line: n, kind: 'name', value: name[1] ?? '' })
      continue
    }
    const section = PRACTICE_SECTION_RE.exec(text)
    if (section) tokens.push({ line: n, kind: 'section', value: section[1] ?? '' })
  }
  if (tokens.length === 0) return EMPTY

  const ranges: Range<Decoration>[] = []
  const atomicRanges: Range<Decoration>[] = []
  let currentPractice: Practice | undefined

  tokens.forEach((token, idx) => {
    const line = doc.line(token.line)
    // Span the whole line including its trailing break so block widgets fully
    // collapse the source token line (mirrors the spiritual-block convention).
    const blockTo = Math.min(line.to + 1, doc.length)

    if (token.kind === 'name') {
      currentPractice = PRACTICE_BY_NAME.get(token.value)
      const hidden = Decoration.replace({
        widget: new HiddenTokenWidget(),
        block: true,
      }).range(line.from, blockTo)
      ranges.push(hidden)
      atomicRanges.push(hidden)
      return
    }

    // Section content runs from the next line up to the following token (or EOF).
    const nextTokenLine = tokens[idx + 1]?.line ?? doc.lines + 1
    let content = ''
    for (let n = token.line + 1; n < nextTokenLine; n++) {
      content += doc.line(n).text
    }
    const filled = content.trim().length > 0

    const prompt = currentPractice?.prompts.find((p) => p.label === token.value)
    const promptDeco = Decoration.replace({
      widget: new PracticePromptWidget(token.value, prompt?.question ?? '', filled),
      block: true,
    }).range(line.from, blockTo)
    ranges.push(promptDeco)
    atomicRanges.push(promptDeco)

    // Placeholder hint sits on the first (empty) answer line.
    if (!filled && prompt?.placeholder && token.line + 1 <= doc.lines) {
      const answer = doc.line(token.line + 1)
      ranges.push(
        Decoration.widget({
          widget: new PracticePlaceholderWidget(prompt.placeholder),
          side: 1,
        }).range(answer.from),
      )
    }
  })

  return { deco: Decoration.set(ranges, true), atomic: Decoration.set(atomicRanges, true) }
}

const practiceField = StateField.define<PracticeDecorations>({
  create(state) {
    return buildDecorations(state)
  },
  update(value, tr) {
    // Rebuild on any doc change; otherwise map positions through the changes.
    if (tr.docChanged) return buildDecorations(tr.state)
    return { deco: value.deco.map(tr.changes), atomic: value.atomic.map(tr.changes) }
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
})

const practiceTheme = EditorView.theme({
  '.cm-practice-hidden': {
    display: 'none',
  },
  '.cm-practice-prompt': {
    display: 'block',
    margin: '1.5rem 0 0.5rem',
    userSelect: 'none',
    transition: 'opacity 360ms ease',
  },
  '.cm-practice-prompt--filled': {
    opacity: '0',
    pointerEvents: 'none',
  },
  '.cm-practice-prompt__label': {
    display: 'block',
    fontFamily: 'var(--font-serif)',
    fontSize: '10px',
    fontWeight: '400',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: 'var(--accent, #c8853a)',
    opacity: '0.75',
    marginBottom: '0.45rem',
  },
  '.cm-practice-prompt__question': {
    margin: '0',
    fontFamily: 'var(--font-serif)',
    fontStyle: 'italic',
    fontWeight: '300',
    fontSize: '1.02em',
    lineHeight: '1.45',
    color: 'var(--text-dim, #4a3f35)',
  },
  '.cm-practice-placeholder': {
    color: 'var(--text-faint, #c4b5a8)',
    fontStyle: 'italic',
    pointerEvents: 'none',
  },
})

/**
 * Paint hidden `practice:*` tokens as their prompts and fade each prompt as its
 * section fills. Display-only: the markdown tokens stay in the document so the
 * structure survives save/sync, but the prompt text is never persisted.
 */
export const practicePromptExtension: Extension = [
  practiceTheme,
  practiceField,
  // Treat the hidden token lines as atoms so the caret skips them and a
  // backspace from a blank answer line removes the whole prompt in one stroke.
  EditorView.atomicRanges.of((view) => view.state.field(practiceField).atomic),
]

// ── React glue ───────────────────────────────────────────────────────────

/**
 * Returns a callback that inserts a practice's structured block at `insertAt`
 * and drops the caret onto the first answer line.
 */
export function usePracticeInsertion(editorRef: RefObject<EditorHandle | null>) {
  return useCallback(
    (practice: Practice, insertAt: number, doc: string) => {
      const { text, cursorOffset } = buildPracticeBlock(practice, doc, insertAt)
      editorRef.current?.insertAt(insertAt, text)
      const caret = insertAt + cursorOffset
      requestAnimationFrame(() => editorRef.current?.focusAt(caret))
    },
    [editorRef],
  )
}
