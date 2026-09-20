import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'
import {
  EditorState,
  RangeSet,
  RangeSetBuilder,
  StateField,
  Transaction,
  type Extension,
  type Text,
} from '@codemirror/state'
import { type ParsedSpiritualBlock } from '@/lib/spiritualBlocks'
import type { SpiritualItemType } from '@/lib/types'
import { computeRangePanelAnchor, type InlinePanelAnchor } from './inlinePanelAnchor'
import { MARK_KIND, MARKED_LINE_KINDS } from '@/lib/markKinds'
import { spiritualBlocksField } from './spiritualBlocksField'
import { scriptureLines, verseRange } from './scriptureBody'

/**
 * How a declared marking is drawn.
 *
 * One rule decides the shape: **your words get marked, borrowed words get set
 * apart.** A prayer and a sense are the writer's own sentences, so they stay in
 * the prose and take a line decoration — the paragraph you wrote, with a hand
 * beside it. Scripture is not the writer's sentence, so it is still set apart —
 * a rule down its left, italic, its citation in small caps — but it is set
 * apart with line decorations now, like everything else here.
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
 *
 * ## Why scripture gave up its widget
 *
 * It had one until marking a phrase inside a verse had to work. A replace
 * widget has no document text under the pointer — the verse was DOM the editor
 * had drawn, `user-select: none` besides — so there was nothing to select and
 * nothing for a mark decoration to cover. Worse, CodeMirror crashes its measure
 * pass if a mark decoration lands inside a block-replace range, which is why
 * `markDecoration` and `scriptureRefDecoration` both carry a guard against it.
 *
 * Drawing the verse as ordinary lines makes the text real. Selection is native,
 * `marksField` paints it with no widget-side code at all, and the guard relaxes
 * for scripture rather than growing a special case. The same move was already
 * made once here, for prayer and sense.
 *
 * What the widget used to give for free — *you cannot edit borrowed words* —
 * comes back as `scriptureReadOnly` below: selectable, not editable. That is
 * the whole trade, and it is deliberate. The fence is no longer in
 * `atomicRanges` either, because an atomic range pushes a selection back out of
 * itself, which is exactly the gesture we now need to work.
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

/**
 * The `⋯` that used to live in the widget's corner.
 *
 * Anchored to the start of the verse's first line and positioned against it, so
 * it keeps the top-right corner it had. It is a widget rather than a `::after`
 * because the citation line has already spent its one pseudo-element on the
 * arrow, and because a real button is the only version of this that a keyboard
 * or a screen reader can reach.
 */
class ScriptureMenuWidget extends WidgetType {
  constructor(readonly id: string) {
    super()
  }

  eq(other: ScriptureMenuWidget): boolean {
    return other.id === this.id
  }

  toDOM(): HTMLElement {
    const menu = document.createElement('button')
    menu.type = 'button'
    menu.className = 'cm-scripture-menu'
    menu.setAttribute('contenteditable', 'false')
    menu.setAttribute('aria-label', 'Edit scripture')
    menu.dataset.blockId = this.id
    menu.textContent = '\u22ef'
    return menu
  }

  ignoreEvent(): boolean {
    return false
  }
}

/**
 * The arrow on the citation — the cue that says this line is a door.
 *
 * A real element rather than a `::after`, for two reasons that both bit. Inside
 * a CodeMirror theme the pseudo-element's `display` did not survive (it
 * computed to `block`, which put the arrow on a line of its own), and a
 * pseudo-element cannot be asserted in a test, so the one piece of this whose
 * whole job is to be seen would have had no coverage at all.
 *
 * `inline-block` is still load-bearing: text-decoration does not propagate into
 * an atomic inline box, so the arrow escapes the underline the citation carries.
 */
class ScriptureDoorWidget extends WidgetType {
  eq(): boolean {
    // Every arrow is the same arrow — never re-render one.
    return true
  }

  toDOM(): HTMLElement {
    const arrow = document.createElement('span')
    arrow.className = 'cm-scripture-door'
    arrow.setAttribute('aria-hidden', 'true')
    arrow.textContent = '\u2192'
    return arrow
  }

