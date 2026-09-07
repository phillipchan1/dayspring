import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'
import { RangeSet, RangeSetBuilder, StateField, type Extension, type Text } from '@codemirror/state'
import { type ParsedSpiritualBlock } from '@/lib/spiritualBlocks'
import type { SpiritualItemType } from '@/lib/types'
import {
  computeBlockPanelAnchor,
  computeRangePanelAnchor,
  type InlinePanelAnchor,
} from './inlinePanelAnchor'
import { MARK_KIND, MARKED_LINE_KINDS } from '@/lib/markKinds'
import { spiritualBlocksField } from './spiritualBlocksField'

/**
 * How a declared marking is drawn.
 *
 * One rule decides the shape: **your words get marked, borrowed words get set
 * apart.** A prayer and a sense are the writer's own sentences, so they stay in
 * the prose and take a line decoration — the paragraph you wrote, with a hand
 * beside it. Scripture is not the writer's sentence, and quoted matter has
 * always been set off in a journal, so it keeps its block widget.
 *
 * Nothing about the document changes. The ```dayspring-*``` fence is only a
 * serialization and still carries the id that links to `spiritual_items`, so
 * every existing entry gains the new reading with no migration, the char offsets
 * in `scripture_refs` keep pointing where they pointed, and the edit panel still
 * resolves against the same fence range. Only the drawing changed.
 *
 * A side benefit worth naming, since it cost a day to find once: prayer and
 * sense stop having the shape that produces the block-widget line stubs (a
 * `block: true` replace leaves an empty line box on either side of the widget),
 * so the two blank rows they used to open with are gone by construction.
 */

/** A spiritual block the user clicked, resolved fresh from the live document. */
export interface SpiritualBlockEditTarget {
  id: string
  type: SpiritualItemType
  content: string
  reference: string | null
  /** Character range of the fenced block in the current document. */
  from: number
  to: number
}

/** The kinds that render as marked lines rather than as a set-apart block. */
type MarkedKind = Exclude<SpiritualItemType, 'scripture'>

class ScriptureBlockWidget extends WidgetType {
  constructor(
    readonly id: string,
    readonly content: string,
    readonly reference: string | null,
  ) {
    super()
  }

  eq(other: ScriptureBlockWidget): boolean {
    return (
      other.id === this.id &&
      other.content === this.content &&
      other.reference === this.reference
    )
  }

  toDOM(): HTMLElement {
    const root = document.createElement('div')
    root.className = 'cm-spiritual-block cm-spiritual-block--scripture'
    root.setAttribute('contenteditable', 'false')
    root.dataset.blockId = this.id
    root.title = 'Click to read the chapter'

    const verse = document.createElement('p')
    verse.className = 'cm-spiritual-block__verse'
    verse.textContent = this.content || ' '
    root.append(verse)

    if (this.reference) {
      const ref = document.createElement('p')
      ref.className = 'cm-spiritual-block__reference'
      ref.textContent = this.reference
      root.append(ref)
    }

    const menu = document.createElement('button')
    menu.type = 'button'
    menu.className = 'cm-spiritual-block__menu'
    menu.setAttribute('aria-label', 'Edit scripture')
    menu.textContent = '⋯'
    root.append(menu)
    return root
  }

  ignoreEvent(): boolean {
    return false
  }
}

/**
 * The fence delimiters, collapsed to nothing.
 *
 * `height: 0` and not `display: none`: CodeMirror can't measure a `display:none`
 * line, so it keeps a stale height estimate and its coordinate→position map
 * drifts out of sync with the DOM — the bug that once made the last line of a
 * ritual answer unclickable. A zero-height box measures as zero, honestly.
 */
const fenceLineDeco = Decoration.line({ class: 'cm-mark-fence' })

/**
 * Cached per (kind, first, last) — eight objects for the life of the module.
 * Stable identities let CodeMirror's RangeSet diffing skip untouched lines
 * instead of rebuilding the decoration set on every keystroke.
 */
