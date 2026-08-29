import { useCallback, type RefObject } from 'react'
import {
  Decoration,
  EditorView,
  keymap,
  type DecorationSet,
} from '@codemirror/view'
import {
  Prec,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
  type Range,
} from '@codemirror/state'
import type { EditorHandle } from '../Editor'
import { PRACTICE_BY_NAME, type Practice } from './practicesData'
import { PRACTICE_NAME_RE, PRACTICE_SECTION_RE } from '@/lib/practiceTokens'
import {
  clampReveal,
  currentMovementIndex,
  initialReveal,
  isRitualComplete,
  parseRitualBlocks,
  ritualBlockAtLine,
  type RitualBlock,
} from './ritualPacing'
import {
  RitualAdvanceWidget,
  RitualClosedWidget,
  RitualColophonWidget,
  RitualHeaderWidget,
  RitualPlaceholderWidget,
  RitualPromptWidget,
} from './ritualWidgets'

/**
 * Ritual entries are written directly into the document as plain markdown, but
 * their scaffolding — the ritual name and each movement's label + question — is
 * carried only as hidden HTML-comment tokens:
 *
 *   <!-- ritual:name:The Daily Examen -->
 *   <!-- ritual:section:Gratitude -->
 *   (the writer answers on the blank line here)
 *
 * The tokens never render (they're replaced by decorations) and the prompt text
 * is display-only — only what the writer types is persisted. The tokens are a
 * forward-looking hook so the rollup engine can one day recognise structured
 * ritual entries by movement. Nothing reads them yet.
 *
 * A ritual opens ONE MOVEMENT AT A TIME. That pacing is the difference between
 * praying a practice and filling in a form, and the arithmetic behind it lives
 * in `ritualPacing.ts`. Everything here is a lens over the same markdown: the
 * document a paced ritual saves is byte-for-byte the document the old
 * all-at-once template saved, so entries written either way render correctly and
 * sync is untouched.
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

// ── Parsed rituals ─────────────────────────────────────────────────────────
//
// Parse the document's ritual blocks once per change, the way
// `spiritualBlocksField` does for scripture and prayer, so the reveal state and
// the decorations below both read one parse instead of each scanning the doc.

interface RitualDoc {
  blocks: RitualBlock[]
  /** False for the overwhelming majority of documents — the cheap bail-out. */
  hasRituals: boolean
}

const NO_RITUALS: RitualDoc = { blocks: [], hasRituals: false }

function parseRitualDoc(state: EditorState): RitualDoc {
  const md = state.doc.toString()
  if (!md.includes('<!-- ritual:') && !md.includes('<!-- practice:')) return NO_RITUALS
  return { blocks: parseRitualBlocks(md.split('\n')), hasRituals: true }
}

const ritualDocField = StateField.define<RitualDoc>({
  create: parseRitualDoc,
  update(value, tr) {
    return tr.docChanged ? parseRitualDoc(tr.state) : value
  },
})

// ── How far each ritual stands open ────────────────────────────────────────
//
// Deliberately NOT persisted. How far a ritual is open is a property of reading
// it, not of the entry — so it is seeded from the writing itself (`initialReveal`
// puts you back on the movement you left off at) and raised only on purpose.
//
// Typing must never raise it. Deriving the count purely from content would fling
// the next movement open on the first keystroke of this one, which is exactly
// the scanning-ahead the pacing exists to prevent.

interface RevealEntry {
  /** Document offset of the block's `ritual:name` line. */
  pos: number
  open: number
}

const openMovement = StateEffect.define<{ pos: number; open: number }>()

function seedReveal(state: EditorState, blocks: readonly RitualBlock[]): RevealEntry[] {
  return blocks.map((block) => ({
    pos: state.doc.line(block.nameLine).from,
    open: initialReveal(block),
  }))
}