  ignoreEvent(): boolean {
    return false
  }
}

const scriptureDoorDeco = Decoration.widget({ widget: new ScriptureDoorWidget(), side: 1 })

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

/**
 * Scripture's own line decorations, cached for the same reason as the markings
 * above: stable identities let CodeMirror's RangeSet diffing skip untouched
 * lines rather than rebuild the set on every keystroke.
 */
const verseLineDecos = new Map<string, Decoration>()

function verseLineDeco(first: boolean, last: boolean): Decoration {
  const key = `${first ? 'f' : '-'}${last ? 'l' : '-'}`
  let deco = verseLineDecos.get(key)
  if (!deco) {
    let cls = 'cm-scripture-line'
    if (first) cls += ' cm-scripture-line--first'
    if (last) cls += ' cm-scripture-line--last'
    deco = Decoration.line({ class: cls })
    verseLineDecos.set(key, deco)
  }
  return deco
}

const citeLineDeco = Decoration.line({ class: 'cm-scripture-cite' })

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
    if (block.type === 'scripture') addScriptureLines(builder, block, doc)
    else addMarkedLines(builder, block, doc)
  }
  return builder.finish()
}

/**
 * Draw a scripture quotation: the two fence delimiters collapsed to nothing,
 * the verse as set-apart lines, and the citation as the small-cap door that
 * opens the chapter.
 *
 * Every line here is real document text — that is the point of the change. A
 * selection can land on the verse, `marksField` can paint it, and the reader
 * can copy a phrase out the way they can copy anything else.
 */