const markLineDecos = new Map<string, Decoration>()

function markLineDeco(kind: MarkedKind, first: boolean, last: boolean): Decoration {
  const key = `${kind}:${first ? 'f' : '-'}${last ? 'l' : '-'}`
  let deco = markLineDecos.get(key)
  if (!deco) {
    let cls = `cm-mark-line cm-mark-line--${kind}`
    if (first) cls += ' cm-mark-line--first'
    if (last) cls += ' cm-mark-line--last'
    deco = Decoration.line({ class: cls })
    markLineDecos.set(key, deco)
  }
  return deco
}

function clampToDoc(pos: number, doc: Text): number {
  return Math.max(0, Math.min(pos, doc.length))
}

/**
 * The writer's own lines inside a fence — everything between the opening
 * delimiter and the closing one. Never null in practice: `parseSpiritualBlocks`
 * only emits a block once it has found a closing fence, and an empty capture
 * still serializes one blank body line.
 */
export function markedRunLines(
  doc: Text,
  block: ParsedSpiritualBlock,
): { firstLine: number; lastLine: number } | null {
  const open = doc.lineAt(clampToDoc(block.from, doc))
  // `block.to` sits just past the closing fence, and past its newline when the
  // block isn't the last thing in the document.
  const end =
    block.to > block.from && doc.sliceString(block.to - 1, block.to) === '\n' ? block.to - 1 : block.to
  const close = doc.lineAt(clampToDoc(end, doc))
  if (close.number < open.number + 2) return null
  return { firstLine: open.number + 1, lastLine: close.number - 1 }
}

function buildDecorations(blocks: readonly ParsedSpiritualBlock[], doc: Text): DecorationSet {
  if (blocks.length === 0) return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()
  for (const block of blocks) {
    if (block.type === 'scripture') addScriptureBlock(builder, block, doc)
    else addMarkedLines(builder, block, doc)
  }
  return builder.finish()
}

function addScriptureBlock(
  builder: RangeSetBuilder<Decoration>,
  block: ParsedSpiritualBlock,
  doc: Text,
): void {
  // End the replace range at the closing fence's line boundary, NOT past the
  // trailing newline. A block:true replace range that extends beyond the final
  // line break (e.g. a block at end-of-document, then Enter pressed to write
  // beneath it) makes CodeMirror render the widget DOM twice — one fence in the
  // text, two visible blocks, deleting either removes both. Stopping at the
  // newline keeps the range aligned to a line boundary and renders exactly one.
  // `block.to` stays untouched so click/edit/atomic logic keeps the full range.
  let to = block.to
  if (to > block.from && doc.sliceString(to - 1, to) === '\n') to -= 1
  if (to <= block.from) return
  builder.add(
    block.from,
    to,
    Decoration.replace({
      widget: new ScriptureBlockWidget(block.id, block.content, block.reference ?? null),
      block: true,
      inclusive: false,
    }),
  )
}

/**
 * Draw a prayer or a sense: the two fence lines collapsed to nothing, and the
 * lines between them carrying the kind's hand.
 */
function addMarkedLines(
  builder: RangeSetBuilder<Decoration>,
  block: ParsedSpiritualBlock,
  doc: Text,
): void {
  const kind = block.type as MarkedKind
  const open = doc.lineAt(clampToDoc(block.from, doc))
  const end =
    block.to > block.from && doc.sliceString(block.to - 1, block.to) === '\n' ? block.to - 1 : block.to
  const close = doc.lineAt(clampToDoc(end, doc))

  builder.add(open.from, open.from, fenceLineDeco)

  const first = open.number + 1
  const last = close.number - 1
  for (let n = first; n <= last; n++) {
    const line = doc.line(n)
    builder.add(line.from, line.from, markLineDeco(kind, n === first, n === last))
  }

  if (close.number > open.number) builder.add(close.from, close.from, fenceLineDeco)
}

