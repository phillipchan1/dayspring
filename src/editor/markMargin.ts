import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { Prec, RangeSetBuilder, StateField, type Extension, type Text } from '@codemirror/state'
import type { ParsedSpiritualBlock } from '@/lib/spiritualBlocks'
import type { SpiritualItemType } from '@/lib/types'
import { buildGlyphElement } from './markGlyph'
import { markedRunLines } from './spiritualBlockDecoration'
import { posInsideBlock, spiritualBlocksField } from './spiritualBlocksField'

/**
 * The margin, closed.
 *
 * Not a button labelled "sidebar" — the page's own margin rule: a hairline down
 * the right edge of the writing column, with a small glyph sitting on it at the
 * vertical position of each marking's line. Closed, it is already meaningful:
 * you can see there are three markings and roughly where, in fourteen pixels.
 * It isn't chrome, because a page has a margin whether or not anyone writes in
 * it.
 *
 * The glyphs are widget decorations attached to their own lines rather than an
 * overlay positioned by measurement. That is the whole reason this costs
 * nothing: a decoration moves and scrolls with its line for free, so there is no
 * per-frame `coordsAtPos` sweep on the input path and nothing to keep in sync.
 * Principle 3 is a hard constraint on this surface, not a preference.
 *
 * Scripture is the exception, and it has to be: it still renders as a block
 * replace widget, and a decoration placed inside a replaced range is swallowed.
 * Its glyph is drawn by the block widget itself (spiritualBlockDecoration.ts),
 * positioned against the same rule.
 */

/** Distance from the writing column's right edge to the rule, in rem. */
const RULE_OFFSET_REM = 1.1
/** Half-width of the clickable band around the rule, in px. */
const RULE_HIT_PX = 9

class MarkGlyphWidget extends WidgetType {
  constructor(
    readonly kind: SpiritualItemType,
    readonly id: string,
  ) {
    super()
  }

  eq(other: MarkGlyphWidget): boolean {
    return other.kind === this.kind && other.id === this.id
  }

  toDOM(): HTMLElement {
    return buildGlyphElement(this.kind, this.id)
  }

  ignoreEvent(): boolean {
    return false
  }
}

function buildGlyphs(blocks: readonly ParsedSpiritualBlock[], doc: Text): DecorationSet {
  if (blocks.length === 0) return Decoration.none
  const builder = new RangeSetBuilder<Decoration>()
  for (const block of blocks) {
    // Drawn inside its own block widget instead — see the module comment.
    if (block.type === 'scripture') continue
    const run = markedRunLines(doc, block)
    if (!run) continue
    const at = doc.line(run.firstLine).from
    builder.add(
      at,
      at,
      Decoration.widget({ widget: new MarkGlyphWidget(block.type, block.id), side: -1 }),
    )
  }
  return builder.finish()
}