const ritualRevealField = StateField.define<RevealEntry[]>({
  create(state) {
    return seedReveal(state, state.field(ritualDocField).blocks)
  },
  update(value, tr) {
    let next = value
    if (tr.docChanged) {
      // Re-key against the blocks as they now stand: a block that moved keeps
      // its count, a newly begun one is seeded, and one that was deleted (or
      // dissolved by "free write") drops out.
      const mapped = value.map((entry) => ({
        pos: tr.changes.mapPos(entry.pos, 1),
        open: entry.open,
      }))
      next = tr.state.field(ritualDocField).blocks.map((block) => {
        const pos = tr.state.doc.line(block.nameLine).from
        const prior = mapped.find((entry) => entry.pos === pos)
        return { pos, open: prior ? prior.open : initialReveal(block) }
      })
    }
    for (const effect of tr.effects) {
      if (!effect.is(openMovement)) continue
      const { pos, open } = effect.value
      next = next.map((entry) =>
        entry.pos === pos ? { pos, open: Math.max(entry.open, open) } : entry,
      )
    }
    return next
  },
})

// ── Decorations ────────────────────────────────────────────────────────────
//
// Each `ritual:*` token line is *replaced* by its block widget (the ritual
// masthead, a movement's prompt, the threshold to the next movement, or — for a
// movement not yet opened — nothing at all). The replace range stops at the
// line's text: the trailing newline survives, so the answer line below stays its
// own editable line, and each prompt renders directly above the answer it
// introduces.
//
// The trailing newline must stay OUT of the range. Pulling it in looks tempting
// (it removes one of the blank stubs below) but it makes CodeMirror render the
// widget twice — one token, two DOM blocks — the same artifact that once made
// scripture blocks appear to duplicate on Enter.
//
// We do NOT hide anything with `display:none`: CodeMirror can't measure a
// `display:none` `.cm-line`, so it keeps a stale height estimate (a hidden 1-line
// token measures as ~16px instead of 0) and its coordinate→position map drifts
// out of sync with the DOM. That drift made clicks on a ritual answer line resolve
// to the wrong line — the reported "can't click the last line of a response" bug.
// A zero-height box is measured like any other, so the map stays aligned.

/** Marks the writing line below a prompt so it has a comfortable click target. */
const answerLineDeco = Decoration.line({ class: 'cm-practice-answer' })
/** Zero-styling mark used only to keep token lines atomic for cursor motion. */
const atomicMark = Decoration.mark({})
/**
 * Collapses the blank stubs CodeMirror renders around a replaced token line.
 *
 * A block widget sits *between* line boxes, so the line it replaces still emits
 * its own (now empty) `.cm-line` on either side of the widget: two blank boxes
 * of a full line-height each, per prompt. That was a line of nothing above every
 * label and another between every question and the answer it asks for — which
 * flattened the spacing until nothing in a ritual looked grouped with anything
 * else. Both stubs belong to the token line, so a line decoration reaches them
 * and nothing else; the answer below is a different line and keeps its height.
 *
 * `height: 0`, not `display: none` — see the note above.
 */
const tokenLineDeco = Decoration.line({ class: 'cm-ritual-tokenline' })
/** The (always empty) answer line of a movement that has not been opened yet. */
const closedLineDeco = Decoration.line({ class: 'cm-ritual-closedline' })
/** Every line of a ritual, carrying the spine that makes the block a container. */
const bodyLineDeco = Decoration.line({ class: 'cm-ritual-body' })
/** Same, while the caret is inside — the block lights as you step into it. */
const heldLineDeco = Decoration.line({ class: 'cm-ritual-body cm-ritual-body--held' })

interface PracticeDecorations {
  /** All ritual decorations (hidden tokens, prompts, thresholds, colophon). */
  deco: DecorationSet
  /** Just the hidden token lines — kept atomic so the caret skips the markup. */
  atomic: DecorationSet
  /** The block the caret is inside, in document offsets — drives the hold. */
  live: { from: number; to: number } | null
}

const EMPTY: PracticeDecorations = {
  deco: Decoration.none,
  atomic: Decoration.none,
  live: null,
}