const spiritualBlockTheme = EditorView.theme({
  // ——— Scripture. Borrowed words, set apart from the prose. ———
  '.cm-spiritual-block': {
    display: 'block',
    margin: '0.2rem 0',
    userSelect: 'none',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    // opacity is in the list so focus-mode dimming (see dimming.ts) fades the
    // block in/out smoothly rather than snapping.
    transition: 'background 120ms ease, box-shadow 120ms ease, opacity 160ms ease',
  },
  '.cm-spiritual-block:hover': {
    background: 'color-mix(in srgb, var(--accent-soft) 30%, transparent)',
    boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent)',
  },
  '.cm-spiritual-block--scripture': {
    position: 'relative',
    padding: '0.1rem 1.6rem 0.1rem 1rem',
    borderLeft: '1px solid color-mix(in srgb, var(--accent) 32%, transparent)',
    background: 'transparent',
  },
  '.cm-spiritual-block__menu': {
    position: 'absolute',
    top: '0.05rem',
    right: '0',
    width: '1.4rem',
    height: '1.4rem',
    padding: '0',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-faint)',
    fontSize: '1rem',
    lineHeight: '1',
    letterSpacing: '0',
    cursor: 'pointer',
    opacity: '0',
    transition: 'opacity 120ms ease, color 120ms ease',
  },
  '.cm-spiritual-block--scripture:hover .cm-spiritual-block__menu, .cm-spiritual-block__menu:focus-visible': {
    opacity: '1',
  },
  '@media (hover: none)': {
    '.cm-spiritual-block__menu': {
      opacity: '0.55',
    },
  },
  '.cm-spiritual-block__menu:hover': {
    color: 'var(--text)',
  },
  // The quoted verse reads as an elegant pull-quote: italic, a touch larger for
  // presence, airy leading, optically sized on variable serifs.
  '.cm-spiritual-block__verse': {
    margin: '0',
    fontFamily: 'var(--font-editor)',
    // A tier below the practice question (1.06em) so a quoted verse reads as
    // supporting content, not a competing prompt.
    fontSize: '0.9em',
    fontStyle: 'italic',
    lineHeight: '1.6',
    letterSpacing: '0.005em',
    color: 'var(--text)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontOpticalSizing: 'auto',
  },
  // The citation echoes the cap-label motif — a tracked small cap, not a stray
  // mono line — which is what knits the verse into the rest of the surface.
  '.cm-spiritual-block__reference': {
    margin: '0.55em 0 0',
    fontFamily: 'var(--font-editor)',
    fontSize: '0.66em',
    fontWeight: '500',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    lineHeight: '1.4',
    color: 'var(--text-faint)',
  },

  // ——— Prayer and sense. The writer's own lines, marked. ———
  //
  // The fence delimiters are still in the document — search, sync and export all
  // read them — they simply have no height. Padding is zeroed too: the first
  // line of an entry carries the title's bottom padding, which `height: 0`
  // alone would leave behind as a visible gap above the mark.
  '.cm-line.cm-mark-fence': {
    height: '0',
    padding: '0',
    overflow: 'hidden',
  },
  '.cm-mark-line': {
    // The rule is a background image, not a border and not an inset shadow.
    // Both of those run the full height of every line, so a prayer followed
    // immediately by a desire — which is exactly the shape a real capture makes
    // — drew one unbroken bar down two different markings. A background can be
    // sized short of the box, which is what gives a run ends.
    paddingLeft: '0.85rem',
    backgroundSize: '3px 100%',
    backgroundPosition: '0 0',
    backgroundRepeat: 'no-repeat',
    cursor: 'pointer',
    transition: 'background-color 120ms ease',
  },
  // A fence body parses as a CommonMark code block, so every character inside
  // one is tagged `t.monospace` and would render in --font-mono at --md-code.
  // That was invisible while the text lived under a replace widget and is very
  // visible now. The writer's sentence is prose and has to look like prose.
  '.cm-mark-line span': {
    fontFamily: 'var(--font-editor)',
    color: 'inherit',
  },
  // Air at the ends of a run, as PADDING and never margin: CodeMirror measures a
  // line from its bounding rect, which excludes margins, so a margin here would
  // push the DOM down without being counted and drift the coordinate→position
  // map. It is also what separates two markings that sit on consecutive lines —
  // a prayer immediately followed by a sense is the shape a real capture makes.
  // Air at the ends of a run, as PADDING and never margin: CodeMirror measures a
  // line from its bounding rect, which excludes margins, so a margin here would
  // push the DOM down without being counted and drift the coordinate→position
  // map. The rule stops short of that padding, so the gap is real.
  '.cm-mark-line--first': {
    paddingTop: '0.35em',
    backgroundPosition: '0 0.35em',
    backgroundSize: '3px calc(100% - 0.35em)',
    borderTopLeftRadius: 'var(--radius-md)',
    borderTopRightRadius: 'var(--radius-md)',
  },
  '.cm-mark-line--last': {
    paddingBottom: '0.35em',
    backgroundSize: '3px calc(100% - 0.35em)',
    borderBottomLeftRadius: 'var(--radius-md)',
    borderBottomRightRadius: 'var(--radius-md)',
  },
  // A one-line marking is both ends at once, and must lose the padding twice.
  // Listed after the two above so it wins on specificity and on source order.
  '.cm-mark-line--first.cm-mark-line--last': {
    backgroundSize: '3px calc(100% - 0.7em)',
  },
  ...perKindRules(),
})