const glyphField = StateField.define<DecorationSet>({
  create(state) {
    return buildGlyphs(state.field(spiritualBlocksField), state.doc)
  },
  update(deco, tr) {
    if (tr.docChanged) return buildGlyphs(tr.state.field(spiritualBlocksField), tr.state.doc)
    return deco.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

const marginTheme = EditorView.theme({
  // The containing block for the rule. `.cm-content` is the writing column
  // itself, so the rule runs the full height of the document and scrolls with
  // it — which is what makes it a margin rather than a fixed strip of UI.
  '.cm-content': {
    position: 'relative',
  },
  // A pseudo-element, so there is one more paint and zero more DOM inside a
  // contenteditable. It takes no pointer events; the band around it is handled
  // by a listener on the scroller, which also catches clicks on bare margin.
  '.cm-content::before': {
    content: '""',
    position: 'absolute',
    top: '0',
    bottom: '0',
    left: `calc(100% + ${RULE_OFFSET_REM}rem)`,
    width: '1px',
    background: 'color-mix(in srgb, var(--text-faint) 26%, transparent)',
    pointerEvents: 'none',
  },
  // Each glyph is positioned against its own line, which is what lets it track
  // the text with no measurement.
  '.cm-line': {
    position: 'relative',
  },
  '.cm-mark-glyph': {
    // `display` is set here rather than only in global.css: the base rule there
    // hides the scripture widget's own hand when this extension isn't loaded.
    display: 'inline-flex',
    position: 'absolute',
    top: '0.15em',
    left: `calc(100% + ${RULE_OFFSET_REM}rem)`,
    transform: 'translateX(-50%)',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '1.15em',
    cursor: 'pointer',
    userSelect: 'none',
    // Arrival is a fade, never a movement: motion in peripheral vision is what
    // breaks concentration, opacity is not.
    animation: 'ds-glyph-in 600ms ease both',
  },
  '@media (prefers-reduced-motion: reduce)': {
    '.cm-mark-glyph': { animation: 'none' },
  },
  // A pseudo-element on the line, not a widget in it — and the reason is the
  // caret.
  //
  // The `+` is the one thing on the rule that lands on a line with nothing on
  // it yet, and as a widget it was the only node in that line's box. WebKit
  // then painted no caret there at all: the cursor vanished on exactly the
  // empty line the writer was about to write in, while the `+` beside it said
  // the editor still had focus. (Chrome paints it at the line start anyway,
  // which is why this only ever showed on the iPad, the phone and the Mac
  // app.) Drawn this way an empty line's DOM is `<br>` and nothing else —
  // identical to a page with the margin turned off, which is the state the
  // caret is known to survive. It is also the same bargain the rule itself
  // strikes above: one more paint, and no more DOM inside a contenteditable.
  //
  // Faint to the point of nearly not being there until you look for it, and it
  // brightens on hover. This sits in the writing surface permanently, so it has
  // to earn its pixels twice. Hover is the whole line rather than the 14px of
  // the `+`, because a pseudo-element cannot be hovered on its own — a bigger
  // target for the same brightening, on the one line the writer is already in.
  '.cm-line.cm-mark-here::after': {
    content: '"+"',
    position: 'absolute',
    top: '0.1em',
    left: `calc(100% + ${RULE_OFFSET_REM}rem)`,
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '1.2em',
    color: 'var(--text-faint)',
    fontSize: '0.7em',
    lineHeight: '1',
    opacity: '0.45',
    cursor: 'pointer',
    transition: 'opacity 120ms ease, color 120ms ease',
  },
  '.cm-line.cm-mark-here:hover::after': {
    opacity: '1',
    color: 'var(--text)',
  },

  // The rule, its hands and the `+` are the margin's whole closed state, and a
  // phone has no room beside the column for any of them. The margin opens as a
  // bottom sheet there instead (MarkMargin.css), and marking on touch stays with
  // the command toolbar above the keyboard.
  '@media (max-width: 767px)': {
    '.cm-content::before': { display: 'none' },
    '.cm-mark-glyph': { display: 'none' },
    '.cm-line.cm-mark-here::after': { display: 'none' },
  },
})

/**
 * The margin `+`, on the rule beside wherever you are.
 *
 * One affordance serves both manual gestures. With a selection it marks the
 * selection's lines; with a bare caret it marks the paragraph you are in. They
 * were specified as two gestures — select-then-choose, and a `+` on the current
 * line — but they differ only in what the range resolves to, and a second
 * control in the writing surface is exactly the accretion Principle 3 warns
 * about. The place you read markings is the place you make them.
 *
 * It appears only while the editor has focus, and never beside a line that is
 * already marked: a fence inside a fence is not a document anyone can edit back
 * out of, and the line already has a hand on the rule there.
 */
const markHereLine = Decoration.line({ class: 'cm-mark-here' })

function buildMarkHere(view: EditorView): DecorationSet {
  if (!view.hasFocus) return Decoration.none
  const { from } = view.state.selection.main
  const blocks = view.state.field(spiritualBlocksField)
  if (posInsideBlock(blocks, from)) return Decoration.none
  const line = view.state.doc.lineAt(from)
  return Decoration.set([markHereLine.range(line.from)])
}

/** Horizontal centre of the margin rule, in viewport coordinates. */
function ruleX(view: EditorView): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  return view.contentDOM.getBoundingClientRect().right + RULE_OFFSET_REM * rem
}

/** A click at this x is on the rule — the band the `+` and the hands share. */
function onRule(view: EditorView, clientX: number): boolean {
  return Math.abs(clientX - ruleX(view)) <= RULE_HIT_PX
}

/**
 * The `+` was hit, and here is the line it belongs to.
 *
 * A pseudo-element reports its own line as the event target, so "was this the
 * `+`?" is a question about geometry: the caret's line, inside the rule's band,
 * within the small box the `+` is actually drawn in. That last test matters on
 * a wrapped line — the class covers every row of it, but the `+` is only ever
 * beside the first, and rule beside the rest still opens the margin.
 */
function hitMarkHere(view: EditorView, event: MouseEvent): HTMLElement | null {
  const line = (event.target as HTMLElement | null)?.closest('.cm-line')
  if (!line?.classList.contains('cm-mark-here')) return null
  if (!onRule(view, event.clientX)) return null
  const { top, bottom } = handRect(view, line as HTMLElement)
  return event.clientY >= top && event.clientY <= bottom ? (line as HTMLElement) : null
}

/**
 * Where the `+` is drawn for a line, in viewport coordinates.
 *
 * Read back from the theme rather than measured: a pseudo-element has no rect
 * of its own to ask for. `0.1em` of offset and `1.2em` of height at `0.7em`
 * resolve against the line's own font size, which is the one number to look up.
 */
function handRect(view: EditorView, line: HTMLElement): { top: number; bottom: number; left: number } {
  const size = parseFloat(getComputedStyle(line).fontSize) || 16
  const top = line.getBoundingClientRect().top + 0.1 * 0.7 * size
  return { top, bottom: top + 1.2 * 0.7 * size, left: ruleX(view) - 7 }
}

function markHerePlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildMarkHere(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.focusChanged) {
          this.decorations = buildMarkHere(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}

/**
 * Open the margin from the closed rule: a click on a glyph, or anywhere in the
 * narrow band around the hairline.
 *
 * The band is checked against the content box on the click itself rather than
 * tracked — a rect read per click costs nothing, and there is no resize
 * observer to keep alive.
 */
function railClickPlugin(onOpen: () => void) {
  return ViewPlugin.define((view: EditorView) => {
    const onMouseDown = (event: MouseEvent) => {
      // The `+` sits in this same band and has its own handler. Without this the
      // one click both opened the picker and opened the margin.
      if (hitMarkHere(view, event)) return
      if (!onRule(view, event.clientX)) return
      event.preventDefault()
      onOpen()
    }
    view.scrollDOM.addEventListener('mousedown', onMouseDown)
    return {
      destroy() {
        view.scrollDOM.removeEventListener('mousedown', onMouseDown)
      },
    }
  })
}

/**
 * The closed margin: the rule, and a hand on it beside every marking.
 *
 * `onOpen` fires from a glyph or from the rule itself. Nothing here ever takes
 * focus — you can write straight through it.
 */
export function markMarginExtension(
  onOpen: () => void,
  /** The `+` was pressed. Carries the viewport rect of the `+` itself. */
  onMarkHere?: (at: { top: number; bottom: number; left: number }) => void,
): Extension {
  return [
    marginTheme,
    glyphField,
    markHerePlugin(),
    railClickPlugin(onOpen),
    // Ahead of the block click handler, which would otherwise read a click on
    // the scripture glyph as a click on the verse and open the chapter pane.
    Prec.highest(
      EditorView.domEventHandlers({
        mousedown(event, view) {
          const el = event.target as HTMLElement | null
          const plusLine = hitMarkHere(view, event)
          if (plusLine) {
            // Cancel the mousedown rather than handling the click: the caret and
            // any live selection have to survive, since the selection is the
            // range about to be marked.
            event.preventDefault()
            onMarkHere?.(handRect(view, plusLine))
            return true
          }
          if (!el?.closest('.cm-mark-glyph')) return false
          event.preventDefault()
          onOpen()
          return true
        },
      }),
    ),
  ]
}