function buildDecorations(state: EditorState): PracticeDecorations {
  const { blocks, hasRituals } = state.field(ritualDocField)
  if (!hasRituals || blocks.length === 0) return EMPTY

  const { doc } = state
  const reveal = state.field(ritualRevealField)
  const caretLine = doc.lineAt(state.selection.main.head).number
  const liveBlock = ritualBlockAtLine(blocks, caretLine)

  const ranges: Range<Decoration>[] = []
  const atomicRanges: Range<Decoration>[] = []

  /** Keep a token line's markup atomic so the caret arrows straight past it. */
  const makeAtomic = (from: number, to: number) => {
    const atomicTo = Math.min(to + 1, doc.length)
    if (atomicTo > from) atomicRanges.push(atomicMark.range(from, atomicTo))
  }

  for (const block of blocks) {
    const nameLine = doc.line(block.nameLine)
    const stored = reveal.find((entry) => entry.pos === nameLine.from)?.open
    const open = clampReveal(block, stored ?? initialReveal(block))
    const total = block.movements.length
    const paced = open < total
    const complete = isRitualComplete(block)
    const current = currentMovementIndex(block, open)
    const held = liveBlock === block
    const practice = PRACTICE_BY_NAME.get(block.name)

    // The spine: one line decoration across the whole block, so the ritual reads
    // as a container rather than as questions floating in the entry.
    for (let n = block.nameLine; n <= block.endLine; n++) {
      ranges.push((held ? heldLineDeco : bodyLineDeco).range(doc.line(n).from))
    }

    // The masthead.
    ranges.push(tokenLineDeco.range(nameLine.from))
    makeAtomic(nameLine.from, nameLine.to)
    ranges.push(
      Decoration.replace({
        widget: new RitualHeaderWidget(block.name, paced, held),
        block: true,
        inclusive: false,
      }).range(nameLine.from, nameLine.to),
    )

    for (const movement of block.movements) {
      const i = movement.index
      const tokenLine = doc.line(movement.tokenLine)
      ranges.push(tokenLineDeco.range(tokenLine.from))
      makeAtomic(tokenLine.from, tokenLine.to)

      const prompt = practice?.prompts.find((p) => p.label === movement.label)

      if (i < open) {
        // An opened movement. The one being written stands at full presence;
        // the ones already passed recede — by OPACITY ONLY. Collapsing them
        // would reflow the block above the caret and yank the writing line out
        // from under the writer at the exact moment they are mid-sentence.
        // They only recede while the writer is actually standing in an
        // unfinished practice; read back later, the whole thing is a record and
        // every question is present again.
        const tone = held && !complete && i !== current ? 'passed' : 'live'
        ranges.push(
          Decoration.replace({
            widget: new RitualPromptWidget(
              movement.label,
              prompt?.question ?? '',
              i === 0,
              tone,
              held,
            ),
            block: true,
            inclusive: false,
          }).range(tokenLine.from, tokenLine.to),
        )
      } else if (i === open) {
        // The threshold to the next movement.
        ranges.push(
          Decoration.replace({
            widget: new RitualAdvanceWidget(movement.label, total - open, held),
            block: true,
            inclusive: false,
          }).range(tokenLine.from, tokenLine.to),
        )
      } else {
        // Still closed, and nothing to show for it.
        ranges.push(
          Decoration.replace({
            widget: new RitualClosedWidget(),
            block: true,
            inclusive: false,
          }).range(tokenLine.from, tokenLine.to),
        )
      }

      // No answer line follows (token is the last line) — nothing to write into.
      if (movement.answerLine === movement.tokenLine) continue
      const answer = doc.line(movement.answerLine)

      if (i >= open) {
        // A closed movement's answer line folds away with it. `revealFloor`
        // guarantees a closed movement is empty, but check anyway: no code path
        // is ever allowed to hide something the writer has written.
        if (movement.filled) continue
        ranges.push(closedLineDeco.range(answer.from))
        makeAtomic(answer.from, answer.to)
        continue
      }

      // The min-height is a click target for an *empty* answer line. Once the
      // movement has content (text or an embedded block like scripture), the
      // content sets the height — forcing min-height there just opens a dead gap.
      if (movement.filled) continue
      ranges.push(answerLineDeco.range(answer.from))

      // The example phrasing belongs to the movement being written and nowhere
      // else. Ghosting it onto every open-but-empty line put the app's words on
      // several of the writer's lines at once.
      if (i === current && !complete && prompt?.placeholder) {
        ranges.push(
          Decoration.widget({
            widget: new RitualPlaceholderWidget(prompt.placeholder),
            side: 1,
          }).range(answer.from),
        )
      }
    }

    // The dismissal. Placed at the END of the block's last written line, so it
    // renders BELOW the caret — finishing the final movement must never reflow
    // anything above the line being written.
    if (complete) {
      ranges.push(
        Decoration.widget({
          widget: new RitualColophonWidget(block.name, practice?.origin ?? '', held),
          block: true,
          side: 1,
        }).range(doc.line(block.endLine).to),
      )
    }
  }

  const live = liveBlock
    ? { from: doc.line(liveBlock.nameLine).from, to: doc.line(liveBlock.endLine).to }
    : null

  return {
    deco: Decoration.set(ranges, true),
    atomic: Decoration.set(atomicRanges, true),
    live,
  }
}