/**
 * One rule per marked kind, generated from the kind table.
 *
 * Every kind gets the same treatment — a rule beside the lines, in its own tone,
 * and no ground at all until you hover. The prose is the writer's prose and a
 * marking has no business restyling it: which kind it is comes from the hand in
 * the margin, not from the sentence changing colour or slant. That is the same
 * decision as "no kind label" — if the type had to be legible from the line
 * itself, eight kinds would mean eight ways someone's own writing can look.
 *
 * The one exception is the one the tradition asks for.
 */
function perKindRules(): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {}
  for (const meta of MARKED_LINE_KINDS) {
    if (meta.kind === 'absence') continue
    rules[`.cm-mark-line--${meta.kind}`] = {
      backgroundImage: `linear-gradient(${meta.tone}, ${meta.tone})`,
    }
    rules[`.cm-mark-line--${meta.kind}:hover`] = {
      backgroundColor: `color-mix(in srgb, ${meta.tone} 8%, transparent)`,
    }
  }

  // Absence is a line with a gap in it — never a solid bar, and never an X. A
  // continuous rule would say the same thing every other kind says; the break is
  // the whole content of the mark, and it has to be in the drawing before it is
  // in any label.
  const absence = MARK_KIND.absence.tone
  rules['.cm-mark-line--absence'] = {
    backgroundImage: `repeating-linear-gradient(to bottom, ${absence} 0 5px, transparent 5px 11px)`,
  }
  rules['.cm-mark-line--absence:hover'] = {
    backgroundColor: `color-mix(in srgb, ${absence} 7%, transparent)`,
  }

  return rules
}

