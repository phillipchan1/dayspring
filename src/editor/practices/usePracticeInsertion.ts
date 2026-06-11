import { useCallback, type RefObject } from 'react'
import {
  Decoration,
  EditorView,
  WidgetType,
  keymap,
  type DecorationSet,
} from '@codemirror/view'
import { Prec, StateField, type EditorState, type Extension, type Range } from '@codemirror/state'
import type { EditorHandle } from '../Editor'
import { PRACTICE_BY_NAME, type Practice } from './practicesData'
import { PRACTICE_NAME_RE, PRACTICE_SECTION_RE } from '@/lib/practiceTokens'

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

/** Build the raw markdown for a practice, ready to insert at `insertAt`. */
export function buildPracticeBlock(
  practice: Practice,
  doc: string,
  insertAt: number,
): { text: string; cursorOffset: number } {
  const needLead = insertAt > 0 && doc[insertAt - 1] !== '\n'
  let text = needLead ? '\n' : ''
  text += `<!-- ritual:name:${practice.name} -->\n`
  let cursorOffset = -1
  practice.prompts.forEach((prompt, i) => {
    text += `<!-- ritual:section:${prompt.label} -->\n`
    // First blank answer line — where the caret should land after insertion.
    if (cursorOffset < 0) cursorOffset = text.length
    // One blank answer line per prompt. The break that ends each line goes
    // *between* sections; the last answer stays a terminal line so the block
    // doesn't leave a stray empty line dangling below the final question.
    if (i < practice.prompts.length - 1) text += '\n'
  })
  // Keep a blank line between the practice and any text that follows.
  if (insertAt < doc.length && doc[insertAt] !== '\n') text += '\n'
  return { text, cursorOffset: cursorOffset < 0 ? text.length : cursorOffset }
}

// ── Decorations ────────────────────────────────────────────────────────────
//
// Each `ritual:*` token line is *replaced* by its block widget (the practice
// header or a prompt). The replace range stops at the line's text — the trailing
// newline survives, so the answer line below stays its own editable line, and
// each prompt renders directly above the answer it introduces.
//
// We do NOT hide the token lines with `display:none`: CodeMirror can't measure a
// `display:none` `.cm-line`, so it keeps a stale height estimate (a hidden 1-line
// token measures as ~16px instead of 0) and its coordinate→position map drifts
// out of sync with the DOM. That drift made clicks on a ritual answer line resolve
// to the wrong line — the reported "can't click the last line of a response" bug.
// A replace widget is measured like any other block, so the map stays aligned.

/** Marks the writing line below a prompt so it has a comfortable click target. */
const answerLineDeco = Decoration.line({ class: 'cm-practice-answer' })
/** Zero-styling mark used only to keep token lines atomic for cursor motion. */
const atomicMark = Decoration.mark({})


/** A `practice:section` line — rendered as the amber label + italic question. */
class PracticePromptWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly question: string,
  ) {
    super()
  }
  eq(other: PracticePromptWidget): boolean {
    return other.label === this.label && other.question === this.question
  }
  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = 'cm-practice-prompt'
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

/**
 * A faint header at the top of a practice block: the practice name (orientation,
 * since the raw name token is hidden) plus a quiet "free write" action that
 * dissolves the whole template into plain prose. Revealed on hover/focus.
 */
class PracticeNameWidget extends WidgetType {
  constructor(readonly name: string) {
    super()
  }
  eq(other: PracticeNameWidget): boolean {
    return other.name === this.name
  }
  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = 'cm-practice-header'
    root.dataset.practice = this.name
    root.setAttribute('contenteditable', 'false')

    const name = document.createElement('span')
    name.className = 'cm-practice-header__name'
    name.textContent = this.name

    const about = document.createElement('button')
    about.type = 'button'
    about.className = 'cm-practice-action cm-practice-action--about'
    about.textContent = 'about'
    about.title = 'Why this ritual, how it moves, and a few tips'

    const action = document.createElement('button')
    action.type = 'button'
    action.className = 'cm-practice-action cm-practice-action--freewrite'
    action.textContent = 'free write'
    action.title = 'Remove the prompts and keep only your words'