function addScriptureLines(
  builder: RangeSetBuilder<Decoration>,
  block: ParsedSpiritualBlock,
  doc: Text,
): void {
  const lines = scriptureLines(doc, block)
  if (!lines) return

  const open = doc.line(lines.openLine)
  builder.add(open.from, open.from, fenceLineDeco)

  for (let n = lines.verseFirst; n <= lines.verseLast; n++) {
    const line = doc.line(n)
    const first = n === lines.verseFirst
    builder.add(line.from, line.from, verseLineDeco(first, n === lines.verseLast))
    // Ordering inside the builder is by (from, startSide): a line decoration
    // sorts far left of a widget at the same offset, so the line must be added
    // first. The menu rides the opening verse line because that is the corner
    // it has always been in.
    if (first) {
      builder.add(line.from, line.from, Decoration.widget({ widget: new ScriptureMenuWidget(block.id), side: -1 }))
    }
  }

  if (lines.citeLine != null) {
    const cite = doc.line(lines.citeLine)
    builder.add(cite.from, cite.from, citeLineDeco)
    builder.add(cite.to, cite.to, scriptureDoorDeco)
  }

  if (lines.closeLine > lines.openLine) {
    const close = doc.line(lines.closeLine)
    builder.add(close.from, close.from, fenceLineDeco)
  }
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
  //
  // The same pull-quote as before, drawn on lines instead of inside a widget.
  // The rule is a background image rather than a border-left for the reason the
  // markings below give in full: a border runs the whole height of every line,
  // so two quotations on consecutive lines drew one unbroken bar. A background
  // can be sized short of the box, which is what gives a run ends.
  '.cm-scripture-line': {
    // The cursor IS the instruction: a caret over the words says "this is text,
    // you may take some"; the pointer over the citation says "this is a door".
    // Explicit rather than inherited, so no ancestor can quietly undo it.
    cursor: 'text',
    paddingLeft: '1rem',
    paddingRight: '1.6rem',
    backgroundImage:
      'linear-gradient(color-mix(in srgb, var(--accent) 32%, transparent), color-mix(in srgb, var(--accent) 32%, transparent))',
    backgroundSize: '1px 100%',
    backgroundPosition: '0 0',
    backgroundRepeat: 'no-repeat',
    transition: 'background-color 120ms ease',
    /*
     * The verse's voice goes on the LINE, and the spans inside it inherit.
     *
     * It used to go on `.cm-scripture-line span`, copying the rule the markings
     * below need — but the two cases are not the same. A fence body carries
     * `t.monospace` spans only where the highlighter emits them; where it does
     * not, the text is a bare text node and a `span` selector styles nothing.
     * The visible result was a quotation that turned italic only where it
     * happened to be marked, because `.cm-mark` was then the one span on the
     * line. Styling the line covers both cases.
     */
    fontFamily: 'var(--font-editor)',
    // A tier below the practice question (1.06em) so a quoted verse reads as
    // supporting content, not a competing prompt.
    fontSize: '0.9em',
    fontStyle: 'italic',
    letterSpacing: '0.005em',
    color: 'var(--text)',
    fontOpticalSizing: 'auto',
  },
  '.cm-scripture-line--first': {
    position: 'relative',
    paddingTop: '0.3em',
    backgroundPosition: '0 0.3em',
    backgroundSize: '1px calc(100% - 0.3em)',
    borderTopLeftRadius: 'var(--radius-md)',
    borderTopRightRadius: 'var(--radius-md)',
  },
  '.cm-scripture-line--last': {
    backgroundSize: '1px 100%',
  },
  '.cm-scripture-line--first.cm-scripture-line--last': {
    backgroundSize: '1px calc(100% - 0.3em)',
  },
  '.cm-scripture-line span': {
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontStyle: 'inherit',
    color: 'inherit',
  },

  // The citation echoes the cap-label motif — a tracked small cap, not a stray
  // mono line — which is what knits the verse into the rest of the surface.
  '.cm-scripture-cite': {
    paddingLeft: '1rem',
    paddingBottom: '0.35em',
    backgroundImage:
      'linear-gradient(color-mix(in srgb, var(--accent) 32%, transparent), color-mix(in srgb, var(--accent) 32%, transparent))',
    backgroundSize: '1px calc(100% - 0.35em)',
    backgroundPosition: '0 0',
    backgroundRepeat: 'no-repeat',
    borderBottomLeftRadius: 'var(--radius-md)',
    borderBottomRightRadius: 'var(--radius-md)',
    cursor: 'pointer',
    // On the line, for the same reason the verse is — and the underline with
    // it, which is what lets the arrow escape it by being an inline-block.
    fontFamily: 'var(--font-editor)',
    fontSize: '0.66em',
    fontWeight: '500',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
    textDecoration: 'underline',
    textDecorationThickness: '1px',
    textDecorationColor: 'color-mix(in srgb, var(--accent) 45%, transparent)',
    textUnderlineOffset: '0.35em',
    transition: 'color 120ms ease, text-decoration-color 120ms ease',
  },
  '.cm-scripture-cite span:not(.cm-scripture-door)': {
    fontFamily: 'inherit',
    fontSize: 'inherit',
    color: 'inherit',
  },
  /*
   * The door, made visible at rest.
   *
   * There is no hover on a phone, so the tooltip this used to rely on was no
   * cue at all for half the people who met it — and the citation is the one
   * part of the block whose whole job is to be clicked. A hairline and the
   * arrow the chapter pane's own footer already uses ("Continue on ESV.org →")
   * say it between them: the hairline rides text that was already here, and the
   * arrow is the only ink this adds to the writing surface.
   */
  '.cm-scripture-door': {
    display: 'inline-block',
    marginLeft: '0.5em',
    fontFamily: 'var(--font-editor)',
    fontSize: '0.72em',
    lineHeight: '1',
    letterSpacing: '0',
    color: 'var(--text-faint)',
    transition: 'transform 120ms ease, color 120ms ease',
  },
  '.cm-scripture-cite:hover': {
    color: 'var(--text)',
    textDecorationColor: 'color-mix(in srgb, var(--accent) 85%, transparent)',
  },
  '.cm-scripture-cite:hover .cm-scripture-door': {
    transform: 'translateX(2px)',
    color: 'var(--text-dim)',
  },

  // The `\u22ef`, in the corner it has always been in. Absolute against the opening
  // verse line, which carries `position: relative` above.
  '.cm-scripture-menu': {
    position: 'absolute',
    top: '0.15em',
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
  '.cm-scripture-line:hover .cm-scripture-menu, .cm-scripture-menu:focus-visible': {
    opacity: '1',
  },
  '@media (hover: none)': {
    '.cm-scripture-menu': {
      opacity: '0.55',
    },
  },
  '.cm-scripture-menu:hover': {
    color: 'var(--text)',
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
function anchorFor(view: EditorView, block: ParsedSpiritualBlock): InlinePanelAnchor {
  // Measure the run itself rather than the single line that happened to be
  // clicked; otherwise a three-line prayer opens its panel over its own last
  // two lines. Scripture measures its verse for the same reason — it used to
  // measure the widget element, which no longer exists.
  const doc = view.state.doc
  if (block.type === 'scripture') {
    const range = verseRange(doc, block)
    if (range) return computeRangePanelAnchor(view, range.from, range.to)
    return computeRangePanelAnchor(view, block.from, block.from)
  }
  const run = markedRunLines(doc, block)
  if (!run) return computeRangePanelAnchor(view, block.from, block.from)
  return computeRangePanelAnchor(view, doc.line(run.firstLine).from, doc.line(run.lastLine).to)
}

/** The block a click landed in, resolved by position and then by element id. */
function blockAtEvent(
  view: EditorView,
  event: MouseEvent,
  el: HTMLElement | null,
): ParsedSpiritualBlock | undefined {
  // Resolve which block was clicked by position, not by ID — two blocks with
  // the same UUID (copy-paste) must each be independently editable.
  const blocks = view.state.field(spiritualBlocksField)
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  let block = pos === null ? undefined : blocks.find((b) => pos >= b.from && pos < b.to)
  // Coords can land outside the block's range when it is rendered tight against
  // another block (e.g. a scripture answer beneath a practice prompt) or when
  // the click hits the citation at the very bottom edge. Fall back to the
  // clicked element's own id so the block is always reachable.
  const menu = el?.closest('.cm-scripture-menu') as HTMLElement | null
  if (!block && menu?.dataset.blockId) {
    block = blocks.find((b) => b.id === menu.dataset.blockId)
  }
  return block
}

function editTargetOf(view: EditorView, block: ParsedSpiritualBlock): SpiritualBlockEditTarget {
  // Exclude the block's trailing newline so an in-place replace keeps the
  // surrounding paragraph spacing intact.
  const docLen = view.state.doc.length
  const to = Math.min(block.to, docLen)
  const editTo = to > 0 && view.state.doc.sliceString(to - 1, to) === '\n' ? to - 1 : to
  return {
    id: block.id,
    type: block.type,
    content: block.content,
    reference: block.reference ?? null,
    from: block.from,
    to: editTo,
  }
}

/**
 * Click a rendered marking to edit it, or a quotation to read around it.
 *
 * **The one interesting case is the verse.** A click on it still opens the
 * chapter, exactly as D-024 decided — but a drag across it has to select, which
 * means this handler cannot `preventDefault()` on mousedown the way every other
 * case here does. So the verse is decided on mouseup instead: no movement and
 * no selection is a click and opens the chapter; anything else was a drag and
 * is left alone for the format bar to pick up. The citation and the `⋯` are
 * ordinary buttons and are still handled on mousedown, which is what keeps the
 * door feeling instant.
 *
 * Touch needs none of that: a tap arrives as a click with no selection, and a
 * long-press is the platform's own selection gesture, which never reaches here.
 */
function blockClickHandler(
  onEdit: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void,
  onOpenChapter?: (target: SpiritualBlockEditTarget, anchor: InlinePanelAnchor) => void,
): Extension {
  // Where the pointer went down on a verse, so mouseup can tell a click from a
  // drag. Module-scoped rather than per-view because only one pointer is ever
  // down at a time in the editor.
  let versePress: { x: number; y: number; id: string } | null = null

  return EditorView.domEventHandlers({
    mousedown(event, view) {
      const el = event.target as HTMLElement | null
      versePress = null

      const verseEl = el?.closest('.cm-scripture-line') as HTMLElement | null
      const citeEl = el?.closest('.cm-scripture-cite') as HTMLElement | null
      const menuEl = el?.closest('.cm-scripture-menu') as HTMLElement | null
      const markLineEl =
        verseEl || citeEl || menuEl ? null : (el?.closest('.cm-mark-line') as HTMLElement | null)
      if (!verseEl && !citeEl && !menuEl && !markLineEl) return false

      const block = blockAtEvent(view, event, el)
      if (!block) return false

      // The verse is text now. Let the browser start a selection and decide on
      // mouseup — see the note above.
      if (verseEl && !menuEl && block.type === 'scripture') {
        versePress = { x: event.clientX, y: event.clientY, id: block.id }
        return false
      }

      event.preventDefault()
      const target = editTargetOf(view, block)
      const anchor = anchorFor(view, block)
      const wantEdit = block.type !== 'scripture' || !onOpenChapter || Boolean(menuEl)
      if (wantEdit) onEdit(target, anchor)
      else onOpenChapter(target, anchor)
      return true
    },

    mouseup(event, view) {
      const press = versePress
      versePress = null
      if (!press || !onOpenChapter) return false
      // A drag is a selection, not a door.
      if (Math.abs(event.clientX - press.x) + Math.abs(event.clientY - press.y) > 6) return false
      if (!view.state.selection.main.empty) return false

      const block = view.state
        .field(spiritualBlocksField)
        .find((b) => b.id === press.id && b.type === 'scripture')
      if (!block) return false
      onOpenChapter(editTargetOf(view, block), anchorFor(view, block))
      return true
    },
  })
}

/**
 * Borrowed words are selectable, and not editable.
 *
 * The widget used to enforce this by simply not being text. Now that the verse
 * is real lines, a keystroke could land in the middle of a quotation, so the
 * rule is stated outright instead: a change may remove a whole quotation, and
 * may not rewrite part of one.
 *
 * **Only the writer's own keystrokes are refused.** A transaction with no
 * `userEvent` is programmatic — a remote device's edit arriving through
 * `applyRemoteDoc`, our own `/scripture` insert, the duplicate-id rewrite — and
 * refusing one of those would silently drop somebody's writing. That would be a
 * far worse bug than the one this prevents, so the filter stays narrow.
 */
const scriptureReadOnly = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr
  const event = tr.annotation(Transaction.userEvent)
  if (!event) return tr
  if (!/^(input|delete|move)/.test(event)) return tr

  const blocks = tr.startState.field(spiritualBlocksField).filter((b) => b.type === 'scripture')
  if (blocks.length === 0) return tr

  const doc = tr.startState.doc
  let refuse = false
  tr.changes.iterChanges((fromA, toA) => {
    if (refuse) return
    for (const block of blocks) {
      // A deletion of the whole quotation is allowed, and the selection that
      // makes it usually stops at the closing fence rather than past its
      // newline — so containment is measured against the block's last visible
      // character, not against `block.to`.
      const end =
        block.to > block.from && doc.sliceString(block.to - 1, block.to) === '\n'
          ? block.to - 1
          : block.to
      if (toA <= block.from || fromA >= block.to) continue
      if (fromA <= block.from && toA >= end) continue
      refuse = true
      return
    }
  })
  return refuse ? [] : tr
})

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
    //
    // Scripture is deliberately NOT in here. An atomic range pushes a selection
    // back out of itself, which would undo the gesture that marking a phrase is
    // built on. `scriptureReadOnly` takes over the half of the job that still
    // matters — the words can be selected, and cannot be rewritten.
    EditorView.atomicRanges.of((view) => {
      const blocks = view.state.field(spiritualBlocksField)
      if (blocks.length === 0) return RangeSet.empty
      const builder = new RangeSetBuilder<Decoration>()
      for (const block of blocks) {
        if (block.type === 'scripture') continue
        builder.add(block.from, block.to, Decoration.mark({}))
      }
      return builder.finish()
    }),
    scriptureReadOnly,
    blockClickHandler(onEdit, onOpenChapter),
  ]
}