const practiceField = StateField.define<PracticeDecorations>({
  create(state) {
    return buildDecorations(state)
  },
  update(value, tr) {
    // Documents without a ritual — nearly all of them — cost one flag read per
    // transaction and nothing else. The writing surface is sacred.
    if (!tr.state.field(ritualDocField).hasRituals) return EMPTY
    // Which movement is live, and whether the block is held, both depend on
    // where the caret is — so unlike before, a selection change rebuilds too.
    if (tr.docChanged || tr.selection || tr.effects.some((e) => e.is(openMovement))) {
      return buildDecorations(tr.state)
    }
    return value
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
})

/**
 * The ritual the caret is standing in, as document offsets — or null.
 *
 * Read by `ritualHold.ts` to let the rest of the entry recede while a practice
 * has hold of the page.
 */
export function liveRitualRange(state: EditorState): { from: number; to: number } | null {
  return state.field(practiceField, false)?.live ?? null
}

// ── The ritual's type hierarchy ──────────────────────────────────────────────
//
// Four ranks, and they must never be confusable, because a ritual puts the app's
// voice and the writer's voice on the same page:
//
//   1. the writer's answer — roman, full size, --text        (loudest, always)
//   2. the question        — italic, 0.95em, --text-dim      (the given voice)
//   3. the movement label  — 0.6em tracked caps, --text-faint (a tab, not a headline)
//   4. the ritual name     — the block's masthead; the ONE accent, over a hairline
//
// What made this read as noise before: the name and the movement labels were the
// same treatment (tracked amber caps, and the label was the LARGER of the two),
// so the container and its parts sat at the same rank and the accent repeated
// five times a screen. And the question was set BIGGER than the answer, so the
// largest thing on a page of someone's prayers was the app talking. Rank here is
// carried by size and colour together; the accent marks exactly one thing.
//
// Spacing is in `em` (not rem) throughout so the whole block scales with the
// reader's own font-size setting rather than drifting from it.
const practiceTheme = EditorView.theme({
  // Writing line beneath a prompt — a generous, obvious target to click into.
  '.cm-practice-answer': {
    minHeight: '2.1em',
  },
  // ── The container ──────────────────────────────────────────────────────
  // A hairline down the left of every line in the block, matched on the widgets
  // between those lines, so the rule runs unbroken from masthead to colophon.
  // Without it a ritual is questions floating in the entry with nothing to say
  // they belong together.
  '.cm-ritual-body, .cm-practice-header, .cm-practice-prompt, .cm-ritual-advance, .cm-ritual-colophon, .cm-ritual-closed':
    {
      borderLeft: '1px solid color-mix(in srgb, var(--text-faint) 30%, transparent)',
      paddingLeft: '1.15em',
      transition: 'border-color 220ms ease, background-color 220ms ease',
    },
  // Standing inside the practice lights its spine and lays down the faintest
  // ground. Stepping out lets go of both.
  '.cm-ritual-body--held, .cm-practice-header[data-held], .cm-practice-prompt[data-held], .cm-ritual-advance[data-held], .cm-ritual-colophon[data-held], .cm-ritual-closed[data-held]':
    {
      borderLeftColor: 'color-mix(in srgb, var(--accent) 45%, transparent)',
      backgroundColor: 'color-mix(in srgb, var(--accent) 3.5%, transparent)',
    },
  // The replaced token line's leftover stubs — see tokenLineDeco. The line
  // decoration reaches only the stub *before* the widget; the one after it is a
  // separate block and can only be addressed by adjacency. Both selectors are
  // safe: a block widget always renders its own line's remainder next to it, so
  // the element immediately after one of these widgets is never a writing line.
  // Padding is zeroed too — the first line of an entry carries the title's
  // bottom padding, which `height: 0` alone would leave behind.
  '.cm-line.cm-ritual-tokenline, .cm-line.cm-ritual-closedline, .cm-practice-header + .cm-line, .cm-practice-prompt + .cm-line, .cm-ritual-advance + .cm-line, .cm-ritual-closed + .cm-line':
    {
      height: '0',
      padding: '0',
      border: 'none',
      overflow: 'hidden',
    },
  // A movement not yet opened: present in the document, absent from the page.
  '.cm-ritual-closed': {
    height: '0',
    padding: '0',
    border: 'none',
    overflow: 'hidden',
  },
  '.cm-practice-prompt': {
    display: 'block',
    // Spacing as PADDING, not margin: CodeMirror measures a block widget's
    // height from its bounding rect, which excludes margins — an outer margin
    // would push the DOM down without being counted, drifting the
    // coordinate→position map and again making answer lines below unclickable.
    //
    // The asymmetry is the grouping: a wide gap above separates one movement
    // from the last, a tight one below binds the question to the answer it asks.
    padding: '1.9em 0 0.3em 1.15em',
    userSelect: 'none',
    transition: 'opacity 220ms ease',
  },
  // The header's hairline already opens the block, so the first prompt would
  // read as adrift with a full movement gap above it.
  '.cm-practice-prompt--first': {
    paddingTop: '0.7em',
  },
  // A movement already passed, while the writer is still inside the practice.
  // Its words stay at full strength — this quiets the app's voice, never theirs.
  '.cm-practice-prompt[data-tone="passed"]': {
    opacity: '0.4',
  },
  '.cm-practice-prompt[data-tone="passed"]:hover': {
    opacity: '1',
  },
  // Small letter-spaced cap label — the same motif, and now the same colour, as
  // the scripture/prayer block labels, so the whole surface reads as one type
  // system. It names the movement; it is not the movement.
  '.cm-practice-prompt__label': {
    display: 'block',
    fontFamily: 'var(--font-editor)',
    fontSize: '0.6em',
    fontWeight: '500',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--text-faint, #c4b5a8)',
    marginBottom: '0.3em',
  },
  // The "given voice" — italic, airy, and deliberately set BELOW the writer's
  // own words. Optical sizing lets variable serifs render this at a display
  // weight. Italic is the tell: everything the app says is italic, everything
  // the writer will put on the page is roman.
  '.cm-practice-prompt__question': {
    margin: '0',
    fontFamily: 'var(--font-editor)',
    fontStyle: 'italic',
    fontWeight: '300',
    fontSize: '0.95em',
    lineHeight: '1.5',
    letterSpacing: '0.005em',
    color: 'var(--text-dim, #4a3f35)',
    fontOpticalSizing: 'auto',
  },
  // Roman, not italic: this one sits on the writer's own line, so it takes the
  // writer's typography and only ghosts it. Italic here made an unanswered
  // movement read as a second question stacked under the first.
  '.cm-practice-placeholder': {
    color: 'var(--text-faint, #c4b5a8)',
    pointerEvents: 'none',
  },
  // ── The threshold between movements ────────────────────────────────────
  '.cm-ritual-advance': {
    display: 'flex',
    alignItems: 'center',
    gap: '0.9em',
    padding: '1.5em 0 0.4em 1.15em',
    userSelect: 'none',
  },
  '.cm-ritual-advance__dots': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4em',
  },
  '.cm-ritual-dot': {
    display: 'block',
    width: '0.32em',
    height: '0.32em',
    borderRadius: '50%',
    border: '1px solid color-mix(in srgb, var(--text-faint) 70%, transparent)',
  },
  '.cm-ritual-advance__next': {
    fontFamily: 'var(--font-editor)',
    fontSize: '0.72em',
    fontWeight: '500',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-faint, #c4b5a8)',
    background: 'none',
    border: 'none',
    padding: '0.2em 0',
    cursor: 'pointer',
    transition: 'color 200ms ease',
  },
  '.cm-ritual-advance__next:hover, .cm-ritual-advance[data-held] .cm-ritual-advance__next': {
    color: 'var(--accent, #c8853a)',
  },
  // ── The dismissal ──────────────────────────────────────────────────────
  '.cm-ritual-colophon': {
    display: 'block',
    padding: '1.1em 0 0.2em 1.15em',
    userSelect: 'none',
  },
  '.cm-ritual-colophon__text': {
    display: 'block',
    paddingTop: '0.9em',
    borderTop: '1px solid color-mix(in srgb, var(--text-faint) 38%, transparent)',
    fontFamily: 'var(--font-editor)',
    fontSize: '0.62em',
    fontStyle: 'italic',
    fontWeight: '300',
    letterSpacing: '0.06em',
    color: 'var(--text-faint, #c4b5a8)',
  },
  // The block's masthead: the ritual's name over a hairline that spans the
  // writing column, so everything below plainly belongs to it. Padding (not
  // margin) so CodeMirror counts the spacing in the block's measured height —
  // see the note on .cm-practice-prompt.
  '.cm-practice-header': {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.55em',
    // On a narrow column the name alone fills the row, and the actions have to
    // be able to drop below it — squeezed onto the same line they were breaking
    // mid-word ("abo/ut", "free/write").
    flexWrap: 'wrap',
    rowGap: '0.5em',
    // The top gap is the block's own: a ritual begun partway down an entry has
    // prose directly above it, and the masthead has to read as the start of
    // something rather than as the next line of what came before.
    padding: '1.2em 0 0.5em 1.15em',
    borderBottom: '1px solid color-mix(in srgb, var(--text-faint) 38%, transparent)',
    userSelect: 'none',
  },
  '.cm-practice-header__name': {
    fontFamily: 'var(--font-editor)',
    fontSize: '0.7em',
    fontWeight: '500',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: 'var(--accent, #c8853a)',
  },
  '.cm-practice-action': {
    flex: '0 0 auto',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-editor)',
    fontSize: '0.55em',
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
  // Touch devices have no hover — keep the actions quietly visible there, and
  // give the one control that carries the practice forward a real thumb target.
  // 48px is the floor in MOBILE_DESIGN.md, and it applies to a control in the
  // document exactly as it would to one in a toolbar.
  '@media (hover: none)': {
    '.cm-practice-action': { opacity: '0.55' },
    '.cm-ritual-advance': {
      minHeight: '48px',
      paddingTop: '0.6em',
    },
    '.cm-ritual-advance__next': {
      padding: '0.9em 0',
      fontSize: '0.75em',
    },
    // No hover to reveal them with, so a passed movement stays legible.
    '.cm-practice-prompt[data-tone="passed"]': { opacity: '0.5' },
  },
  '@media (prefers-reduced-motion: reduce)': {
    '.cm-ritual-body, .cm-practice-header, .cm-practice-prompt, .cm-ritual-advance, .cm-ritual-colophon':
      {
        transition: 'none',
      },
  },
})