    root.append(name, about, action)
    return root
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
  // Cheap bail-out: ritual entries are rare, so most docs do nothing here.
  const md = doc.toString()
  if (!md.includes('<!-- ritual:') && !md.includes('<!-- practice:')) return EMPTY

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
    // Keep the token line atomic so the caret skips the (now replaced) markup
    // when arrowing through the entry.
    const atomicTo = Math.min(line.to + 1, doc.length)
    if (atomicTo > line.from) atomicRanges.push(atomicMark.range(line.from, atomicTo))

    if (token.kind === 'name') {
      currentPractice = PRACTICE_BY_NAME.get(token.value)
      // Replace the raw name token with a faint header block (orientation + the
      // "about" / "free write" actions). Range stops at line.to so the newline
      // stays and the section below keeps its own line.
      ranges.push(
        Decoration.replace({
          widget: new PracticeNameWidget(token.value),
          block: true,
          inclusive: false,
        }).range(line.from, line.to),
      )
      return
    }

    // Replace the section token with its prompt block. It renders in place of the
    // token line — directly above the answer line — and stays visible as you write
    // so the question you're answering is always in view; only the faint
    // placeholder (below) clears once the section has content.
    const prompt = currentPractice?.prompts.find((p) => p.label === token.value)
    ranges.push(
      Decoration.replace({
        widget: new PracticePromptWidget(token.value, prompt?.question ?? ''),
        block: true,
        inclusive: false,
      }).range(line.from, line.to),
    )

    // No answer line follows (token is the last line) — nothing to write into.
    if (token.line + 1 > doc.lines) return
    const answer = doc.line(token.line + 1)

    // Section content runs from the answer line up to the following token (or EOF).
    const nextTokenLine = tokens[idx + 1]?.line ?? doc.lines + 1
    let content = ''
    for (let n = token.line + 1; n < nextTokenLine; n++) {
      content += doc.line(n).text
    }
    const filled = content.trim().length > 0

    // The min-height is a click target for an *empty* answer line. Once the
    // section has content (text or an embedded block like scripture), the content
    // sets the height — forcing min-height there just opens a dead gap.
    if (!filled) ranges.push(answerLineDeco.range(answer.from))

    // Placeholder hint sits on the (empty) answer line until the writer begins.
    if (!filled && prompt?.placeholder) {
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
  // Writing line beneath a prompt — a generous, obvious target to click into.
  '.cm-practice-answer': {
    minHeight: '2.6em',
  },
  '.cm-practice-prompt': {
    display: 'block',
    // Spacing as PADDING, not margin: CodeMirror measures a block widget's
    // height from its bounding rect, which excludes margins — an outer margin
    // would push the DOM down without being counted, drifting the
    // coordinate→position map and again making answer lines below unclickable.
    padding: '1.6rem 0 0.65rem',
    userSelect: 'none',
  },
  // Small letter-spaced cap label — the elegance motif shared with scripture
  // citations, so the whole surface reads as one type system in any font.
  '.cm-practice-prompt__label': {
    display: 'block',
    fontFamily: 'var(--font-editor)',
    fontSize: '0.66em',
    fontWeight: '500',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: 'var(--accent, #c8853a)',
    opacity: '0.8',
    marginBottom: '0.5rem',
  },
  // The "given voice" — italic, airy, dimmed a tier below the writer's words.
  // Optical sizing lets variable serifs render this at a display weight.
  '.cm-practice-prompt__question': {
    margin: '0',
    fontFamily: 'var(--font-editor)',
    fontStyle: 'italic',
    fontWeight: '300',
    fontSize: '1.06em',
    lineHeight: '1.55',
    letterSpacing: '0.005em',
    color: 'var(--text-dim, #4a3f35)',
    fontOpticalSizing: 'auto',
  },
  '.cm-practice-placeholder': {
    color: 'var(--text-faint, #c4b5a8)',
    fontStyle: 'italic',
    pointerEvents: 'none',
  },
  // Faint block header: practice name + the (hover-revealed) "free write" action.
  // Padding (not margin) so CodeMirror counts the spacing in the block's measured
  // height — see the note on .cm-practice-prompt.
  '.cm-practice-header': {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.7rem',
    padding: '0.3rem 0 1.1rem',
    userSelect: 'none',
  },
  '.cm-practice-header__name': {
    fontFamily: 'var(--font-editor)',
    fontSize: '0.62em',
    fontWeight: '400',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: 'var(--accent, #c8853a)',
  },
  '.cm-practice-action': {
    fontFamily: 'var(--font-editor)',
    fontSize: '0.62em',
    letterSpacing: '0.08em',
    color: 'var(--text-faint, #c4b5a8)',
    background: 'none',
    border: 'none',
    padding: '0',
    cursor: 'pointer',
    opacity: '0',
    transition: 'opacity 200ms ease, color 200ms ease',
  },
  '.cm-practice-header:hover .cm-practice-action, .cm-practice-action:focus-visible': {
    opacity: '1',
  },
  '.cm-practice-action:hover': {
    color: 'var(--accent, #c8853a)',
  },
  // Touch devices have no hover — keep the action quietly visible there.
  '@media (hover: none)': {
    '.cm-practice-action': { opacity: '0.55' },
  },
})