/** Block replace widgets must live on EditorView.decorations, not ViewPlugin. */
const spiritualBlockField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state.field(spiritualBlocksField), state.doc)
  },
  update(deco, tr) {
    if (tr.docChanged) return buildDecorations(tr.state.field(spiritualBlocksField), tr.state.doc)
    return deco.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

/** Where a panel opened from this block should sit. */
function anchorFor(
  view: EditorView,
  block: ParsedSpiritualBlock,
  scriptureEl: HTMLElement | null,
): InlinePanelAnchor {
  // A replace widget has no measurable text positions inside it — measure the
  // element. A marked run is ordinary text, so measure the run itself rather
  // than the single line that happened to be clicked; otherwise a three-line
  // prayer opens its panel over its own last two lines.
  if (scriptureEl) return computeBlockPanelAnchor(view, scriptureEl)
  const doc = view.state.doc
  const run = markedRunLines(doc, block)
  if (!run) return computeRangePanelAnchor(view, block.from, block.from)
  return computeRangePanelAnchor(view, doc.line(run.firstLine).from, doc.line(run.lastLine).to)
}

/**
 * Click a rendered marking to edit it: resolve the block fresh from the live
 * document (positions stay correct even after edits above it) and hand the
 * caller its range + contents so it can reopen the matching popover.
 *
 * Uses click-coordinate → document position lookup so that two blocks sharing
 * the same UUID (e.g. copy-pasted) are each resolved to their own range rather
 * than always resolving to the first occurrence.
 */
function blockClickHandler(
  onEdit: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void,
  onOpenChapter?: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void,
): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      const el = event.target as HTMLElement | null
      const scriptureEl = (el?.closest('.cm-spiritual-block') ?? null) as HTMLElement | null
      const markLineEl = scriptureEl
        ? null
        : ((el?.closest('.cm-mark-line') ?? null) as HTMLElement | null)
      if (!scriptureEl && !markLineEl) return false

      // Resolve which block was clicked by position, not by ID — two blocks
      // with the same UUID (copy-paste) must each be independently editable.
      const blocks = view.state.field(spiritualBlocksField)
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      let block = pos === null ? undefined : blocks.find((b) => pos >= b.from && pos < b.to)
      // Coords can land outside the block's range when it's rendered tight against
      // another block widget (e.g. a scripture answer beneath a practice prompt)
      // or when the click hits the citation at the very bottom edge. Fall back to
      // the clicked element's own id so the block is always editable.
      if (!block && scriptureEl?.dataset.blockId) {
        block = blocks.find((b) => b.id === scriptureEl.dataset.blockId)
      }
      if (!block) return false

      event.preventDefault()
      // Exclude the block's trailing newline so an in-place replace keeps the
      // surrounding paragraph spacing intact.
      const docLen = view.state.doc.length
      const to = Math.min(block.to, docLen)
      const editTo = to > 0 && view.state.doc.sliceString(to - 1, to) === '\n' ? to - 1 : to
      const target: SpiritualBlockEditTarget = {
        id: block.id,
        type: block.type,
        content: block.content,
        reference: block.reference ?? null,
        from: block.from,
        to: editTo,
      }
      const anchor = anchorFor(view, block, scriptureEl)
      const wantEdit =
        block.type !== 'scripture' ||
        !onOpenChapter ||
        Boolean(el?.closest('.cm-spiritual-block__menu'))
      if (wantEdit) onEdit(target, anchor)
      else onOpenChapter(target, anchor)
      return true
    },
  })
}

/**
 * Paint Dayspring spiritual fences: every declared kind but scripture as marked
 * lines over the writer's own words, scripture as a set-apart block. Raw
 * ```dayspring-*``` syntax stays in the document for search, sync, and export.
 * Clicking a scripture block opens the chapter pane (`onOpenChapter`); `⋯` and
 * every marked line invoke `onEdit` so the caller can reopen the matching
 * popover.
 */
export function spiritualBlockExtension(
  onEdit: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void,
  onOpenChapter?: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void,
): Extension {
  return [
    spiritualBlockTheme,
    spiritualBlockField,
    // Treat each rendered marking as a single atom: arrows skip over it and
    // Backspace/Delete from an edge removes the whole fence in one stroke. This
    // is what keeps the edit panel the way you change a marking — the fence
    // delimiters have no height, so a caret inside the run could otherwise land
    // on markup it can't see and corrupt the ``` marker.
    // Use block.to (includes the closing fence's trailing \n) rather than the
    // trimmed decoration end.
    EditorView.atomicRanges.of((view) => {
      const blocks = view.state.field(spiritualBlocksField)
      if (blocks.length === 0) return RangeSet.empty
      const builder = new RangeSetBuilder<Decoration>()
      for (const block of blocks) {
        builder.add(block.from, block.to, Decoration.mark({}))
      }
      return builder.finish()
    }),
    blockClickHandler(onEdit, onOpenChapter),
  ]
}