// ── Editing the scaffolding ─────────────────────────────────────────────────
//
// Ritual entries are just text, so changing them uses gestures you already
// know — plus undo as a fearless safety net:
//   • Next movement   → the block's "Next" action, or ⌘⇧↵ (advanceRitual)
//   • Open everything → the header's "show all" action
//   • Skip a prompt   → Backspace on its empty line (deletePracticeSection)
//   • Free write      → the header's "free write" action (dissolvePracticeBlockAt)
//   • Swap / add      → run /ritual again (smart replace/append in the hook)

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

// ── Opening the next movement ───────────────────────────────────────────────

/**
 * The block at a document position, with the offset its reveal count is keyed
 * by. `posAtDOM` on a block widget can resolve a line or two off, which is why
 * the fallback walks back to the nearest ritual that started above it.
 */
function ritualAt(
  state: EditorState,
  pos: number,
): { block: RitualBlock; nameFrom: number; open: number } | null {
  const { blocks, hasRituals } = state.field(ritualDocField)
  if (!hasRituals) return null
  const line = state.doc.lineAt(Math.max(0, Math.min(pos, state.doc.length))).number
  let block = ritualBlockAtLine(blocks, line)
  if (!block) {
    for (const candidate of blocks) {
      if (candidate.nameLine <= line) block = candidate
    }
  }
  if (!block) return null
  const nameFrom = state.doc.line(block.nameLine).from
  const stored = state.field(ritualRevealField).find((entry) => entry.pos === nameFrom)?.open
  return { block, nameFrom, open: clampReveal(block, stored ?? initialReveal(block)) }
}