// ── Editing the scaffolding ─────────────────────────────────────────────────
//
// Practice entries are just text, so changing them uses gestures you already
// know — plus undo as a fearless safety net:
//   • Skip a prompt   → Backspace on its empty line (deletePracticeSection)
//   • Free write      → the header's "free write" action (dissolvePracticeBlockAt)
//   • Swap / add      → run /practice again (smart replace/append in the hook)

const isTokenLine = (text: string) =>
  PRACTICE_NAME_RE.test(text) || PRACTICE_SECTION_RE.test(text)

/** The practice block (name → last section) containing `pos`, or null. */
export interface PracticeBlock {
  from: number
  to: number
  /** True when no section has any written content yet. */
  empty: boolean
}

export function findPracticeBlockAt(doc: string, pos: number): PracticeBlock | null {
  const lines = doc.split('\n')
  const starts: number[] = []
  let offset = 0
  for (const line of lines) {
    starts.push(offset)
    offset += line.length + 1
  }
  let li = 0
  for (let i = 0; i < lines.length; i++) {
    if (pos >= starts[i]!) li = i
    else break
  }
  let start = -1
  for (let i = li; i >= 0; i--) {
    if (PRACTICE_NAME_RE.test(lines[i]!)) {
      start = i
      break
    }
  }
  if (start === -1) return null
  let end = lines.length - 1
  for (let i = start + 1; i < lines.length; i++) {
    if (PRACTICE_NAME_RE.test(lines[i]!)) {
      end = i - 1
      break
    }
  }
  if (li < start || li > end) return null

  let content = ''
  for (let i = start; i <= end; i++) {
    if (!isTokenLine(lines[i]!)) content += lines[i]
  }
  return {
    from: starts[start]!,
    to: starts[end]! + lines[end]!.length,
    empty: content.trim().length === 0,
  }
}

/**
 * Backspace at the start of an empty answer line removes that one prompt — like
 * deleting an empty list item. Only fires in that exact case; otherwise the
 * normal Backspace runs.
 */
function deletePracticeSection(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const line = state.doc.lineAt(sel.head)
  if (sel.head !== line.from || line.text.trim() !== '' || line.number === 1) return false
  const prev = state.doc.line(line.number - 1)
  if (!PRACTICE_SECTION_RE.test(prev.text)) return false

  const from = prev.from
  const to = Math.min(line.to + 1, state.doc.length)
  // Land the caret at the end of the previous section's writing, when there is one.
  let caret = from
  if (prev.number - 1 >= 1) {
    const above = state.doc.line(prev.number - 1)
    if (!isTokenLine(above.text)) caret = above.to
  }
  view.dispatch({ changes: { from, to, insert: '' }, selection: { anchor: caret } })
  return true
}

/**
 * Drop the scaffolding token lines, keeping each section's written lines and
 * separating the surviving answers with a blank line so they read as plain
 * paragraphs. Pure so it can be unit-tested without an editor.
 */
export function dissolvePracticeProse(lines: string[]): string {
  const groups: string[] = []
  let current: string[] = []
  const flush = () => {
    const text = current.join('\n').trim()
    if (text) groups.push(text)
    current = []
  }
  for (const text of lines) {
    if (isTokenLine(text)) flush()
    else current.push(text)
  }
  flush()
  return groups.join('\n\n')
}