/**
 * Open the next movement and put the caret on its writing line.
 *
 * Returns false when there is nothing to open, so the keymap falls through.
 */
function advanceRitualAt(view: EditorView, pos: number): boolean {
  const at = ritualAt(view.state, pos)
  if (!at) return false
  const { block, nameFrom, open } = at
  if (open >= block.movements.length) return false

  const next = block.movements[open]!
  view.dispatch({
    effects: openMovement.of({ pos: nameFrom, open: open + 1 }),
    selection: { anchor: view.state.doc.line(next.answerLine).from },
    scrollIntoView: true,
  })
  view.focus()
  return true
}

/** ⌘⇧↵ — open the next movement of the ritual the caret is in. */
function advanceRitualMovement(view: EditorView): boolean {
  return advanceRitualAt(view, view.state.selection.main.head)
}

/** The header's "show all" — open every remaining movement at once. */
function showAllMovementsAt(view: EditorView, pos: number): void {
  const at = ritualAt(view.state, pos)
  if (!at) return
  view.dispatch({
    effects: openMovement.of({ pos: at.nameFrom, open: at.block.movements.length }),
  })
  view.focus()
}

/**
 * Paint hidden `ritual:*` tokens as their prompts, one movement at a time, and
 * fold away the movements that have not been opened. Display-only: the markdown
 * tokens stay in the document so the structure survives save/sync, but the
 * prompt text is never persisted.
 *
 * @param onAbout Open the practice's "about" sheet (by practice name).
 */
export function practicePromptExtension(onAbout: (name: string) => void): Extension {
  return [
  practiceTheme,
  // Order matters: the parse feeds the reveal counts, and both feed the
  // decorations. A field can only read one registered before it.
  ritualDocField,
  ritualRevealField,
  practiceField,
  // Treat the hidden token lines as atoms so the caret skips them and a
  // backspace from a blank answer line removes the whole prompt in one stroke.
  EditorView.atomicRanges.of((view) => view.state.field(practiceField).atomic),
  // Backspace on an empty movement line removes that single prompt.
  // ⌘⇧↵ opens the next movement — plain ⌘↵ is focus mode's toggle.
  Prec.high(
    keymap.of([
      { key: 'Backspace', run: deletePracticeSection },
      { key: 'Mod-Shift-Enter', run: advanceRitualMovement },
    ]),
  ),
  // The header's actions act on the whole block; clicking a prompt drops the
  // caret into that prompt's answer line.
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
      // "show all" — the release valve for anyone who wants the whole shape.
      const showAll = node?.closest('.cm-practice-action--showall')
      if (showAll) {
        event.preventDefault()
        showAllMovementsAt(view, view.posAtDOM(showAll))
        return true
      }
      // The threshold to the next movement.
      const advance = node?.closest('.cm-ritual-advance')
      if (advance) {
        event.preventDefault()
        advanceRitualAt(view, view.posAtDOM(advance))
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
 * once writing has begun — so re-running /ritual is both "swap" and "add".
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