/** Strip the practice block containing `pos`, keeping the writer's words as prose. */
function dissolvePracticeBlockAt(view: EditorView, pos: number): void {
  const { doc } = view.state
  const posLine = doc.lineAt(pos).number
  let startLine = -1
  for (let n = posLine; n >= 1; n--) {
    if (PRACTICE_NAME_RE.test(doc.line(n).text)) {
      startLine = n
      break
    }
  }
  if (startLine === -1) return
  let endLine = doc.lines
  for (let n = startLine + 1; n <= doc.lines; n++) {
    if (PRACTICE_NAME_RE.test(doc.line(n).text)) {
      endLine = n - 1
      break
    }
  }

  const lines: string[] = []
  for (let n = startLine; n <= endLine; n++) lines.push(doc.line(n).text)
  const prose = dissolvePracticeProse(lines)

  const from = doc.line(startLine).from
  const to = doc.line(endLine).to
  view.dispatch({
    changes: { from, to, insert: prose },
    selection: { anchor: from + prose.length },
  })
  view.focus()
}

/**
 * Paint hidden `practice:*` tokens as their prompts and fade each prompt as its
 * section fills. Display-only: the markdown tokens stay in the document so the
 * structure survives save/sync, but the prompt text is never persisted.
 *
 * @param onAbout Open the practice's "about" sheet (by practice name).
 */
export function practicePromptExtension(onAbout: (name: string) => void): Extension {
  return [
  practiceTheme,
  practiceField,
  // Treat the hidden token lines as atoms so the caret skips them and a
  // backspace from a blank answer line removes the whole prompt in one stroke.
  EditorView.atomicRanges.of((view) => view.state.field(practiceField).atomic),
  // Backspace on an empty section line removes that single prompt.
  Prec.high(keymap.of([{ key: 'Backspace', run: deletePracticeSection }])),
  // The header's "free write" action dissolves the template into prose; clicking
  // a prompt drops the caret into that prompt's answer line.
  EditorView.domEventHandlers({
    mousedown(event, view) {
      const node = event.target as HTMLElement | null
      const freewrite = node?.closest('.cm-practice-action--freewrite')
      if (freewrite) {
        event.preventDefault()
        dissolvePracticeBlockAt(view, view.posAtDOM(freewrite))
        return true
      }
      // The "about" action opens a slide-over describing the practice.
      const about = node?.closest('.cm-practice-action--about')
      if (about) {
        event.preventDefault()
        const header = about.closest('.cm-practice-header') as HTMLElement | null
        if (header?.dataset.practice) onAbout(header.dataset.practice)
        return true
      }
      // A prompt is a contenteditable=false block widget with no editable target
      // of its own. The last prompt has only open space below it (no following
      // prompt to bound its answer line), so a click there otherwise lands on the
      // widget and no caret appears. Redirect into the answer line — found by the
      // prompt's own label rather than posAtDOM, which on a block widget can
      // resolve past the answer line and drop the caret a line or two too low.
      const prompt = node?.closest('.cm-practice-prompt')
      if (prompt) {
        const label = prompt.querySelector('.cm-practice-prompt__label')?.textContent ?? ''
        const doc = view.state.doc
        for (let n = 1; n < doc.lines; n++) {
          const match = PRACTICE_SECTION_RE.exec(doc.line(n).text)
          if (match && match[1] === label) {
            event.preventDefault()
            view.dispatch({ selection: { anchor: doc.line(n + 1).from }, scrollIntoView: true })
            view.focus()
            return true
          }
        }
      }
      return false
    },
  }),
  ]
}

// ── React glue ───────────────────────────────────────────────────────────

/**
 * Returns a callback that begins a practice, dropping the caret on the first
 * answer line. If the cursor sits inside an existing practice block, choosing a
 * new one *replaces* it when nothing has been written yet, or *appends* below it
 * once writing has begun — so re-running /practice is both "swap" and "add".
 */
export function usePracticeInsertion(editorRef: RefObject<EditorHandle | null>) {
  return useCallback(
    (practice: Practice, insertAt: number, doc: string) => {
      const block = findPracticeBlockAt(doc, insertAt)
      let from = insertAt
      let to = insertAt
      let base = insertAt
      if (block?.empty) {
        from = block.from
        to = block.to
        base = block.from
      } else if (block) {
        from = to = base = block.to
      }
      const { text, cursorOffset } = buildPracticeBlock(practice, doc, base)
      editorRef.current?.replaceRange(from, to, text)
      const caret = base + cursorOffset
      requestAnimationFrame(() => editorRef.current?.focusAt(caret))
    },
    [editorRef],
  )
}
